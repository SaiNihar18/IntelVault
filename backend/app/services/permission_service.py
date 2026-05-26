from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import PermissionDeniedError, WorkspaceMemberRequiredError
from app.core.permissions import Permission, ROLE_PERMISSIONS
from app.models.workspace_membership import WorkspaceMembership


def role_has_permission(role: str, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())


async def get_workspace_membership(
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


async def ensure_workspace_permission(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    permission: Permission,
) -> WorkspaceMembership:
    membership = await get_workspace_membership(session, workspace_id, user_id)
    if membership is None:
        raise WorkspaceMemberRequiredError()
    if not role_has_permission(membership.role, permission):
        raise PermissionDeniedError(permission.value)
    return membership
