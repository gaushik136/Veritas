"""Gemini API integration for news text analysis via official REST endpoint."""
from __future__ import annotations
import json
import os
import re
import ssl
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field


class Claim(BaseModel):
    text: str
    verdict: str  # "supported" | "refuted" | "unverified"
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    explanation: str = ""
    why_fake: str = ""
    evidence: str = ""


class Source(BaseModel):
    title: str
    url: str
    relevance: str = ""


class GeminiAnalysisResult(BaseModel):
    claims: list[Claim] = Field(default_factory=list)
    sources: list[Source] = Field(default_factory=list)
    summary: str = ""
    credibility_score: float = Field(default=0.5, ge=0.0, le=1.0)
    language: str = "en"
    model_used: str = "gemini-3.1-flash-lite"
    tokens_used: int = 0
    analysis_time_ms: int = 0


class GeminiServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 503):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


GEMINI_MODEL = "gemini-3.1-flash-lite"
API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models/"

_SYSTEM_PROMPT = """You are a senior professional investigative fact-checker and intelligence analyst.
Analyze the provided news text carefully for factual veracity, misinformation, fabricated claims, and evidence.

Return ONLY a valid JSON object with this exact structure (no markdown fences, no text before or after):
{
  "claims": [
    {
      "text": "Exact claim quoted or stated in the article",
      "verdict": "refuted",
      "confidence": 0.95,
      "explanation": "Clear explanation of the verdict",
      "why_fake": "Explicitly explain WHY this is fake, deceptive, or misleading. If supported, write 'N/A: Verified factual'.",
      "evidence": "Specific counter-evidence, official statements, scientific consensus, or verified timeline proving or debunking this claim."
    }
  ],
  "sources": [
    {
      "title": "Name of authoritative publication or agency (e.g. Reuters, NASA, WHO, AP News, Snopes, Nature)",
      "url": "https://www.reputable-source.org/actual-article",
      "relevance": "Specific evidence this reference source provides"
    }
  ],
  "summary": "Thorough 2-4 sentence analysis explaining whether the news is authentic or fabricated, why, and what the real facts are.",
  "credibility_score": 0.05,
  "language": "en"
}

Critical Fact-Checking Rules:
1. Extract 2-5 distinct verifiable claims.
2. verdict must be strictly one of: "supported" (true), "refuted" (fake/false), or "unverified" (unsubstantiated).
3. If a claim is refuted (fake), you MUST fill 'why_fake' with a clear, direct reason why it is deceptive, and 'evidence' with the factual counter-proof.
4. If a claim is supported, fill 'evidence' with the corroborating documentation.
5. In 'sources', provide real, working reference URLs from well-known institutions, major news agencies, encyclopedia entries (Wikipedia), or official bodies.
6. credibility_score: float from 0.0 (total hoax/misinformation) to 1.0 (fully verified truth).
7. Return strictly valid JSON."""


def _load_env_fallback() -> None:
    candidates = [
        Path(__file__).resolve().parents[2] / ".env",
        Path.cwd() / ".env",
    ]
    for env_path in candidates:
        if env_path.is_file():
            try:
                for line in env_path.read_text(encoding="utf-8-sig").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip("'\""))
            except Exception:
                pass


