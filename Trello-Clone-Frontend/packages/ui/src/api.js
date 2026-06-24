import axios from 'axios';

// Access token lives in memory only (never localStorage) — auth-flow.md.
let accessToken = null;
export const setAccessToken = (t) => { accessToken = t; };
export const getAccessToken = () => accessToken;

let onAuthFail = null;
export const setOnAuthFail = (fn) => { onAuthFail = fn; };

export function createApi(baseURL = '/api') {
  const api = axios.create({ baseURL, withCredentials: true });

  api.interceptors.request.use((cfg) => {
    if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
    return cfg;
  });

  let renewing = null;

  const renew = async () => {
    try {
      const res = await axios.post(`${baseURL}/auth/renew`, {}, { withCredentials: true });
      const token = res.data?.accessToken ?? null;
      setAccessToken(token);
      return token;
    } catch {
      setAccessToken(null);
      return null;
    }
  };

  api.interceptors.response.use(
    (r) => r,
    async (error) => {
      const original = error.config;
      const status = error.response?.status;
      const isAuthCall = original?.url?.includes('/auth/');
      if (status === 401 && !original._retry && !isAuthCall) {
        original._retry = true;
        renewing = renewing ?? renew();
        const token = await renewing;
        renewing = null;
        if (token) {
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
        onAuthFail?.();
      }
      return Promise.reject(error);
    }
  );

  return api;
}
