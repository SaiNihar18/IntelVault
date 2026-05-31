# 🧠 IntelVault

**IntelVault** is a full-stack, AI-powered document intelligence and chat platform. It enables individuals and teams to securely organize workspaces, upload complex documents, and interact with a context-aware AI chatbot that retrieves precise answers directly from your files using Retrieval-Augmented Generation (RAG).

Whether you're analyzing legal contracts, parsing research papers, or exploring corporate wikis — IntelVault turns static documents into an interactive, searchable knowledge base.

> **🌐 Live Demo:** [https://intelvault.intelvault.workers.dev](https://intelvault.intelvault.workers.dev/login)

---

## ✨ Key Features

- **📂 Workspace Management** — Organize documents into isolated, access-controlled workspaces.
- **📄 Smart Document Processing** — Upload PDFs and text files that are automatically chunked, embedded, and indexed for semantic search.
- **🤖 Context-Aware AI Chat** — Ask questions and get precise answers powered by Groq's LLaMA model using RAG over your documents.
- **🔗 Document Sharing** — Generate expiring, token-based share links for individual documents.
- **📋 Audit Logs** — Track all workspace activity with a built-in event log.
- **⚡ Blazing Fast UI** — A highly responsive, modern interface built on TanStack Start and React 19.
- **🔒 Secure & Scalable** — JWT-based authentication, bcrypt password hashing, and a robust FastAPI backend with async PostgreSQL.

---

## 🛠️ Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 + TypeScript | UI Framework |
| TanStack Start | SSR Framework & Routing |
| TanStack Query | Data Fetching & Caching |
| Tailwind CSS + Radix UI | Styling & Components |
| Vite | Build Tool |
| Cloudflare Workers | Hosting & Edge Runtime |

### Backend
| Technology | Purpose |
|---|---|
| FastAPI (Python 3.11) | REST API Framework |
| SQLAlchemy + AsyncPG | Async ORM & PostgreSQL Driver |
| Alembic | Database Migrations |
| Supabase (PostgreSQL) | Hosted Database |
| Google Gemini | Text Embeddings |
| Groq (LLaMA 3.3 70B) | Chat Completions |
| PyJWT + bcrypt | Authentication |
| Render | Backend Hosting |

---

## 🌍 Deployments

| Service | URL |
|---|---|
| **Frontend** | [https://intelvault.intelvault.workers.dev](https://intelvault.intelvault.workers.dev/login) |
| **Backend API** | [https://intelvault.onrender.com](https://intelvault.onrender.com) |
| **API Health Check** | [https://intelvault.onrender.com/api/v1/health](https://intelvault.onrender.com/api/v1/health) |

---

## 🚀 Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- A PostgreSQL database (or Supabase account)
- Google Gemini API Key
- Groq API Key

---

### 1. Backend Setup

```bash
cd backend
```

**Create and activate a virtual environment:**
```bash
# Windows
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# macOS/Linux
python3 -m venv .venv
source .venv/bin/activate
```

**Install dependencies:**
```bash
pip install -r requirements.txt
```

**Set up environment variables** — copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

Key variables to set in `backend/.env`:
```ini
# PostgreSQL connection string (use asyncpg driver)
DATABASE_URL=postgresql+asyncpg://postgres:YourPassword@db.your-project.supabase.co:5432/postgres

# API Keys
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
LLM_PROVIDER=groq

# JWT Security (must be at least 32 characters)
JWT_SECRET=your-very-long-secret-key-at-least-32-chars

# CORS (your frontend URL)
CORS_ORIGINS=http://localhost:5173
```

**Start the backend:**
```bash
uvicorn app.main:app --reload --port 8000
```
*API running at `http://localhost:8000` — docs at `http://localhost:8000/docs`*

---

### 2. Frontend Setup

```bash
cd frontend
npm install
```

**Set up environment variables** — create `frontend/.env`:
```ini
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

**Start the development server:**
```bash
npm run dev
```
*Frontend running at `http://localhost:5173`*

---

## ☁️ Production Deployment

### Backend — Render

1. Log in to [Render](https://render.com) → **New → Web Service**.
2. Connect your GitHub repository.
3. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables:
   - `DATABASE_URL` — Your Supabase pooler connection string (`postgresql+asyncpg://...` on port `6543`)
   - `GEMINI_API_KEY`, `GROQ_API_KEY`, `LLM_PROVIDER=groq`
   - `JWT_SECRET` — Long random string (32+ chars)
   - `CORS_ORIGINS` — Your frontend URL (e.g. `https://intelvault.intelvault.workers.dev`)
   - `PYTHON_VERSION=3.11.0`
   - `PYTHONUNBUFFERED=1`

> ⚠️ **Supabase Note:** Use the **Pooler** connection string (port `6543`), not the direct connection (port `5432`). Render's network does not support IPv6, which Supabase's direct connections require.

---

### Frontend — Cloudflare Workers

1. Log in to [Cloudflare](https://dash.cloudflare.com) → **Workers & Pages → Create**.
2. Connect your GitHub repository.
3. Configure:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Build Output Directory:** `dist/client`
   - **Worker Entry Point:** `src/server.ts`
4. Add environment variable:
   - `VITE_API_BASE_URL` — Your Render backend URL with prefix: `https://intelvault.onrender.com/api/v1`

---

## 📄 License

This project is licensed under the MIT License.
