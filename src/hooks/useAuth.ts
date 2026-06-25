import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  session: AuthSession | null;
  isMobile: boolean;
}

function parseOAuthCallback(url: string): { code: string; state: string } | null {
  try {
    const normalized = url.includes("://") ? url : `otakudeck://${url}`;
    const parsed = new URL(normalized);
    const code = parsed.searchParams.get("code");
    const state = parsed.searchParams.get("state");
    if (code && state) return { code, state };
  } catch {
    const query = url.includes("?") ? url.split("?")[1] : "";
    const params = new URLSearchParams(query);
    const code = params.get("code");
    const state = params.get("state");
    if (code && state) return { code, state };
  }
  return null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
    session: null,
    isMobile: false,
  });

  const checkSession = useCallback(async () => {
    try {
      const session = await invoke<AuthSession | null>("get_auth_session");
      setState((prev) => ({
        ...prev,
        isAuthenticated: session !== null,
        isLoading: false,
        error: null,
        session,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const completeOAuthFromUrl = useCallback(async (url: string) => {
    const params = parseOAuthCallback(url);
    if (!params) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      await invoke("complete_oauth_login", {
        code: params.code,
        oauthState: params.state,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const platform = await invoke<string>("get_platform");
      if (cancelled) return;

      setState((prev) => ({ ...prev, isMobile: platform === "mobile" }));
      await checkSession();

      if (platform !== "mobile") return;

      try {
        const startUrls = await getCurrent();
        if (startUrls) {
          for (const url of startUrls) {
            await completeOAuthFromUrl(url);
          }
        }

        await onOpenUrl((urls) => {
          urls.forEach((url) => {
            void completeOAuthFromUrl(url);
          });
        });
      } catch {
        // Deep-link plugin unavailable outside Tauri runtime
      }
    }

    void init();

    const unlistenSuccess = listen("auth-success", () => {
      void checkSession();
    });

    const unlistenError = listen<string>("auth-error", (event) => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: event.payload,
      }));
    });

    return () => {
      cancelled = true;
      unlistenSuccess.then((fn) => fn());
      unlistenError.then((fn) => fn());
    };
  }, [checkSession, completeOAuthFromUrl]);

  const login = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      await invoke("start_oauth_login");
      const platform = await invoke<string>("get_platform");
      if (platform === "desktop") {
        await checkSession();
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [checkSession]);

  const logout = useCallback(async () => {
    try {
      await invoke("logout");
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        session: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  return { ...state, login, logout, checkSession };
}
