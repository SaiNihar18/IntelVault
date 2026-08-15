from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import IntelVaultError
from app.core.rbac import WorkspaceRole
from app.core import storage
from app.models.document import Document
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_membership import WorkspaceMembership
from app.schemas.workspace import WorkspaceCreate


class WorkspaceNotFoundError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("Workspace not found", status_code=404)


class WorkspaceAccessDeniedError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("You do not have access to this workspace", status_code=403)


class WorkspaceMemberAlreadyExistsError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("User is already a workspace member", status_code=409)


class WorkspaceMemberNotFoundError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("Workspace member not found", status_code=404)


class WorkspaceOwnerRoleChangeError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("Workspace owner role cannot be changed", status_code=400)


class WorkspaceMemberRequiredError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("You are not a member of this workspace", status_code=403)


class UserNotFoundError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("User not found", status_code=404)


@dataclass(slots=True)
class WorkspaceMemberView:
    membership: WorkspaceMembership
    user_email: str


async def _get_workspace(session: AsyncSession, workspace_id: UUID) -> Workspace:
    result = await session.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise WorkspaceNotFoundError()
    return workspace


async def _get_membership(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
) -> WorkspaceMembership | None:
    result = await session.execute(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _ensure_member(session: AsyncSession, workspace_id: UUID, user_id: UUID) -> WorkspaceMembership:
    membership = await _get_membership(session, workspace_id, user_id)
    if membership is None:
        raise WorkspaceMemberRequiredError()
    return membership


async def _ensure_owner(session: AsyncSession, workspace_id: UUID, user_id: UUID) -> None:
    membership = await _ensure_member(session, workspace_id, user_id)
    if membership.role != WorkspaceRole.owner.value:
        raise WorkspaceAccessDeniedError()


async def create_workspace(
    session: AsyncSession,
    creator: User,
    body: WorkspaceCreate,
) -> Workspace:
    workspace = Workspace(
        name=body.name.strip(),
        description=body.description.strip() if body.description else None,
        created_by_user_id=creator.id,
    )
    session.add(workspace)
    await session.flush()
    session.add(
        WorkspaceMembership(
            workspace_id=workspace.id,
            user_id=creator.id,
            role=WorkspaceRole.owner.value,
        )
    )
    await session.commit()
    await session.refresh(workspace)
    return workspace


async def list_user_workspaces(session: AsyncSession, user_id: UUID) -> list[Workspace]:
    result = await session.execute(
        select(Workspace)
        .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
        .where(WorkspaceMembership.user_id == user_id)
        .order_by(Workspace.created_at.desc())
    )
    return list(result.scalars().all())


async def get_workspace_detail(session: AsyncSession, workspace_id: UUID) -> Workspace:
    result = await session.execute(
        select(Workspace)
        .options(selectinload(Workspace.memberships).selectinload(WorkspaceMembership.user))
        .where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise WorkspaceNotFoundError()
    return workspace


async def list_workspace_members(
    session: AsyncSession,
    workspace_id: UUID,
) -> list[WorkspaceMemberView]:
    result = await session.execute(
        select(WorkspaceMembership, User.email)
        .join(User, User.id == WorkspaceMembership.user_id)
        .where(WorkspaceMembership.workspace_id == workspace_id)
        .order_by(WorkspaceMembership.joined_at.asc())
    )
    return [WorkspaceMemberView(membership=row[0], user_email=row[1]) for row in result.all()]


async def invite_member(
    session: AsyncSession,
    workspace_id: UUID,
    actor_user_id: UUID,
    email: str,
    role: WorkspaceRole,
) -> WorkspaceMemberView:
    await _ensure_owner(session, workspace_id, actor_user_id)
    workspace = await _get_workspace(session, workspace_id)

    user_result = await session.execute(select(User).where(User.email == email.lower().strip()))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise UserNotFoundError()

    if await _get_membership(session, workspace.id, user.id):
        raise WorkspaceMemberAlreadyExistsError()

    membership = WorkspaceMembership(
        workspace_id=workspace.id,
        user_id=user.id,
        role=role.value,
    )
    session.add(membership)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise WorkspaceMemberAlreadyExistsError()

    return WorkspaceMemberView(membership=membership, user_email=user.email)


async def update_member_role(
    session: AsyncSession,
    workspace_id: UUID,
    actor_user_id: UUID,
    member_user_id: UUID,
    role: WorkspaceRole,
) -> WorkspaceMemberView:
    await _ensure_owner(session, workspace_id, actor_user_id)
    membership = await _get_membership(session, workspace_id, member_user_id)
    if membership is None:
        raise WorkspaceMemberNotFoundError()
    if membership.role == WorkspaceRole.owner.value:
        raise WorkspaceOwnerRoleChangeError()

    user_result = await session.execute(select(User).where(User.id == member_user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise WorkspaceMemberNotFoundError()

    membership.role = role.value
    await session.commit()
    return WorkspaceMemberView(membership=membership, user_email=user.email)


async def delete_workspace(
    session: AsyncSession,
    workspace_id: UUID,
    actor_user_id: UUID,
) -> None:
    await _ensure_owner(session, workspace_id, actor_user_id)
    workspace = await _get_workspace(session, workspace_id)

    # Clean up associated physical document files in storage
    doc_results = await session.execute(
        select(Document).where(Document.workspace_id == workspace_id)
    )
    docs = doc_results.scalars().all()
    for doc in docs:
        if doc.storage_path:
            try:
                storage.delete_file(doc.storage_path)
            except Exception:
                pass

    await session.delete(workspace)
    await session.commit()

