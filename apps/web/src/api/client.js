const BASE = '/api/v1';

let refreshing = null;

function sessionExpired() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:expired'));
}

function refreshSession() {
  if (!refreshing) {
    refreshing = fetch(BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(r => {
        if (!r.ok) sessionExpired();
        return r.ok;
      })
      .catch(() => {
        sessionExpired();
        return false;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function request(path, { method = 'GET', body, signal, retry = true } = {}) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal
  });

  if (res.status === 401 && retry && path !== '/auth/refresh' && path !== '/auth/login' && path !== '/auth/register') {
    const ok = await refreshSession();
    if (ok) return request(path, { method, body, signal, retry: false });
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data && data.error && data.error.message ? data.error.message : res.statusText || 'Request failed';
    throw new Error(msg);
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, opts),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' })
};
