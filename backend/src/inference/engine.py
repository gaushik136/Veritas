"""ML inference engine - loads scikit-learn models if available."""
from __future__ import annotations
import os
from pathlib import Path
from typing import Any
from dataclasses import dataclass, field


@dataclass
class PredictionResult:
    task: str
    label: str
    confidence: float
    all_scores: dict[str, float] = field(default_factory=dict)
    model_version: str = "unknown"

    def as_dict(self) -> dict:
        return {
            "task": self.task,
            "label": self.label,
            "confidence": self.confidence,
            "all_scores": self.all_scores,
            "model_version": self.model_version,
        }


class InferenceInputError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


SUPPORTED_TASKS = frozenset({"tamil_xfact", "fever_claim", "liar_statement"})
MODELS_DIR = Path(__file__).parent.parent.parent / "models"


class InferenceEngine:
    """Loads and runs sklearn models from the models/ directory."""

    def __init__(self):
        self._models: dict[str, Any] = {}
        self._vectorizers: dict[str, Any] = {}
        self._loaded_tasks: set[str] = set()
        self._try_load_models()

    def _try_load_models(self) -> None:
        """Attempt to load model files. Silently skips if not present."""
        try:
            import joblib
        except ImportError:
            return

        for task in SUPPORTED_TASKS:
            model_path = MODELS_DIR / f"{task}_model.joblib"
            vec_path = MODELS_DIR / f"{task}_vectorizer.joblib"
            if model_path.exists() and vec_path.exists():
                try:
                    self._models[task] = joblib.load(model_path)
                    self._vectorizers[task] = joblib.load(vec_path)
                    self._loaded_tasks.add(task)
                except Exception:
                    pass  # Corrupt model — skip

    @property
    def loaded_tasks(self) -> frozenset:
        return frozenset(self._loaded_tasks)

    def predict(self, task: str, text: str) -> PredictionResult:
        if not text or not text.strip():
            raise InferenceInputError("empty_text", "Text must not be empty.")
        if len(text) > 10_000:
            raise InferenceInputError("text_too_long", "Text exceeds 10,000 character limit.")
        if task not in self._loaded_tasks:
            raise InferenceInputError(
                "model_unavailable",
                f"Model for task '{task}' is not loaded. No trained model file found.",
            )
        try:
            vec = self._vectorizers[task]
            model = self._models[task]
            X = vec.transform([text])
            proba = model.predict_proba(X)[0]
            classes = model.classes_
            best_idx = proba.argmax()
            return PredictionResult(
                task=task,
                label=str(classes[best_idx]),
                confidence=float(proba[best_idx]),
                all_scores={str(c): float(p) for c, p in zip(classes, proba)},
                model_version="sklearn-tfidf-v1",
            )
        except Exception as exc:
            raise InferenceInputError("inference_error", f"Prediction failed: {str(exc)[:200]}")


_engine: InferenceEngine | None = None


def get_default_engine() -> InferenceEngine:
    global _engine
    if _engine is None:
        _engine = InferenceEngine()
    return _engine
