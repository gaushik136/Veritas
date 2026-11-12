"""Image text extraction using Pillow validation and Gemini Multimodal Vision."""
from __future__ import annotations
import base64
from dataclasses import dataclass, field
import io
import json
import os
import re
import ssl
import urllib.error
import urllib.request
from pathlib import Path
from PIL import Image

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

GEMINI_MODEL = "gemini-3.1-flash-lite"
API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models/"


class ImageOCRError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 422):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


@dataclass
class OCRResult:
    status: str
    text: str
    language: str | None = None
    warnings: list[str] = field(default_factory=list)


def _load_env_fallback() -> None:
    for env_path in [Path(__file__).resolve().parents[3] / ".env", Path.cwd() / ".env"]:
        if env_path.is_file():
            try:
                for line in env_path.read_text(encoding="utf-8-sig").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip("'\""))
            except Exception:
                pass


def _get_api_key() -> str | None:
    _load_env_fallback()
    return os.environ.get("LLM_API_KEY") or os.environ.get("GEMINI_API_KEY")


def extract_image(image_bytes: bytes) -> OCRResult:
    """Extract and transcribe news text from image bytes using Gemini Vision."""
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise ImageOCRError("image_too_large", f"Image exceeds {MAX_UPLOAD_BYTES // 1024 // 1024}MB limit.", 413)

    if not image_bytes:
        raise ImageOCRError("empty_file", "Uploaded image file is empty.", 422)

    # 1. Validate with Pillow
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img_format = (img.format or "").upper()
        if img_format not in ALLOWED_FORMATS:
            raise ImageOCRError(
                "unsupported_format",
                f"Unsupported image format ({img_format or 'unknown'}). Please upload a PNG, JPEG, or WebP image.",
                415
            )
        # Ensure image has readable pixels
        img.load()
    except ImageOCRError:
        raise
    except Exception as exc:
        raise ImageOCRError("invalid_image", f"Could not decode image file: {str(exc)[:100]}", 422)

    # Convert to standard PNG or JPEG buffer if needed
    mime_map = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}
    mime_type = mime_map.get(img_format, "image/png")
    b64_image = base64.b64encode(image_bytes).decode("ascii")

    # 2. Extract using Gemini Vision
    api_key = _get_api_key()
    if not api_key:
        raise ImageOCRError("api_key_missing", "Gemini API key not configured for OCR service.", 503)

    prompt = (
        "Extract all readable text, headlines, claims, and subtitles from this image verbatim. "
        "Do not summarize or interpret. Only transcribe the actual written text present in the image. "
        "If there is no text in the image, reply with exactly: NO_TEXT_FOUND"
    )

    url = f"{API_ROOT}{GEMINI_MODEL}:generateContent"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": b64_image
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 2048,
        }
    }

    req_data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=req_data,
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST"
    )

    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(request, timeout=30, context=ctx) as response:
            raw_body = response.read(64 * 1024)
            res_json = json.loads(raw_body.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise ImageOCRError("ocr_upstream_error", f"Gemini OCR service returned status {exc.code}.", 502)
    except Exception as exc:
        raise ImageOCRError("ocr_failed", f"Failed to connect to OCR service: {str(exc)[:100]}", 502)

    try:
        candidates = res_json.get("candidates", [])
        if not candidates:
            return OCRResult(status="no_text", text="", warnings=["No readable text was detected in the image."])

        text = ""
        for part in candidates[0].get("content", {}).get("parts", []):
            if "text" in part:
                text += part["text"]

        extracted = text.strip()
        if not extracted or extracted == "NO_TEXT_FOUND":
            return OCRResult(status="no_text", text="", warnings=["No readable text was found in the uploaded image."])

        return OCRResult(
            status="success",
            text=extracted[:8000],
            language="en",
            warnings=[]
        )
    except Exception as exc:
        raise ImageOCRError("ocr_parse_error", f"Error parsing OCR result: {str(exc)[:100]}", 500)
