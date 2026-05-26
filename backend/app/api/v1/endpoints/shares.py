from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_workspace_permission
from app.core.permissions import Permission
from app.models.user import User
from app.models.workspace_membership import WorkspaceMembership
from app.schemas.share import (
    ShareLinkCreateRequest,
    ShareLinkCreateResponse,
    ShareLinkListResponse,
    ShareLinkPublic,
    SharedDocumentAccessResponse,
)
from app.services import share_service

router = APIRouter(tags=["shares"])
workspace_router = APIRouter(prefix="/workspaces/{workspace_id}/documents/{document_id}/shares", tags=["shares"])


@workspace_router.post("", response_model=ShareLinkCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_share_link(
    workspace_id: UUID,
    document_id: UUID,
    body: ShareLinkCreateRequest,
    _: WorkspaceMembership = Depends(require_workspace_permission(Permission.document_share)),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareLinkCreateResponse:
    link, share_token, share_url = await share_service.create_share_link(
        session,
        workspace_id=workspace_id,
        document_id=document_id,
        current_user=current_user,
        expires_in_hours=body.expires_in_hours,
        max_uses=body.max_uses,
    )
    return ShareLinkCreateResponse(
        link=ShareLinkPublic.model_validate(link),
        share_token=share_token,
        share_url=share_url,
    )


@workspace_router.get("", response_model=ShareLinkListResponse)
async def list_share_links(
    workspace_id: UUID,
    document_id: UUID,
    limit: int = 100,
    _: WorkspaceMembership = Depends(require_workspace_permission(Permission.document_share)),
    session: AsyncSession = Depends(get_db),
) -> ShareLinkListResponse:
    links = await share_service.list_document_share_links(
        session,
        workspace_id=workspace_id,
        document_id=document_id,
        limit=limit,
    )
    return ShareLinkListResponse(links=[ShareLinkPublic.model_validate(link) for link in links])


@workspace_router.delete("/{share_link_id}", response_model=ShareLinkPublic)
async def revoke_share_link(
    workspace_id: UUID,
    document_id: UUID,
    share_link_id: UUID,
    _: WorkspaceMembership = Depends(require_workspace_permission(Permission.document_share)),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareLinkPublic:
    link = await share_service.revoke_share_link(
        session,
        workspace_id=workspace_id,
        document_id=document_id,
        share_link_id=share_link_id,
        current_user=current_user,
    )
    return ShareLinkPublic.model_validate(link)


@router.get("/shares/{share_token}", response_model=SharedDocumentAccessResponse)
async def access_shared_document(
    share_token: str,
    session: AsyncSession = Depends(get_db),
) -> SharedDocumentAccessResponse:
    document = await share_service.resolve_share_token(session, share_token=share_token)
    return SharedDocumentAccessResponse(document=document)


@router.get("/shares/{share_token}/download")
async def download_shared_document(
    share_token: str,
    session: AsyncSession = Depends(get_db),
) -> FileResponse:
    document, file_path = await share_service.resolve_share_token_for_download(
        session,
        share_token=share_token,
    )
    return FileResponse(
        path=file_path,
        media_type=document.content_type or "application/octet-stream",
        filename=document.filename,
    )
