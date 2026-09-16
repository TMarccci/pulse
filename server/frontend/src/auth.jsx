import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api, setCsrf, setUnauthorizedHandler } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState(null);
  const logoutTimer = useRef(null);

  const clear = useCallback(() => {
    setUser(null);
    setExpiresAt(null);
    setCsrf(null);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
  }, []);

  // Schedule an automatic logout exactly when the token expires.
  const scheduleExpiry = useCallback((exp) => {
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (!exp) return;
    const ms = exp * 1000 - Date.now();
    logoutTimer.current = setTimeout(() => clear(), Math.max(0, ms));
  }, [clear]);

  const applySession = useCallback((data) => {
    setUser(data.user);
    setCsrf(data.csrfToken);
    setExpiresAt(data.expiresAt);
    scheduleExpiry(data.expiresAt);
  }, [scheduleExpiry]);

  const login = useCallback(async (username, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { username, password } });
    applySession(data);
    return data;
  }, [applySession]);

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clear();
  }, [clear]);

  // Any API 401 anywhere clears the session (auto-logout on expiry).
  useEffect(() => { setUnauthorizedHandler(clear); }, [clear]);

  // Restore an existing session on load.
  useEffect(() => {
    api('/auth/me')
      .then((data) => applySession(data))
      .catch(() => clear())
      .finally(() => setLoading(false));
  }, [applySession, clear]);

  return (
    <AuthCtx.Provider value={{ user, loading, expiresAt, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
