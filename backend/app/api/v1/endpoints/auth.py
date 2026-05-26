from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    RefreshRequest,
    TokenPair,
    UserLogin,
    UserPublic,
    UserRegister,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=TokenPair,
    status_code=status.HTTP_201_CREATED,
    summary="Create account and receive tokens",
)
async def register(
    body: UserRegister,
    session: AsyncSession = Depends(get_db),
) -> TokenPair:
    return await auth_service.register(session, body.email, body.password)


@router.post("/login", response_model=TokenPair, summary="Sign in")
async def login(
    body: UserLogin,
    session: AsyncSession = Depends(get_db),
) -> TokenPair:
    return await auth_service.login(session, body.email, body.password)


@router.post("/refresh", response_model=TokenPair, summary="Rotate refresh token and get new access token")
async def refresh_tokens(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_db),
) -> TokenPair:
    return await auth_service.refresh(session, body.refresh_token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke a refresh token",
)
async def logout(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_db),
) -> Response:
    await auth_service.logout(session, body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserPublic, summary="Current user profile")
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
