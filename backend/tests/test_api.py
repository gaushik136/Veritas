"""End-to-end API tests using TestClient."""
import json
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import create_app
from src.inference.engine import InferenceEngine, PredictionResult


def make_mock_engine(loaded_tasks=None):
    engine = MagicMock(spec=InferenceEngine)
    engine.loaded_tasks = frozenset(loaded_tasks or [])
    return engine


def test_health():
    app = create_app()
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_ready_no_models():
    engine = make_mock_engine([])
    app = create_app(lambda: engine)
    client = TestClient(app)
    r = client.get("/ready")
    assert r.status_code == 200
    assert r.json()["ml_tasks"] == []


def test_predict_model_unavailable():
    engine = make_mock_engine([])
    from src.inference.engine import InferenceInputError
    engine.predict.side_effect = InferenceInputError("model_unavailable", "Model not loaded.")
    app = create_app(lambda: engine)
    client = TestClient(app)
    r = client.post("/api/v1/predict", json={"task": "fever_claim", "text": "Test claim"})
    assert r.status_code in (422, 503)
    assert "error" in r.json()


def test_predict_unsupported_task():
    engine = make_mock_engine(["fever_claim"])
    app = create_app(lambda: engine)
    client = TestClient(app)
    r = client.post("/api/v1/predict", json={"task": "not_a_task", "text": "test"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "unsupported_task"


def test_analyze_text_no_key():
    app = create_app()
    client = TestClient(app)
    with patch.dict(os.environ, {}, clear=True):
        # Remove API key env vars
        env = {k: v for k, v in os.environ.items() if k not in ("LLM_API_KEY", "GEMINI_API_KEY")}
        with patch.dict(os.environ, env, clear=True):
            r = client.post("/api/v1/analyze-text", json={"text": "Test news article."})
            # Should return an error (not fake data)
            assert r.status_code >= 400
            assert "error" in r.json()


def test_analyze_text_too_long():
    app = create_app()
    client = TestClient(app)
    r = client.post("/api/v1/analyze-text", json={"text": "x" * 10_001})
    assert r.status_code == 413


def test_extract_url_invalid_scheme():
    app = create_app()
    client = TestClient(app)
    r = client.post("/api/v1/extract-url", json={"url": "file:///etc/passwd"})
    assert r.status_code in (422, 403)
    data = r.json()
    assert "error" in data


def test_extract_url_private_ip():
    app = create_app()
    client = TestClient(app)
    r = client.post("/api/v1/extract-url", json={"url": "http://192.168.1.1/"})
    assert r.status_code in (422, 403)
    assert "error" in r.json()


def test_extract_url_localhost_blocked():
    app = create_app()
    client = TestClient(app)
    r = client.post("/api/v1/extract-url", json={"url": "http://127.0.0.1:8000/health"})
    assert r.status_code in (403, 422)


def test_predict_text_too_long():
    engine = make_mock_engine(["fever_claim"])
    app = create_app(lambda: engine)
    client = TestClient(app)
    r = client.post("/api/v1/predict", json={"task": "fever_claim", "text": "x" * 10_001})
    assert r.status_code == 413


def test_no_stack_trace_in_error():
    """Errors must not expose implementation details."""
    app = create_app()
    client = TestClient(app)
    r = client.post("/api/v1/analyze-text", json={"text": "test"})
    if r.status_code >= 400:
        body = r.text
        assert "Traceback" not in body
        assert "File \"" not in body
        assert "/src/" not in body
