/* history.js — localStorage analysis history */

const KEY = 'veritas:history';
const MAX_ITEMS = 50;

export function saveAnalysis(entry) {
  const history = getHistory();
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
    inputType: entry.inputType || 'text',
    inputPreview: (entry.text || entry.url || entry.filename || '').slice(0, 120),
    credibility_score: entry.gemini?.credibility_score ?? null,
    summary: entry.gemini?.summary ?? '',
    language: entry.gemini?.language ?? 'en',
    gemini: entry.gemini ?? null,
    ml: entry.ml ?? null,
    errors: entry.errors ?? {},
  };
  const updated = [item, ...history].slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {}
  return item.id;
}

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function getAnalysis(id) {
  return getHistory().find(h => h.id === id) || null;
}

export function clearHistory() {
  localStorage.removeItem(KEY);
}
