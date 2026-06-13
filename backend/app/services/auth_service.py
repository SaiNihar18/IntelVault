import asyncio
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.config import settings
from app.core.errors import (
    EmailAlreadyRegisteredError,
    InactiveUserError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import TokenPair


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def _persist_refresh_token(
    session: AsyncSession,
    user_id: UUID,
    refresh_plain: str,
) -> None:
    token_hash = security.hash_refresh_token(refresh_plain)
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    row = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    session.add(row)


async def _issue_token_pair(session: AsyncSession, user: User) -> TokenPair:
    access_token, expires_in = security.create_access_token(user_id=user.id)
    refresh_plain = security.generate_refresh_token_value()
    await _persist_refresh_token(session, user.id, refresh_plain)
    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_plain,
        expires_in=expires_in,
    )


async def register(session: AsyncSession, email: str, password: str) -> TokenPair:
    email_norm = email.lower().strip()
    if await get_user_by_email(session, email_norm):
        raise EmailAlreadyRegisteredError()
    try:
        hashed_password = await asyncio.to_thread(security.hash_password, password)
        user = User(
            email=email_norm,
            hashed_password=hashed_password,
        )
        session.add(user)
        await session.flush()
        tokens = await _issue_token_pair(session, user)
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise EmailAlreadyRegisteredError()
    return tokens


async def login(session: AsyncSession, email: str, password: str) -> TokenPair:
    email_norm = email.lower().strip()
    user = await get_user_by_email(session, email_norm)
    
    is_valid = False
    if user is not None:
        is_valid = await asyncio.to_thread(security.verify_password, password, user.hashed_password)
        
    if not user or not is_valid:
        raise InvalidCredentialsError()
    if not user.is_active:
        raise InactiveUserError()

    tokens = await _issue_token_pair(session, user)
    await session.commit()
    return tokens


async def refresh(session: AsyncSession, refresh_token: str) -> TokenPair:
    token_hash = security.hash_refresh_token(refresh_token)
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    row = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if row is None or row.revoked_at is not None or row.expires_at <= now:
        raise InvalidRefreshTokenError()

    user_result = await session.execute(select(User).where(User.id == row.user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise InvalidRefreshTokenError()

    row.revoked_at = now
    tokens = await _issue_token_pair(session, user)
    await session.commit()
    return tokens


async def logout(session: AsyncSession, refresh_token: str) -> None:
    token_hash = security.hash_refresh_token(refresh_token)
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    row = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if row is not None and row.revoked_at is None:
        row.revoked_at = now
    await session.commit()
