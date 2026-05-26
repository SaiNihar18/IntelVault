import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from "./tokenStore";
import type { TokenPair } from "@/types/api";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

export class ApiClientError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    const msg = typeof detail === "string" ? detail : JSON.stringify(detail);
    super(msg);
    this.name = "ApiClientError";
    this.status = status;
    this.detail = detail;
  }
}

async function attemptRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const tokens: TokenPair = await res.json();
    saveTokens(tokens);
    return true;
  } catch {
    return false;
  }
}

async function refreshIfNeeded(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = attemptRefresh().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  formData?: FormData;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, auth = true, formData } = opts;
  const url = `${BASE_URL}${path}`;

  const reqHeaders: Record<string, string> = { ...headers };
  if (auth) {
    const token = getAccessToken();
    if (token) reqHeaders["Authorization"] = `Bearer ${token}`;
  }
  if (body && !formData) {
    reqHeaders["Content-Type"] = "application/json";
  }

  let res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: formData || (body ? JSON.stringify(body) : undefined),
  });

  // Handle 401 with refresh retry
  if (res.status === 401 && auth) {
    const refreshed = await refreshIfNeeded();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) reqHeaders["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, {
        method,
        headers: reqHeaders,
        body: formData || (body ? JSON.stringify(body) : undefined),
      });
    }
    if (res.status === 401) {
      clearTokens();
      window.location.href = "/login";
      throw new ApiClientError(401, "Session expired");
    }
  }

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = res.statusText;
    }
    throw new ApiClientError(res.status, typeof detail === "object" && detail !== null && "detail" in detail ? (detail as Record<string, unknown>).detail : detail);
  }

  return res.json();
}

export const apiClient = {
  get: <T>(path: string, auth = true) => request<T>(path, { auth }),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: "POST", body, auth }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", formData }),
};
