from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_workspace_permission
from app.core.permissions import Permission
from app.core.rbac import WorkspaceRole
from app.models.user import User
from app.models.workspace_membership import WorkspaceMembership
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceDetail,
    WorkspaceMemberInvite,
    WorkspaceMemberPublic,
    WorkspaceMemberUpdateRole,
    WorkspacePublic,
)
from app.services import workspace_service

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post("", response_model=WorkspacePublic, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    body: WorkspaceCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspacePublic:
    return await workspace_service.create_workspace(session, current_user, body)


@router.get("", response_model=list[WorkspacePublic])
async def list_workspaces(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WorkspacePublic]:
    return await workspace_service.list_user_workspaces(session, current_user.id)


@router.get("/{workspace_id}", response_model=WorkspaceDetail)
async def get_workspace(
    workspace_id: UUID,
    _: WorkspaceMembership = Depends(
        require_workspace_permission(Permission.workspace_view)
    ),
    session: AsyncSession = Depends(get_db),
) -> WorkspaceDetail:
    workspace = await workspace_service.get_workspace_detail(session, workspace_id)
    members = await workspace_service.list_workspace_members(session, workspace_id)
    return WorkspaceDetail(
        workspace=workspace,
        members=[
            WorkspaceMemberPublic(
                id=item.membership.id,
                workspace_id=item.membership.workspace_id,
                user_id=item.membership.user_id,
                role=WorkspaceRole(item.membership.role),
                joined_at=item.membership.joined_at,
                user_email=item.user_email,
            )
            for item in members
        ],
    )


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberPublic])
async def list_members(
    workspace_id: UUID,
    _: WorkspaceMembership = Depends(
        require_workspace_permission(Permission.workspace_view)
    ),
    session: AsyncSession = Depends(get_db),
) -> list[WorkspaceMemberPublic]:
    members = await workspace_service.list_workspace_members(session, workspace_id)
    return [
        WorkspaceMemberPublic(
            id=item.membership.id,
            workspace_id=item.membership.workspace_id,
            user_id=item.membership.user_id,
            role=WorkspaceRole(item.membership.role),
            joined_at=item.membership.joined_at,
            user_email=item.user_email,
        )
        for item in members
    ]


@router.post("/{workspace_id}/members", response_model=WorkspaceMemberPublic, status_code=status.HTTP_201_CREATED)
async def invite_member(
    workspace_id: UUID,
    body: WorkspaceMemberInvite,
    _: WorkspaceMembership = Depends(
        require_workspace_permission(Permission.member_invite)
    ),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceMemberPublic:
    item = await workspace_service.invite_member(
        session,
        workspace_id,
        current_user.id,
        body.email,
        body.role,
    )
    return WorkspaceMemberPublic(
        id=item.membership.id,
        workspace_id=item.membership.workspace_id,
        user_id=item.membership.user_id,
        role=WorkspaceRole(item.membership.role),
        joined_at=item.membership.joined_at,
        user_email=item.user_email,
    )


@router.patch("/{workspace_id}/members/{member_user_id}/role", response_model=WorkspaceMemberPublic)
async def update_member_role(
    workspace_id: UUID,
    member_user_id: UUID,
    body: WorkspaceMemberUpdateRole,
    _: WorkspaceMembership = Depends(
        require_workspace_permission(Permission.member_update_role)
    ),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceMemberPublic:
    item = await workspace_service.update_member_role(
        session,
        workspace_id,
        current_user.id,
        member_user_id,
        body.role,
    )
    return WorkspaceMemberPublic(
        id=item.membership.id,
        workspace_id=item.membership.workspace_id,
        user_id=item.membership.user_id,
        role=WorkspaceRole(item.membership.role),
        joined_at=item.membership.joined_at,
        user_email=item.user_email,
    )
