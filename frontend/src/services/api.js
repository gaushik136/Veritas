/* api.js — VERITAS API client */

const BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
  } catch (err) {
    throw { code: 'network_error', message: 'Cannot connect to VERITAS backend. Is it running on port 8000?', status: 0 };
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = data?.error || {};
    throw {
      code: err.code || 'api_error',
      message: err.message || `Server error ${res.status}`,
      status: res.status,
    };
  }

  return data;
}

/** POST /api/v1/analyze-text — Gemini analysis */
export async function analyzeText(text) {
  return request('/api/v1/analyze-text', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

/** POST /api/v1/predict — ML classification */
export async function predict(task, text) {
  return request('/api/v1/predict', {
    method: 'POST',
    body: JSON.stringify({ task, text }),
  });
}

/** POST /api/v1/extract-url — Fetch article from URL */
export async function extractUrl(url) {
  return request('/api/v1/extract-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

/** POST /api/v1/extract-image — OCR image */
export async function extractImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  const url = `${BASE}/api/v1/extract-image`;
  let res;
  try {
    res = await fetch(url, { method: 'POST', body: formData });
  } catch (err) {
    throw { code: 'network_error', message: 'Cannot connect to VERITAS backend.', status: 0 };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error || {};
    throw { code: err.code || 'api_error', message: err.message || `Server error ${res.status}`, status: res.status };
  }
  return data;
}

/** GET /ready — Backend + model readiness */
export async function checkReady() {
  return request('/ready');
}

/** GET /health — Liveness ping */
export async function checkHealth() {
  return request('/health');
}
