import { env } from '../config/env.js';

// Gemini endpoints flake per model (404 for retired models, 503 on demand
// spikes), so every AI call walks a fallback chain instead of trusting a
// single model name from env.
const MODEL_FALLBACKS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];

export function aiEnabled() {
  return Boolean(env.OPENAI_API_KEY);
}

// Call the configured OpenAI-compatible endpoint and return parsed JSON.
// Returns null (never throws) on timeout, HTTP error, bad JSON or empty
// content so callers can fall back to offline data.
export async function chatJSON(messages, { perModelTimeoutMs = 12000, totalTimeoutMs = 25000 } = {}) {
  if (!env.OPENAI_API_KEY) return null;
  const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const models = [...new Set([env.AI_MODEL, ...MODEL_FALLBACKS].filter(Boolean))];
  const deadline = Date.now() + totalTimeoutMs;
  let lastErr = null;

  for (const model of models) {
    if (Date.now() > deadline) break;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), perModelTimeoutMs);
    try {
      const res = await fetch(base + '/chat/completions', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + env.OPENAI_API_KEY
        },
        body: JSON.stringify({ model, response_format: { type: 'json_object' }, messages })
      });
      if (!res.ok) {
        lastErr = new Error('HTTP ' + res.status + ' for ' + model);
        continue;
      }
      const json = await res.json();
      const text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
      if (!text) { lastErr = new Error('empty content for ' + model); continue; }
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastErr) console.warn('[ai] chatJSON failed:', lastErr.message);
  return null;
}
