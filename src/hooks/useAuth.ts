import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { dispatchAccountSwitched } from "@/lib/accountEvents";
import type { MalAccountSummary } from "@/types/accounts";

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
  accounts: MalAccountSummary[];
  accountsLoading: boolean;
  accountBusyId: string | null;
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
    accounts: [],
    accountsLoading: true,
    accountBusyId: null,
  });

  const loadAccounts = useCallback(async () => {
    try {
      const accounts = await invoke<MalAccountSummary[]>("list_mal_accounts");
      setState((prev) => ({
        ...prev,
        accounts,
        accountsLoading: false,
      }));
    } catch {
      setState((prev) => ({ ...prev, accountsLoading: false }));
    }
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const session = await invoke<AuthSession | null>("get_auth_session");
      setState((prev) => ({
        ...prev,
        isAuthenticated: session !== null,
        isLoading: false,
        error: null,
        session,
        accountBusyId: null,
      }));
      await loadAccounts();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [loadAccounts]);

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

    const unlistenSwitch = listen<string>("account-switched", (event) => {
      dispatchAccountSwitched(event.payload);
      void checkSession();
    });

    return () => {
      cancelled = true;
      unlistenSuccess.then((fn) => fn());
      unlistenError.then((fn) => fn());
      unlistenSwitch.then((fn) => fn());
    };
  }, [checkSession, completeOAuthFromUrl]);

  const login = useCallback(
    async (options?: { newAccount?: boolean; accountId?: string }) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null, accountBusyId: options?.accountId ?? null }));
      try {
        await invoke("start_oauth_login", {
          newAccount: options?.newAccount ?? false,
          accountId: options?.accountId ?? null,
        });
        const platform = await invoke<string>("get_platform");
        if (platform === "desktop") {
          await checkSession();
        } else {
          setState((prev) => ({ ...prev, isLoading: false, accountBusyId: null }));
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          accountBusyId: null,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [checkSession],
  );

  const switchAccount = useCallback(
    async (accountId: string) => {
      setState((prev) => ({ ...prev, accountBusyId: accountId, error: null }));
      try {
        await invoke("switch_mal_account", { accountId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("sessione scaduta") || message.toLowerCase().includes("sign in")) {
          await login({ accountId });
          return;
        }
        setState((prev) => ({ ...prev, error: message, accountBusyId: null }));
      }
    },
    [login],
  );

  const addAccount = useCallback(async () => {
    await login({ newAccount: true });
  }, [login]);

  const removeAccount = useCallback(
    async (accountId: string) => {
      setState((prev) => ({ ...prev, accountBusyId: accountId, error: null }));
      try {
        await invoke("remove_mal_account", { accountId });
        await checkSession();
      } catch (err) {
        setState((prev) => ({
          ...prev,
          accountBusyId: null,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [checkSession],
  );

  const logout = useCallback(async () => {
    try {
      await invoke("logout");
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        session: null,
        accountBusyId: null,
      }));
      await loadAccounts();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [loadAccounts]);

  return {
    ...state,
    login,
    logout,
    checkSession,
    loadAccounts,
    switchAccount,
    addAccount,
    removeAccount,
  };
}
