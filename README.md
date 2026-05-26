# IntelVault

This repository contains the IntelVault backend (FastAPI) and frontend (React + Vite).

Quick start (development):

1. Start Postgres and ensure DATABASE_URL is set in `backend/.env`.
2. Create and activate Python virtualenv and install backend deps:

   ```powershell
   Set-Location backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

3. Run backend:

   ```powershell
   uvicorn app.main:app --reload --port 8000
   ```

4. Start frontend:

   ```powershell
   Set-Location frontend
   npm install
   npm run dev -- --host 0.0.0.0 --port 5173
   ```

Recent fixes included in this workspace:
- Frontend: improved robustness for Chat, Members, Shares and Audit tabs to match backend response shapes.

If you want, I can create a GitHub remote and push these changes — provide the remote URL or a GitHub repo name and I will push.
