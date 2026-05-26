from __future__ import annotations

from enum import Enum

from app.core.rbac import WorkspaceRole


class Permission(str, Enum):
    workspace_create = "workspace:create"
    workspace_view = "workspace:view"
    member_invite = "member:invite"
    member_update_role = "member:update_role"
    document_upload = "document:upload"
    document_view = "document:view"
    document_download = "document:download"
    document_ask = "document:ask"
    document_share = "document:share"
    document_manage = "document:manage"
    audit_view = "audit:view"


ROLE_PERMISSIONS: dict[str, set[Permission]] = {
    WorkspaceRole.owner.value: {
        Permission.workspace_view,
        Permission.member_invite,
        Permission.member_update_role,
        Permission.document_upload,
        Permission.document_view,
        Permission.document_download,
        Permission.document_ask,
        Permission.document_share,
        Permission.document_manage,
        Permission.audit_view,
    },
    WorkspaceRole.analyst.value: {
        Permission.workspace_view,
        Permission.document_upload,
        Permission.document_view,
        Permission.document_download,
        Permission.document_ask,
        Permission.document_share,
    },
    WorkspaceRole.reviewer.value: {
        Permission.workspace_view,
        Permission.document_view,
        Permission.document_download,
        Permission.document_ask,
    },
    WorkspaceRole.guest.value: {
        Permission.workspace_view,
        Permission.document_view,
        Permission.document_ask,
    },
}
