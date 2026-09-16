let csrfToken = null;
let onUnauthorized = null;

export function setCsrf(token) { csrfToken = token; }
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  const res = await fetch('/api' + path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Any 401 means the session/CSRF token expired → force logout everywhere.
  if (res.status === 401) {
    if (onUnauthorized) onUnauthorized();
    throw new ApiError('unauthorized', 401);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error || 'request_failed', res.status, data);
  return data;
}

// Build an authenticated export URL (GET; the session cookie is sent automatically).
export function exportUrl(kind, params = {}) {
  const q = new URLSearchParams(params).toString();
  return `/api/export/${kind}${q ? `?${q}` : ''}`;
}
