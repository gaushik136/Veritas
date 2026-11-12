# Deploying VERITAS to Render.com

You can deploy VERITAS to Render in two ways:

---

## 🌟 Method 1: All-in-One Web Service (Recommended & Free-Tier Friendly)
This deploys both the React Frontend and FastAPI Backend onto a single free Render Web Service.

### In Render Dashboard:
1. Click **New +** > **Web Service**.
2. Connect your GitHub repository containing the `Veritas` code.
3. Configure the following fields:

| Field | Value |
| :--- | :--- |
| **Name** | `veritas-app` (or any name you choose) |
| **Region** | Oregon (or closest to you) |
| **Branch** | `main` |
| **Root Directory** | *(leave blank)* |
| **Runtime** | `Python` |
| **Build Command** | `cd frontend && npm install && npm run build && cd ../backend && pip install -r requirements.txt` |
| **Start Command** | `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | `Free` |

4. Under **Environment Variables**, add:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `LLM_API_KEY` | `AQ.Ab8RN6LwNFj6EM_...` | Your Google Gemini API Key |
| `LLM_PROVIDER` | `gemini` | Required |
| `PYTHON_VERSION` | `3.11.9` | Ensures compatible Python environment |
| `NODE_VERSION` | `20.12.0` | Ensures modern Node.js for Vite build |

5. Click **Create Web Service**.
*Render will build the React frontend into static assets, install backend dependencies, and launch FastAPI on the dynamically assigned `$PORT`.*

---

## 🚀 Method 2: Two Separate Services (Backend API + Static Site Frontend)
Use this if you prefer decoupling the frontend and backend.

### Service 1: Backend API (Web Service)
1. Click **New +** > **Web Service**.
2. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`
3. Environment Variables:
   - `LLM_API_KEY`: *(Your Gemini API key)*
   - `LLM_PROVIDER`: `gemini`
   - `ALLOW_ALL_ORIGINS`: `true`
   - `PYTHON_VERSION`: `3.11.9`
4. Copy the resulting URL (e.g., `https://veritas-api.onrender.com`).

### Service 2: Frontend UI (Static Site)
1. Click **New +** > **Static Site**.
2. Settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
3. Environment Variables:
   - `VITE_API_BASE_URL`: `https://veritas-api.onrender.com` *(your Backend URL from Step 1)*
4. Under **Redirects/Rewrites**:
   - Add Rewrite: `/*` -> `/index.html` (Status: `200`) so React Router navigation works properly.
