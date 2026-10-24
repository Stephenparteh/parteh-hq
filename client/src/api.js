const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "phq_token";
const SLOW_MS = 4000;

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ } };

// Called when the server says our token is no good (401 on a logged-in request).
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

// "Waking up the server…": true while any request has been waiting longer than SLOW_MS.
let slowCount = 0;
const slowListeners = new Set();
const emitSlow = () => slowListeners.forEach((l) => l());
export const subscribeSlow = (l) => { slowListeners.add(l); return () => slowListeners.delete(l); };
export const isSlow = () => slowCount > 0;

export async function api(path, { method = "GET", body, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let slow = false;
  const timer = setTimeout(() => { slow = true; slowCount++; emitSlow(); }, SLOW_MS);
  const done = () => { clearTimeout(timer); if (slow) { slowCount--; emitSlow(); } };
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, signal, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    done();
    if (e?.name === "AbortError") throw e;
    throw Object.assign(new Error("Can't reach the server. Check your connection."), { network: true });
  }
  done();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith("/api/auth/")) onUnauthorized();
    throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  }
  return data;
}
