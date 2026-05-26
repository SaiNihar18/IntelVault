import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, setUnauthorizedHandler, tokenStore } from "./apiClient";

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await apiClient.get<AuthUser>("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      queryClient.clear();
      navigate({ to: "/login" });
    });
  }, [navigate, queryClient]);

  // Initial hydration
  useEffect(() => {
    let active = true;
    (async () => {
      if (tokenStore.access) {
        await fetchMe();
      }
      if (active) setIsHydrating(false);
    })();
    return () => {
      active = false;
    };
  }, [fetchMe]);

  // React to logout from other tabs
  useEffect(() => {
    const onChange = () => {
      if (!tokenStore.access) setUser(null);
    };
    window.addEventListener("iv:auth-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("iv:auth-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await apiClient.post("/auth/login", { email, password });
      tokenStore.set(data.access_token, data.refresh_token);
      await fetchMe();
    },
    [fetchMe],
  );

  const register = useCallback(
    async (email: string, password: string, full_name?: string) => {
      const { data } = await apiClient.post("/auth/register", {
        email,
        password,
        full_name,
      });
      if (data?.access_token) {
        tokenStore.set(data.access_token, data.refresh_token);
        await fetchMe();
      }
    },
    [fetchMe],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      /* ignore */
    }
    tokenStore.clear();
    setUser(null);
    queryClient.clear();
    navigate({ to: "/login" });
  }, [navigate, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isHydrating,
      login,
      register,
      logout,
      refreshMe: fetchMe,
    }),
    [user, isHydrating, login, register, logout, fetchMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
