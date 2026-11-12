"""VERITAS - Verification and Evidence-based Real-time Information Trust Assessment System.

FastAPI backend providing news analysis via Gemini and ML classification.
"""
from __future__ import annotations
import os
from pathlib import PurePosixPath
from email import policy
from email.parser import BytesParser
from typing import Any
import re

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.concurrency import run_in_threadpool

from src.inference.engine import InferenceEngine, InferenceInputError, get_default_engine, SUPPORTED_TASKS
from src.input_processing.image_ocr import ImageOCRError, MAX_UPLOAD_BYTES, extract_image
from src.input_processing.url_extractor import URLExtractionError, extract_article
from src.services.gemini_service import GeminiServiceError, GeminiAnalysisResult, analyze_news_text, _load_env_fallback

# Ensure environment is loaded on import
_load_env_fallback()

DEVELOPMENT_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
)
MAX_MULTIPART_BYTES = MAX_UPLOAD_BYTES + 64 * 1024
MAX_TEXT_REQUEST_BYTES = 48 * 1024


class AnalyzeTextRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=10_000)


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    task: str = Field(min_length=1, max_length=64)
    text: str = Field(min_length=1, max_length=10_000)


class URLExtractionRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)


async def _read_limited(request: Request, limit: int) -> bytes:
    length = request.headers.get("content-length")
    if length:
        try:
            if int(length) > limit:
                raise ValueError("request_too_large")
        except ValueError as exc:
            if str(exc) == "request_too_large":
                raise
            raise ValueError("invalid_content_length") from None
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > limit:
            raise ValueError("request_too_large")
    return bytes(body)


def _err(code: str, msg: str, status: int) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": msg}})