def _get_api_key() -> str:
    _load_env_fallback()
    key = os.environ.get("LLM_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not key or not key.strip():
        raise GeminiServiceError(
            "api_key_missing",
            "Gemini API key not configured. Set LLM_API_KEY in backend/.env.",
            503,
        )
    return key.strip()


def _sanitize_text(text: str) -> str:
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return text[:10000].strip()


def _validate_sources(sources: list[dict]) -> list[dict]:
    valid = []
    for s in sources:
        if not isinstance(s, dict):
            continue
        url = s.get("url", "")
        if isinstance(url, str) and url.startswith(("http://", "https://")) and "." in url:
            valid.append(s)
    return valid


def analyze_news_text(text: str) -> GeminiAnalysisResult:
    start = time.time()
    api_key = _get_api_key()
    sanitized = _sanitize_text(text)
    if not sanitized:
        raise GeminiServiceError("invalid_text", "Text cannot be empty.", 422)

    url = f"{API_ROOT}{GEMINI_MODEL}:generateContent"
    payload = {
        "systemInstruction": {
            "parts": [{"text": _SYSTEM_PROMPT}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": f"Fact-check this news text. Break down each claim with why it is true or fake, concrete evidence, and reference sources:\n\n{sanitized}"}]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 4096,
            "responseMimeType": "application/json",
        }
    }

    req_data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=req_data,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST"
    )

    ctx = ssl.create_default_context()

    try:
        with urllib.request.urlopen(request, timeout=35, context=ctx) as response:
            raw_body = response.read(64 * 1024)
            res_json = json.loads(raw_body.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            err_doc = json.loads(exc.read().decode("utf-8"))
            err_msg = err_doc.get("error", {}).get("message", str(exc))
        except Exception:
            err_msg = str(exc)

        if exc.code == 400 and ("API_KEY" in err_msg.upper() or "KEY" in err_msg.upper()):
            raise GeminiServiceError("api_key_invalid", "Gemini API key is invalid or unrecognized.", 503)
        if exc.code == 429:
            raise GeminiServiceError("rate_limited", "Gemini API quota or rate limit exceeded.", 429)
        if exc.code == 404:
            raise GeminiServiceError("model_not_found", f"Gemini model not found: {err_msg[:100]}", 503)
        raise GeminiServiceError("gemini_error", f"Gemini API returned status {exc.code}: {err_msg[:200]}", 503)
    except (TimeoutError, urllib.error.URLError) as exc:
        raise GeminiServiceError("gemini_network_error", "Failed to reach Gemini API server. Check internet connection.", 504)
    except Exception as exc:
        raise GeminiServiceError("gemini_error", f"Unexpected error during Gemini call: {str(exc)[:150]}", 500)

    try:
        candidates = res_json.get("candidates", [])
        if not candidates:
            raise ValueError("No candidates returned from Gemini.")
        candidate = candidates[0]
        parts = candidate.get("content", {}).get("parts", [])
        text_content = ""
        for p in parts:
            if "text" in p:
                text_content += p["text"]

        raw_text = text_content.strip()
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
        raw_text = re.sub(r"\s*```$", "", raw_text)
        data = json.loads(raw_text)
    except Exception as exc:
        raise GeminiServiceError("invalid_response", f"Failed to parse structured response from Gemini: {str(exc)[:120]}", 502)

    elapsed_ms = int((time.time() - start) * 1000)

    usage = res_json.get("usageMetadata", {})
    total_tokens = usage.get("totalTokenCount", 0)

    raw_sources = data.get("sources", [])
    valid_sources = _validate_sources(raw_sources) if isinstance(raw_sources, list) else []

    raw_claims = data.get("claims", [])
    claims_list: list[Claim] = []
    if isinstance(raw_claims, list):
        for c in raw_claims[:10]:
            if isinstance(c, dict) and "text" in c:
                verdict = str(c.get("verdict", "unverified")).lower()
                if verdict not in ("supported", "refuted", "unverified"):
                    verdict = "unverified"
                conf = float(c.get("confidence", 0.75))
                conf = max(0.0, min(1.0, conf))
                claims_list.append(Claim(
                    text=str(c.get("text", "")).strip(),
                    verdict=verdict,
                    confidence=conf,
                    explanation=str(c.get("explanation", "")).strip(),
                    why_fake=str(c.get("why_fake", "")).strip(),
                    evidence=str(c.get("evidence", "")).strip(),
                ))

    try:
        cred = float(data.get("credibility_score", 0.5))
        cred = max(0.0, min(1.0, cred))
    except Exception:
        cred = 0.5

    return GeminiAnalysisResult(
        claims=claims_list,
        sources=[Source(**s) for s in valid_sources[:10]],
        summary=str(data.get("summary", "")).strip()[:1500],
        credibility_score=cred,
        language=str(data.get("language", "en")).strip()[:10],
        model_used=GEMINI_MODEL,
        tokens_used=total_tokens,
        analysis_time_ms=elapsed_ms,
    )
