import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

// Base URL for API requests. Compiles from VITE_API_BASE_URL in production.
const BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ??
  "http://localhost:8000/api/v1";

const ACCESS_KEY = "iv_access_token";
const REFRESH_KEY = "iv_refresh_token";

export const tokenStore = {
  get access() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    window.dispatchEvent(new Event("iv:auth-changed"));
  },
  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    window.dispatchEvent(new Event("iv:auth-changed"));
  },
};

/** Router-based redirect hook — set by AuthProvider so we don't touch window.location. */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  const refresh = tokenStore.refresh;
  if (!refresh) throw new Error("No refresh token");

  refreshPromise = axios
    .post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh })
    .then((res) => {
      const access = res.data.access_token as string;
      const newRefresh = (res.data.refresh_token as string | undefined) ?? refresh;
      tokenStore.set(access, newRefresh);
      return access;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/auth/")
    ) {
      original._retry = true;
      try {
        const newAccess = await refreshAccessToken();
        if (original.headers) {
          original.headers.Authorization = `Bearer ${newAccess}`;
        }
        return apiClient(original);
      } catch {
        tokenStore.clear();
        onUnauthorized();
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 401) {
      tokenStore.clear();
      onUnauthorized();
    }

    return Promise.reject(error);
  },
);
