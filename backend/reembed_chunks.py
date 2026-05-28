import asyncio
import sys
import os
import time

# Add backend root to python path to resolve imports correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from app.db.session import async_session_maker
from app.models.document_chunk import DocumentChunk
from app.services.embedding_service import get_embedding_provider

async def main():
    print("Initializing embedding provider...")
    provider = get_embedding_provider()
    provider_name = provider.__class__.__name__
    print(f"Using provider: {provider_name}")

    if provider_name == "DeterministicEmbeddingProvider":
        print("WARNING: GeminiEmbeddingProvider is not active. Please ensure GEMINI_API_KEY is configured in your .env file.")
        print("Aborting database re-embedding.")
        return

    async with async_session_maker() as session:
        print("Querying document chunks from database...")
        stmt = select(DocumentChunk)
        result = await session.execute(stmt)
        chunks = result.scalars().all()
        total = len(chunks)
        print(f"Found {total} chunks to re-embed.")

        if total == 0:
            print("No chunks found. Nothing to do.")
            return

        success_count = 0
        for i, chunk in enumerate(chunks, 1):
            print(f"[{i}/{total}] Embedding chunk ID: {chunk.id} (length: {len(chunk.content)})...")
            try:
                # Generate new embedding
                embeddings = provider.embed_texts([chunk.content])
                if embeddings and len(embeddings[0]) == 128:
                    chunk.embedding = embeddings[0]
                    session.add(chunk)
                    success_count += 1
                else:
                    print(f"  Error: Generated embedding size is incorrect or empty.")
            except Exception as e:
                print(f"  Failed to embed chunk {chunk.id}: {e}")

            # Sleep slightly to prevent hitting free-tier 429 rate limits
            await asyncio.sleep(0.5)

            # Flush and commit periodically or at the end
            if i % 10 == 0:
                print("  Flushing batch to database...")
                await session.commit()

        # Final commit
        await session.commit()
        print(f"\nCompleted! Successfully re-embedded {success_count} out of {total} chunks.")

if __name__ == "__main__":
    asyncio.run(main())
