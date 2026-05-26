import type { TokenPair } from "@/types/api";

const ACCESS_TOKEN_KEY = "intelvault_access_token";
const REFRESH_TOKEN_KEY = "intelvault_refresh_token";
const EXPIRES_AT_KEY = "intelvault_expires_at";

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

export function saveTokens(tokens: TokenPair) {
  memoryAccessToken = tokens.access_token;
  memoryRefreshToken = tokens.refresh_token;
  const expiresAt = Date.now() + tokens.expires_in * 1000;
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  } catch { /* storage unavailable */ }
}

export function getAccessToken(): string | null {
  return memoryAccessToken || localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return memoryRefreshToken || localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function isTokenExpired(): boolean {
  const expiresAt = localStorage.getItem(EXPIRES_AT_KEY);
  if (!expiresAt) return true;
  return Date.now() >= Number(expiresAt) - 30_000; // 30s buffer
}

export function clearTokens() {
  memoryAccessToken = null;
  memoryRefreshToken = null;
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(EXPIRES_AT_KEY);
  } catch { /* storage unavailable */ }
}

export function hasTokens(): boolean {
  return !!getAccessToken();
}
