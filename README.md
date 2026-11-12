# VERITAS — Verification and Evidence-based Real-time Information Trust Assessment System

> Independent news verification. No assumptions.

## Quick Start

### Backend (FastAPI + Python)

```bash
cd backend
py -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
# Edit .env — set your LLM_API_KEY
py start.py
```

Backend runs on http://127.0.0.1:8000

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

---

## Project Structure

```
Veritas/
├── backend/
│   ├── main.py                          # FastAPI app (all routes)
│   ├── start.py                         # Startup script (loads .env)
│   ├── requirements.txt
│   ├── .env                             # LLM_API_KEY (never commit)
│   ├── models/                          # ML model files (not included)
│   │   └── {task}_model.joblib          # Place trained sklearn models here
│   │   └── {task}_vectorizer.joblib
│   └── src/
│       ├── services/gemini_service.py   # Gemini API integration
│       ├── inference/engine.py          # ML classifier (sklearn)
│       └── input_processing/
│           ├── url_extractor.py         # Safe URL fetching (SSRF-protected)
│           └── image_ocr.py             # OCR (requires pytesseract)
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── LandingPage.jsx          # Input (text/URL/image)
    │   │   ├── WorkspacePage.jsx        # Pipeline progress
    │   │   └── ResultsPage.jsx          # Full results display
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── CredibilityMeter.jsx     # Animated score ring
    │   │   ├── ClaimCard.jsx
    │   │   ├── SourceCard.jsx
    │   │   ├── PipelineSteps.jsx
    │   │   ├── VerdictBadge.jsx
    │   │   └── Notice.jsx
    │   └── services/
    │       ├── api.js                   # API client
    │       └── history.js               # localStorage history
    └── dist/                            # Production build
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| GET | `/ready` | Model readiness status |
| POST | `/api/v1/analyze-text` | Gemini analysis |
| POST | `/api/v1/predict` | ML classification |
| POST | `/api/v1/extract-url` | Fetch article from URL |
| POST | `/api/v1/extract-image` | OCR image upload |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_API_KEY` | ✅ Yes | Google Gemini API key |
| `LLM_PROVIDER` | No | Always `gemini` |

---

## Security

- **API key**: Read server-side only from env. Never exposed to frontend.
- **SSRF protection**: URL fetcher blocks private IPs (127.x, 10.x, 192.168.x, etc.)
- **Prompt injection**: Input sanitized (control chars stripped) before Gemini
- **File uploads**: MIME validated, 10MB max, no path traversal
- **Error responses**: No stack traces, file paths, or internal details exposed
- **Request limits**: 48KB text, 10MB image max

---

## ML Models

Place trained sklearn models in `backend/models/`:
- `fever_claim_model.joblib` + `fever_claim_vectorizer.joblib`
- `liar_statement_model.joblib` + `liar_statement_vectorizer.joblib`  
- `tamil_xfact_model.joblib` + `tamil_xfact_vectorizer.joblib`

If models are absent, the API reports `model_unavailable` (not fake results).

---

## Running Tests

```bash
cd backend
.venv\Scripts\python.exe -m pytest tests/ -v
```
