<div align="center">

<img src="frontend/public/favicon.svg" width="72" height="72" alt="IntelVault logo" />

# IntelVault

Secure document workspaces with retrieval-grounded AI chat.

[Live App](https://intelvault.intelvault.workers.dev/login) &nbsp;·&nbsp; [API Health](https://intelvault.onrender.com/api/v1/health) &nbsp;·&nbsp; [API Docs](https://intelvault.onrender.com/docs)

</div>

---

## What this is

IntelVault is a workspace-based document platform. Teams upload PDFs, images, and text files into isolated workspaces, the backend chunks and embeds them, and a chat interface answers questions by retrieving the actual passages that support the answer, not by guessing from a model's training data. Every workspace has role-based membership, every document can be shared through an expiring token link, and every meaningful action (uploads, invites, deletions, shares) lands in an audit log tied to the workspace.

It's built as two independently deployable pieces: a FastAPI backend that owns auth, storage, retrieval and chat, and a TanStack Start frontend that renders the UI and talks to it over a REST API.

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Request flow: asking a question](#request-flow-asking-a-question)
- [Tech stack](#tech-stack)
- [Access control](#access-control)
- [API surface](#api-surface)
- [Project layout](#project-layout)
- [Running it locally](#running-it-locally)
- [Configuration reference](#configuration-reference)
- [Deploying](#deploying)
- [License](#license)

---

## Features

| Area | What it does |
|---|---|
| Workspaces | Isolated containers for documents, chats, members and audit history. Users can belong to several. |
| Document ingestion | PDF, PNG, JPG, WEBP, TXT, MD, CSV, JSON and log files are parsed, chunked and embedded automatically after upload. |
| OCR fallback | Pages with little or no extractable text run through Gemini Vision first, then Tesseract, so scanned pages and screenshots still get indexed. |
| RAG chat | Questions are answered from retrieved chunks only. Greetings and general-knowledge questions skip retrieval and are answered directly, without fake citations. |
| Hybrid retrieval | Cosine similarity over embeddings blended with lexical keyword overlap, with an optional Cohere rerank pass on the top candidates. |
| Document versioning | Re-processing a document creates a new version; retrieval always reads from the latest ready version. |
| Share links | Per-document, token-based links with an expiry time and an optional max-use count. No account needed to open one. |
| Role-based access | Four roles per workspace (owner, analyst, reviewer, guest), each mapped to a fixed permission set enforced on every endpoint. |
| Audit log | Every upload, share, invite, role change and chat query is recorded per workspace with the actor and timestamp. |
| Row-level security | Postgres RLS is enabled on every table at startup as a defense-in-depth layer under the app-level checks. |

## Architecture

```mermaid
flowchart LR
    subgraph Client
        UI[React 19 + TanStack Start]
    end

    subgraph Edge
        CF[Cloudflare Workers]
    end

    subgraph API["FastAPI backend (Render)"]
        AUTH[Auth<br/>JWT + refresh tokens]
        WS[Workspaces & RBAC]
        DOC[Document service]
        PROC[Background processing<br/>parse -> chunk -> embed]
        RET[Retrieval<br/>vector + lexical + rerank]
        CHAT[Chat service]
    end

    subgraph Data
        PG[(PostgreSQL<br/>Supabase)]
        FS[(File storage<br/>Supabase Storage or local disk)]
    end

    subgraph External
        GEM[Gemini<br/>embeddings + vision OCR]
        GROQ[Groq LLaMA<br/>chat completions]
        COH[Cohere<br/>rerank, optional]
    end

    UI -->|HTTPS / JSON| CF --> AUTH
    AUTH --> WS --> DOC
    DOC --> FS
    DOC -.uploads trigger.-> PROC
    PROC --> GEM
    PROC --> PG
    CHAT --> RET --> PG
    RET --> GEM
    RET --> COH
    CHAT --> GROQ
    CHAT --> PG
```

## Request flow: asking a question

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as FastAPI
    participant R as Retrieval
    participant D as Postgres
    participant L as Groq LLM

    U->>F: Type a question
    F->>B: POST /workspaces/{id}/chat/messages
    B->>B: Check membership + permission
    B->>D: Save user message
    alt Greeting or small talk
        B->>L: Ask directly, no context
    else Needs document context
        B->>R: retrieve_relevant_chunks(question)
        R->>D: Fetch latest-version chunks + embeddings
        R->>R: Cosine similarity + keyword overlap
        opt Cohere key configured
            R->>R: Rerank top candidates
        end
        R-->>B: Ranked chunks with scores
        B->>L: Ask with chunk context attached
    end
    L-->>B: Answer text
    B->>D: Save assistant message + sources
    B->>D: Log chat.question_asked audit event
    B-->>F: Answer + cited sources
    F-->>U: Render answer with source chips
```

## Tech stack

**Frontend**

| Technology | Role |
|---|---|
| React 19 + TypeScript | UI layer |
| TanStack Start | SSR framework and file-based routing |
| TanStack Query | Server state, caching, mutations |
| Tailwind CSS v4 + Radix UI | Styling and accessible primitives |
| react-markdown + remark-gfm | Rendering chat responses |
| Vite | Dev server and bundler |
| Cloudflare Workers | Edge hosting |

**Backend**

| Technology | Role |
|---|---|
| FastAPI (Python 3.11) | REST API framework |
| SQLAlchemy 2.x (async) + asyncpg | ORM and Postgres driver |
| Alembic | Schema migrations, run automatically on startup |
| PostgreSQL (Supabase) | Primary datastore, with row-level security enabled |
| PyMuPDF + Pillow + Pytesseract | PDF parsing and local OCR |
| Gemini | Text embeddings and vision-based OCR for scanned pages |
| Groq (LLaMA / GPT-OSS) | Chat completions |
| Cohere | Optional reranking of retrieved chunks |
| PyJWT + bcrypt | Access/refresh token auth, password hashing |
| Render | Backend hosting |

## Access control

Every workspace member has exactly one role, and every API route checks a specific permission rather than checking the role directly. This keeps the permission list in one place ([`app/core/permissions.py`](backend/app/core/permissions.py)) instead of scattered across route handlers.

| Permission | Owner | Analyst | Reviewer | Guest |
|---|:---:|:---:|:---:|:---:|
| View workspace | ✓ | ✓ | ✓ | ✓ |
| Ask the AI chat | ✓ | ✓ | ✓ | ✓ |
| Upload / delete documents | ✓ | ✓ | | |
| Download documents | ✓ | ✓ | ✓ | |
| Create share links | ✓ | ✓ | | |
| Invite / change member roles | ✓ | | | |
| View audit log | ✓ | | | |
| Delete workspace | ✓ | | | |

## API surface

All routes are mounted under `/api/v1`. Full interactive docs are available at `/docs` when `DEBUG=true`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Create an account, receive a token pair |
| POST | `/auth/login` | Sign in |
| POST | `/auth/refresh` | Rotate a refresh token for a new access token |
| POST | `/auth/logout` | Revoke a refresh token |
| GET | `/auth/me` | Current user profile |
| POST | `/workspaces` | Create a workspace |
| GET | `/workspaces` | List workspaces the user belongs to |
| GET | `/workspaces/{id}` | Workspace detail with members |
| POST | `/workspaces/{id}/members` | Invite a member by email |
| PATCH | `/workspaces/{id}/members/{userId}/role` | Change a member's role |
| DELETE | `/workspaces/{id}` | Delete a workspace |
| POST | `/workspaces/{id}/documents` | Upload a document, kicks off async processing |
| GET | `/workspaces/{id}/documents` | List documents in a workspace |
| GET | `/workspaces/{id}/documents/{docId}/download` | Download the original file |
| DELETE | `/workspaces/{id}/documents/{docId}` | Delete a document |
| POST | `/workspaces/{id}/chat/messages` | Ask a question, get a grounded answer with sources |
| GET | `/workspaces/{id}/chat/sessions` | List chat sessions |
| GET | `/workspaces/{id}/chat/sessions/{id}/messages` | Message history for a session |
| POST | `/workspaces/{id}/documents/{docId}/shares` | Create an expiring share link |
| GET | `/shares/{token}` | Resolve a share link, no auth required |
| GET | `/workspaces/{id}/audit` | Workspace audit log |
| GET | `/health` | Liveness probe |
| GET | `/health/ready` | Readiness probe, checks the database |

## Project layout

```
IntelVault/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/     # Route handlers, one file per resource
│   │   ├── core/                 # Config, RBAC, permissions, security, errors
│   │   ├── models/                # SQLAlchemy ORM models
│   │   ├── schemas/                # Pydantic request/response models
│   │   ├── services/              # Business logic: parsing, chunking, retrieval, chat
│   │   └── main.py                # App factory, middleware, startup migrations
│   ├── alembic/                   # Migration scripts
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── routes/                 # File-based TanStack Router routes
    │   ├── components/tabs/       # Workspace tab views: Documents, Chat, Members, Shares, Audit
    │   ├── components/ui/          # Radix-based UI primitives
    │   ├── hooks/api.ts             # TanStack Query hooks for every endpoint
    │   └── lib/                    # Auth context, API client
    └── package.json
```

## Running it locally

**Prerequisites:** Python 3.11+, Node.js 18+, a PostgreSQL database (Supabase works well), and API keys for Gemini and Groq.

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # then fill in the values below
uvicorn app.main:app --reload --port 8000
```

The backend applies Alembic migrations automatically on startup. API runs at `http://localhost:8000`, docs at `http://localhost:8000/docs`.

Minimum required values in `backend/.env`:

```ini
DATABASE_URL=postgresql+asyncpg://postgres:password@db.your-project.supabase.co:5432/postgres
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
LLM_PROVIDER=groq
JWT_SECRET=a-random-string-at-least-32-characters-long
CORS_ORIGINS=http://localhost:5173
```

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:8000/api/v1" > .env
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Configuration reference

Every setting below lives in [`backend/app/core/config.py`](backend/app/core/config.py) and has a matching entry in `backend/.env.example`.

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | required | Must use the `postgresql+asyncpg://` scheme |
| `JWT_SECRET` | required | 32+ characters, signs both access and refresh tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
| `LLM_PROVIDER` | `deterministic` | `deterministic` (no API calls, for offline testing) or `groq` |
| `GEMINI_API_KEY` | empty | Enables real embeddings and vision OCR; falls back to deterministic hashed embeddings if unset |
| `GROQ_API_KEY` | empty | Required when `LLM_PROVIDER=groq` |
| `ENABLE_OCR` | `false` | Runs OCR on PDF pages with little extractable text |
| `CHUNK_SIZE_CHARS` / `CHUNK_OVERLAP_CHARS` | `1200` / `200` | Chunking window for embeddings |
| `RETRIEVAL_TOP_K` | `5` | Chunks returned to the LLM per question |
| `RETRIEVAL_MIN_SCORE` | `0.02` | Minimum hybrid score to keep a chunk |
| `RETRIEVAL_LEXICAL_WEIGHT` | `0.25` | Weight given to keyword overlap vs. cosine similarity |
| `COHERE_API_KEY` | empty | Optional reranking pass over the top 20 candidates |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | empty | Leave blank to store files on local disk instead |

## Deploying

**Backend on Render**

1. New Web Service, root directory `backend`.
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Set `DATABASE_URL` to Supabase's **pooler** connection string on port `6543`, not the direct connection on `5432`. Render's network doesn't support the IPv6 that Supabase's direct connection needs.
5. Add `GEMINI_API_KEY`, `GROQ_API_KEY`, `LLM_PROVIDER=groq`, `JWT_SECRET`, `CORS_ORIGINS`, `PYTHON_VERSION=3.11.0`, `PYTHONUNBUFFERED=1`.

Render's free tier spins the service down after inactivity. A cold start takes 30 to 60 seconds; hit `GET /api/v1/health` to wake it up.

**Frontend on Cloudflare Workers**

1. Workers & Pages, connect the repo, root directory `frontend`.
2. Build command: `npm run build`, output directory `dist/client`, worker entry `src/server.ts`.
3. Set `VITE_API_BASE_URL` to the Render backend URL plus `/api/v1`.

**Current deployment**

| Service | URL |
|---|---|
| Frontend | https://intelvault.intelvault.workers.dev |
| Backend API | https://intelvault.onrender.com |
| Health check | https://intelvault.onrender.com/api/v1/health |

## License

MIT
