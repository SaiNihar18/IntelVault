# 🧠 IntelVault

![IntelVault Banner](https://via.placeholder.com/1200x300.png?text=IntelVault+-+AI+Powered+Document+Intelligence)

**IntelVault** is a full-stack, AI-powered document intelligence and chat application. It allows individuals and teams to securely manage workspaces, upload complex documents, and seamlessly converse with an AI chatbot that retrieves accurate, context-aware information directly from your files.

Whether you're analyzing legal contracts, parsing research papers, or exploring corporate wikis, IntelVault turns static documents into an interactive knowledge base.

---

## ✨ Key Features
- **📂 Workspace Management:** Organize your documents into isolated workspaces.
- **📄 Smart Document Processing:** Upload and automatically process PDFs and text documents into searchable embeddings.
- **🤖 Context-Aware AI Chat:** Ask questions and get precise answers powered by state-of-the-art LLMs (Gemini, Groq) using Retrieval-Augmented Generation (RAG).
- **⚡ Blazing Fast UI:** A highly responsive, modern interface built on React, TypeScript, and Vite.
- **🔒 Secure & Scalable:** A robust FastAPI backend backed by PostgreSQL and Supabase.

---

## 🛠️ Technology Stack

**Frontend**
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State & Data Fetching:** React Query / Context API

**Backend**
- **Framework:** FastAPI (Python 3.11+)
- **Database:** PostgreSQL (hosted via Supabase)
- **ORM:** SQLAlchemy with AsyncPG
- **AI Integration:** Google Gemini (Embeddings & Vision), Groq (Fast Chat Completions)

---

## 🚀 Local Development Setup

### 1. Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   ```bash
   # Windows
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   
   # macOS/Linux
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables:**
   Create a `.env` file in the `backend/` directory by copying `.env.example`:
   ```bash
   cp .env.example .env
   ```
   **Update the `.env` file with your credentials:**
   ```ini
   # Use your Supabase PostgreSQL connection string
   DATABASE_URL=postgresql+asyncpg://postgres:YourEncodedPassword@db.your-supabase-url.co:5432/postgres
   
   GEMINI_API_KEY=your_gemini_api_key_here
   GROQ_API_KEY=your_groq_api_key_here
   LLM_PROVIDER=groq
   
   # Required for Security
   JWT_SECRET=your-very-long-secret-key-that-is-at-least-32-chars-long
   ```

5. **Start the backend server:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *The API will be running at `http://localhost:8000`*

---

### 2. Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env` file in the `frontend/` directory:
   ```ini
   VITE_API_URL=http://localhost:8000
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   *The frontend will be running at `http://localhost:5173`*

---

## 🌍 Deployment Guide

### Deploying the Backend (Render)
Render is an excellent platform for hosting FastAPI web services.

1. Log in to [Render](https://render.com) and click **New > Web Service**.
2. Connect your GitHub repository and select `IntelVault`.
3. **Configuration:**
   - **Name:** intelvault-api
   - **Root Directory:** `backend` (⚠️ Important)
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. **Environment Variables (Advanced):**
   - `DATABASE_URL` (Your Supabase connection string)
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
   - `LLM_PROVIDER` (Set to `groq`)
   - `JWT_SECRET` (A secure random string > 32 characters)
   - `CORS_ORIGINS` (Your Vercel URL, e.g., `https://intelvault-web.vercel.app`)
   - `PYTHON_VERSION` (Set to `3.11.0`)
5. Click **Create Web Service**.

---

### Deploying the Frontend (Vercel)
Vercel is optimized for Vite applications.

1. Log in to [Vercel](https://vercel.com) and click **Add New > Project**.
2. Import your `IntelVault` GitHub repository.
3. **Configuration:**
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend` (⚠️ Important)
4. **Environment Variables:**
   - Name: `VITE_API_URL`
   - Value: `https://intelvault-api.onrender.com` (Your Render URL)
5. Click **Deploy**. Vercel will build and provide a live URL.

---

## 📄 License
This project is licensed under the MIT License.
