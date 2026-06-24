import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { setAccessToken, setOnAuthFail } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ api, children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = async () => {
    const res = await api.get('/me');
    setUser(res.data);
  };

  const refresh = async () => {
    try { await loadMe(); } catch { setUser(null); }
  };

  useEffect(() => {
    setOnAuthFail(() => { setAccessToken(null); setUser(null); });
    (async () => {
      // Boot: get a fresh access token from the refresh cookie FIRST, then load
      // the profile. Avoids a noisy 401 on /me for already-logged-in users.
      try {
        const res = await api.post('/auth/renew');
        if (res.data?.accessToken) {
          setAccessToken(res.data.accessToken);
          await loadMe();
        }
      } catch { /* no valid session — stay logged out */ }
      setLoading(false);
    })();
  }, []);

  const login = async (email, password, otp) => {
    const res = await api.post('/auth/login', { email, password, otp });
    setAccessToken(res.data.accessToken);
    await loadMe();
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const value = useMemo(() => ({ user, loading, login, logout, refresh }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
