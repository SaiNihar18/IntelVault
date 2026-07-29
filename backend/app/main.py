import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import IntelVaultError
from app.core.logging import setup_logging
from app.db.session import engine

from sqlalchemy import text

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("application_startup", extra={"app": settings.APP_NAME})
    
    # Automatically ensure RLS is enabled on all tables in public schema on startup
    try:
        async with engine.begin() as conn:
            tables = [
                "workspaces",
                "workspace_memberships",
                "documents",
                "document_versions",
                "document_chunks",
                "chat_sessions",
                "chat_messages",
                "document_share_links",
                "audit_events",
                "users",
                "refresh_tokens",
                "alembic_version"
            ]
            for table in tables:
                await conn.execute(text(f"ALTER TABLE IF EXISTS {table} ENABLE ROW LEVEL SECURITY;"))
        logger.info("row_level_security_enabled_on_startup_tables")
    except Exception as e:
        logger.error(f"failed_to_enable_row_level_security_on_startup: {e}")

    yield
    await engine.dispose()
    logger.info("application_shutdown", extra={"app": settings.APP_NAME})


def create_app() -> FastAPI:
    setup_logging(settings.LOG_LEVEL)

    app = FastAPI(
        title=settings.APP_NAME,
        version=__version__,
        lifespan=lifespan,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # FastAPI validation ctx may contain Exception objects that are not JSON serializable.
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": jsonable_encoder(exc.errors())},
        )

    @app.exception_handler(IntelVaultError)
    async def intelvault_error_handler(
        request: Request, exc: IntelVaultError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message},
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"Global unhandled exception: {exc}\n{tb}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": str(exc), "traceback": tb},
        )

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_app()
