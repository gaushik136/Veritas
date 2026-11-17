"""AI-generated content detection via Gemini analysis of linguistic patterns."""
from __future__ import annotations
import json
import re
import ssl
import time
import urllib.error
import urllib.request
from typing import Any

from pydantic import BaseModel, Field

from src.services.gemini_service import (
    GEMINI_MODEL,
    API_ROOT,
    _get_api_key,
    _sanitize_text,
)

_AI_DETECTION_PROMPT = """You are an expert computational linguist specialising in distinguishing AI-generated text from human-written text.

Analyse the provided text for signs that it was produced by a large language model (LLM) rather than a human author.

Look for these AI indicators:
1. Uniform, symmetrical sentence length with no natural variation
2. Formulaic structure: intro → numbered points → conclusion
3. Hedging phrases typical of LLMs: "It is worth noting", "It is important to understand", "In conclusion", "Furthermore", "Moreover", "It should be noted"
4. Absence of personal anecdotes, emotions, typos, colloquialisms, or off-topic tangents
5. Over-precise, well-balanced paragraph structure
6. Repetitive transitional phrases used throughout
7. Generic, authoritative-sounding language without named sources or first-person perspective
8. Unnaturally perfect grammar and punctuation

Human writing indicators:
- Sentence fragments, run-ons, or casual grammar
- Personal voice, opinions, emotions
- Inconsistent structure or tangents
- Colloquial language, slang, or domain jargon
- Real names, dates, locations with specificity
- Typos or minor errors

Return ONLY a valid JSON object (no markdown, no preamble):
{
  "verdict": "likely_ai" | "likely_human" | "uncertain",
  "ai_probability": 0.0,
  "confidence": 0.0,
  "indicators": ["list", "of", "specific", "linguistic", "flags", "found"],
  "explanation": "2-3 sentence narrative explaining the detection reasoning."
}

Rules:
- verdict must be exactly one of: "likely_ai", "likely_human", "uncertain"
- ai_probability: float 0.0-1.0 (probability text is AI-generated)
- confidence: float 0.0-1.0 (how confident you are in this assessment)
- indicators: list of 2-6 specific strings describing exact linguistic signals found (or not found) in the text
- explanation: honest, evidence-based reasoning — no guessing
- If the text is too short (<50 words) to reliably classify, set verdict to "uncertain" and explain why"""


class AIDetectionResult(BaseModel):
    verdict: str = "uncertain"  # "likely_ai" | "likely_human" | "uncertain"
    ai_probability: float = Field(default=0.5, ge=0.0, le=1.0)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    indicators: list[str] = Field(default_factory=list)
    explanation: str = ""
    model_used: str = GEMINI_MODEL
    analysis_time_ms: int = 0


_VALID_VERDICTS = {"likely_ai", "likely_human", "uncertain"}


def detect_ai_content(text: str) -> AIDetectionResult:
    """Detect whether the given text is AI-generated or human-written."""
    start = time.time()

    try:
        api_key = _get_api_key()
    except Exception:
        return AIDetectionResult(
            verdict="uncertain",
            ai_probability=0.5,
            confidence=0.0,
            indicators=["AI detection service unavailable — API key not configured"],
            explanation="AI origin detection could not be completed: API key missing.",
        )

    sanitized = _sanitize_text(text)
    if not sanitized:
        return AIDetectionResult(
            verdict="uncertain",
            ai_probability=0.5,
            confidence=0.0,
            indicators=["No text provided"],
            explanation="No text was provided for AI origin detection.",
        )

    if len(sanitized.split()) < 15:
        return AIDetectionResult(
            verdict="uncertain",
            ai_probability=0.5,
            confidence=0.2,
            indicators=["Text too short for reliable classification"],
            explanation="The input is too short to reliably determine AI vs. human origin. At least 15–20 words are needed.",
        )

    url = f"{API_ROOT}{GEMINI_MODEL}:generateContent"
    payload: dict[str, Any] = {
        "systemInstruction": {
            "parts": [{"text": _AI_DETECTION_PROMPT}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": f"Analyse this text for AI vs. human origin:\n\n{sanitized}"}]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 1024,
            "responseMimeType": "application/json",
        },
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
        method="POST",
    )
    ctx = ssl.create_default_context()

    try:
        with urllib.request.urlopen(request, timeout=30, context=ctx) as response:
            raw_body = response.read(32 * 1024)
            res_json = json.loads(raw_body.decode("utf-8"))
    except Exception as exc:
        return AIDetectionResult(
            verdict="uncertain",
            ai_probability=0.5,
            confidence=0.0,
            indicators=["AI detection API call failed"],
            explanation=f"AI origin detection encountered a network or API error: {str(exc)[:120]}",
        )

    try:
        candidates = res_json.get("candidates", [])
        if not candidates:
            raise ValueError("No candidates")
        parts = candidates[0].get("content", {}).get("parts", [])
        text_content = "".join(p.get("text", "") for p in parts).strip()
        text_content = re.sub(r"^```(?:json)?\s*", "", text_content)
        text_content = re.sub(r"\s*```$", "", text_content)
        data = json.loads(text_content)
    except Exception as exc:
        return AIDetectionResult(
            verdict="uncertain",
            ai_probability=0.5,
            confidence=0.0,
            indicators=["Failed to parse AI detection response"],
            explanation=f"AI origin detection response could not be parsed: {str(exc)[:120]}",
        )

    elapsed_ms = int((time.time() - start) * 1000)

    verdict = str(data.get("verdict", "uncertain")).lower().strip()
    if verdict not in _VALID_VERDICTS:
        verdict = "uncertain"

    try:
        ai_prob = float(data.get("ai_probability", 0.5))
        ai_prob = max(0.0, min(1.0, ai_prob))
    except Exception:
        ai_prob = 0.5

    try:
        conf = float(data.get("confidence", 0.5))
        conf = max(0.0, min(1.0, conf))
    except Exception:
        conf = 0.5

    raw_indicators = data.get("indicators", [])
    indicators: list[str] = []
    if isinstance(raw_indicators, list):
        for item in raw_indicators[:8]:
            if isinstance(item, str) and item.strip():
                indicators.append(item.strip())

    explanation = str(data.get("explanation", "")).strip()[:800]

    return AIDetectionResult(
        verdict=verdict,
        ai_probability=ai_prob,
        confidence=conf,
        indicators=indicators,
        explanation=explanation,
        model_used=GEMINI_MODEL,
        analysis_time_ms=elapsed_ms,
    )
