from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_workspace_permission
from app.core.permissions import Permission
from app.models.workspace_membership import WorkspaceMembership
from app.schemas.audit import AuditEventListResponse, AuditEventPublic
from app.services import audit_service

router = APIRouter(prefix="/workspaces/{workspace_id}/audit", tags=["audit"])


@router.get("", response_model=AuditEventListResponse)
async def list_audit_events(
    workspace_id: UUID,
    limit: int = 100,
    _: WorkspaceMembership = Depends(require_workspace_permission(Permission.audit_view)),
    session: AsyncSession = Depends(get_db),
) -> AuditEventListResponse:
    events = await audit_service.list_workspace_events(
        session,
        workspace_id=workspace_id,
        limit=limit,
    )
    return AuditEventListResponse(events=[AuditEventPublic.model_validate(event) for event in events])
