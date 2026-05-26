from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.rbac import WorkspaceRole


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class WorkspacePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    created_by_user_id: UUID
    created_at: datetime
    updated_at: datetime


class WorkspaceMemberInvite(BaseModel):
    email: EmailStr
    role: WorkspaceRole = WorkspaceRole.guest


class WorkspaceMemberUpdateRole(BaseModel):
    role: WorkspaceRole


class WorkspaceMemberPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    user_id: UUID
    role: WorkspaceRole
    joined_at: datetime
    user_email: str


class WorkspaceDetail(BaseModel):
    workspace: WorkspacePublic
    members: list[WorkspaceMemberPublic]
