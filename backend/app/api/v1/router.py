from fastapi import APIRouter

from app.api.v1.endpoints import audit, auth, chat, documents, health, shares, workspaces

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(workspaces.router)
api_router.include_router(documents.router)
api_router.include_router(chat.router)
api_router.include_router(shares.workspace_router)
api_router.include_router(shares.router)
api_router.include_router(audit.router)
