import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
export const BM_API_BASE = 'http://crowncraftinnovations.in:8080';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true,
});

export function getBmAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ops_dashboard_auth_token') || localStorage.getItem('bm_token');
}

export async function bmFetch(endpoint: string, options: RequestInit = {}) {
  const token = getBmAuthToken();
  const subPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const targetPath = subPath.startsWith('bm/') ? subPath : `bm/${subPath}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const method = options.method || 'GET';
  const bodyData = options.body ? JSON.parse(options.body as string) : undefined;

  try {
    const res = await api({
      url: `/${targetPath}`,
      method,
      headers,
      data: bodyData,
    });
    return res.data;
  } catch (err: any) {
    return err.response?.data || { success: false, message: err.message || 'API error' };
  }
}

export const bmApi = {
  get: (url: string) => bmFetch(url, { method: 'GET' }).then(data => ({ data })),
  post: (url: string, body?: any) => bmFetch(url, { method: 'POST', body: JSON.stringify(body) }).then(data => ({ data })),
  put: (url: string, body?: any) => bmFetch(url, { method: 'PUT', body: JSON.stringify(body) }).then(data => ({ data })),
  patch: (url: string, body?: any) => bmFetch(url, { method: 'PATCH', body: JSON.stringify(body) }).then(data => ({ data })),
  delete: (url: string) => bmFetch(url, { method: 'DELETE' }).then(data => ({ data })),
};

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
    if (!refreshToken) throw new Error('Refresh token missing');

    const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    localStorage.setItem('access_token', data.data.accessToken);
    localStorage.setItem('refresh_token', data.data.refreshToken);
    return data.data.accessToken as string;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

// Request interceptor - attach access token for WACRM routes
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // Do NOT overwrite Authorization header for Bharat Milk (/bm/*) endpoints
    if (!config.url?.includes('/bm/') && !config.headers.Authorization) {
      const token = localStorage.getItem('access_token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor - handle 401 / token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !original._retry
    ) {
      original._retry = true;
      try {
        const accessToken = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (typeof window !== 'undefined' && window.location.pathname !== '/auth/login') {
          window.location.href = '/auth/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Helper
export const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

export const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
