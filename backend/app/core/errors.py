"""Application-specific errors raised from services (mapped to HTTP in main)."""


class IntelVaultError(Exception):
    """Base error with HTTP status for API responses."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class EmailAlreadyRegisteredError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("Email already registered", status_code=409)


class InvalidCredentialsError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("Incorrect email or password", status_code=401)


class InactiveUserError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("User account is disabled", status_code=403)


class InvalidRefreshTokenError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("Invalid or expired refresh token", status_code=401)


class InvalidAccessTokenError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("Could not validate credentials", status_code=401)


class WorkspaceError(IntelVaultError):
    pass


class WorkspaceMemberRequiredError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("You are not a member of this workspace", status_code=403)


class PermissionDeniedError(IntelVaultError):
    def __init__(self, permission: str) -> None:
        super().__init__(f"Missing required permission: {permission}", status_code=403)


class ShareLinkError(IntelVaultError):
    pass


class ShareLinkNotFoundError(ShareLinkError):
    def __init__(self) -> None:
        super().__init__("Share link not found", status_code=404)


class ShareLinkInvalidError(ShareLinkError):
    def __init__(self) -> None:
        super().__init__("Share link is invalid or expired", status_code=410)


class SharedDocumentFileNotFoundError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("Shared document file is unavailable", status_code=404)
