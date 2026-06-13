from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_workspace_permission
from app.core.permissions import Permission
from app.core import storage
from app.models.user import User
from app.models.workspace_membership import WorkspaceMembership
from app.schemas.document import DocumentPublic, DocumentUploadResponse
from app.services import document_processing_service, document_service

router = APIRouter(prefix="/workspaces/{workspace_id}/documents", tags=["documents"])


@router.post("", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    workspace_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    _: WorkspaceMembership = Depends(
        require_workspace_permission(Permission.document_upload)
    ),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentUploadResponse:
    document = await document_service.upload_document(session, workspace_id, current_user, file)
    background_tasks.add_task(document_processing_service.process_document, document.id)
    return DocumentUploadResponse(document=document)


@router.get("", response_model=list[DocumentPublic])
async def list_documents(
    workspace_id: UUID,
    _: WorkspaceMembership = Depends(
        require_workspace_permission(Permission.document_view)
    ),
    session: AsyncSession = Depends(get_db),
) -> list[DocumentPublic]:
    return await document_service.list_workspace_documents(session, workspace_id)


@router.get("/{document_id}", response_model=DocumentPublic)
async def get_document(
    workspace_id: UUID,
    document_id: UUID,
    _: WorkspaceMembership = Depends(
        require_workspace_permission(Permission.document_view)
    ),
    session: AsyncSession = Depends(get_db),
) -> DocumentPublic:
    return await document_service.get_workspace_document(
        session,
        workspace_id,
        document_id,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    workspace_id: UUID,
    document_id: UUID,
    _: WorkspaceMembership = Depends(
        require_workspace_permission(Permission.document_upload)
    ),
    session: AsyncSession = Depends(get_db),
) -> None:
    await document_service.delete_workspace_document(session, workspace_id, document_id)


@router.get("/{document_id}/download")
async def download_document(
    workspace_id: UUID,
    document_id: UUID,
    _: WorkspaceMembership = Depends(
        require_workspace_permission(Permission.document_download)
    ),
    session: AsyncSession = Depends(get_db),
) -> Response:
    document = await document_service.get_workspace_document(session, workspace_id, document_id)
    if not document.storage_path:
        raise document_service.DocumentNotFoundError()

    file_bytes = storage.read_file(document.storage_path)
    return Response(
        content=file_bytes,
        media_type=document.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{document.filename}"',
        },
    )

