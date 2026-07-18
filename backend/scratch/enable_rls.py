import asyncio
import sys
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

TABLES = [
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
]

async def enable_rls():
    db_url = settings.DATABASE_URL
    print(f"Connecting to database: {db_url.split('@')[-1]}")
    engine = create_async_engine(db_url)
    
    async with engine.begin() as conn:
        for table in TABLES:
            try:
                print(f"Enabling RLS on table: {table}...")
                await conn.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;"))
                print(f"Successfully enabled RLS on table: {table}")
            except Exception as e:
                print(f"Error enabling RLS on {table}: {e}")
                
    await engine.dispose()
    print("Done!")

if __name__ == "__main__":
    asyncio.run(enable_rls())