def create_app(engine_provider=get_default_engine) -> FastAPI:
    app = FastAPI(
        title="VERITAS API",
        version="1.0.0",
        description="Verification and Evidence-based Real-time Information Trust Assessment System",
    )
    app.state.engine_provider = engine_provider

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(DEVELOPMENT_ORIGINS),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        too_long = any(e.get("type") == "string_too_long" for e in exc.errors())
        return JSONResponse(
            status_code=413 if too_long else 422,
            content={"error": {"code": "text_too_long" if too_long else "invalid_request",
                               "message": "Text must be non-empty and ≤10,000 characters."}},
        )

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": "VERITAS API"}

    @app.get("/ready")
    async def ready(request: Request) -> JSONResponse:
        try:
            engine = request.app.state.engine_provider()
            loaded = list(engine.loaded_tasks)
        except Exception:
            return JSONResponse(status_code=503, content={
                "status": "not_ready",
                "error": {"code": "model_unavailable", "message": "Classification models are not available."},
            })
        gemini_configured = bool(os.environ.get("LLM_API_KEY") or os.environ.get("GEMINI_API_KEY"))
        return JSONResponse(status_code=200, content={
            "status": "ready",
            "ml_tasks": loaded,
            "gemini_configured": gemini_configured,
        })

    @app.post("/api/v1/analyze-text")
    async def analyze_text(request: Request) -> Any:
        if "application/json" not in (request.headers.get("content-type") or "").lower():
            return _err("invalid_content_type", "Send a JSON body with a 'text' field.", 415)
        try:
            raw = await _read_limited(request, MAX_TEXT_REQUEST_BYTES)
        except ValueError:
            return _err("request_too_large", "Request exceeds size limit.", 413)
        try:
            payload = AnalyzeTextRequest.model_validate_json(raw)
        except ValidationError as exc:
            too_long = any(e.get("type") == "string_too_long" for e in exc.errors())
            return _err("text_too_long" if too_long else "invalid_text",
                        "Text must be non-empty and ≤10,000 characters.", 413 if too_long else 422)
        try:
            result = await run_in_threadpool(analyze_news_text, payload.text)
        except GeminiServiceError as exc:
            return _err(exc.code, str(exc), exc.status_code)
        except Exception:
            return _err("analysis_error", "Text analysis could not be completed.", 500)
        return result.model_dump()

    @app.post("/api/v1/predict")
    async def predict(request: Request) -> Any:
        if "application/json" not in (request.headers.get("content-type") or "").lower():
            return _err("invalid_content_type", "Send a JSON body with task and text.", 415)
        try:
            raw = await _read_limited(request, MAX_TEXT_REQUEST_BYTES)
        except ValueError:
            return _err("request_too_large", "Request exceeds size limit.", 413)
        try:
            payload = PredictRequest.model_validate_json(raw)
        except ValidationError as exc:
            too_long = any(e.get("type") == "string_too_long" for e in exc.errors())
            return _err("text_too_long" if too_long else "invalid_request",
                        "Text must be non-empty and ≤10,000 characters.", 413 if too_long else 422)
        if payload.task not in SUPPORTED_TASKS:
            return _err("unsupported_task", f"Supported tasks: {', '.join(SUPPORTED_TASKS)}", 422)
        try:
            engine = request.app.state.engine_provider()
        except Exception:
            return _err("model_unavailable", "Classification models are currently unavailable.", 503)
        try:
            result = engine.predict(payload.task, payload.text)
        except InferenceInputError as exc:
            status = 413 if exc.code == "text_too_long" else 422
            return _err(exc.code, str(exc), status)
        except Exception:
            return _err("inference_error", "Prediction could not be completed.", 500)
        return JSONResponse(status_code=200, content=result.as_dict())

    @app.post("/api/v1/extract-url")
    async def extract_url(request: Request) -> Any:
        if "application/json" not in (request.headers.get("content-type") or "").lower():
            return _err("invalid_content_type", "Send a JSON body with a 'url' field.", 415)
        try:
            raw = await _read_limited(request, 32 * 1024)
            payload = URLExtractionRequest.model_validate_json(raw)
        except ValueError:
            return _err("request_too_large", "Request too large.", 413)
        except Exception:
            return _err("invalid_request", "Request must include a valid URL.", 422)
        try:
            result = await run_in_threadpool(extract_article, payload.url)
        except URLExtractionError as exc:
            return _err(exc.code, str(exc), exc.status_code)
        except Exception:
            return _err("extraction_error", "Article could not be extracted.", 500)
        return {
            "extraction_status": result.status,
            "original_url": result.original_url,
            "canonical_url": result.canonical_url,
            "article_title": result.title,
            "publisher": result.publisher,
            "extracted_text": result.text,
            "detected_language": result.language,
            "warnings": [w for w in result.warnings if w],
        }

    @app.post("/api/v1/extract-image")
    async def extract_image_route(request: Request) -> Any:
        ct = request.headers.get("content-type") or ""
        if not ct.lower().startswith("multipart/form-data") or "boundary=" not in ct.lower():
            return _err("invalid_content_type", "Upload image as multipart/form-data.", 415)
        try:
            body = await _read_limited(request, MAX_MULTIPART_BYTES)
        except ValueError:
            return _err("image_too_large", "Image exceeds upload limit.", 413)
        try:
            header = f"Content-Type: {ct}\r\nMIME-Version: 1.0\r\n\r\n".encode("latin-1")
            message = BytesParser(policy=policy.default).parsebytes(header + body)
            if not message.is_multipart():
                raise ValueError
            files = []
            for part in message.iter_parts():
                if part.get_content_disposition() != "form-data":
                    continue
                name = part.get_param("name", header="content-disposition")
                filename = part.get_filename()
                if filename is not None and name in {"file", "image"}:
                    files.append((filename, part.get_payload(decode=True) or b""))
            if len(files) != 1:
                raise ValueError
        except Exception:
            return _err("invalid_upload", "Provide exactly one image in the 'file' field.", 422)
        raw_filename = files[0][0].replace("\\", "/")
        filename = PurePosixPath(raw_filename).name
        filename = re.sub(r"[\x00-\x1f\x7f]", "_", filename)[:180] or "upload"
        try:
            result = await run_in_threadpool(extract_image, files[0][1])
        except ImageOCRError as exc:
            return _err(exc.code, str(exc), exc.status_code)
        except Exception:
            return _err("ocr_failed", "Image text could not be extracted.", 500)
        return {
            "extraction_status": result.status,
            "filename": filename,
            "extracted_text": result.text,
            "detected_language": result.language,
            "warnings": result.warnings,
        }

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    # Load .env if present
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
