from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import Permission
from app.core.errors import InactiveUserError, InvalidAccessTokenError
from app.core.security import decode_access_token
from app.db.session import async_session_maker
from app.models.user import User
from app.models.workspace_membership import WorkspaceMembership
from app.services import permission_service

bearer_scheme = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provide a request-scoped async SQLAlchemy session."""
    async with async_session_maker() as session:
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise InvalidAccessTokenError()
    try:
        user_id = decode_access_token(credentials.credentials)
    except ValueError:
        raise InvalidAccessTokenError()

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise InvalidAccessTokenError()
    if not user.is_active:
        raise InactiveUserError()
    return user


def require_workspace_permission(permission: Permission):
    async def guard(
        workspace_id: UUID,
        current_user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_db),
    ) -> WorkspaceMembership:
        return await permission_service.ensure_workspace_permission(
            session,
            workspace_id,
            current_user.id,
            permission,
        )

    return guard
