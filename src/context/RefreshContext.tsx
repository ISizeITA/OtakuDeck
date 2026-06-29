import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ACCOUNT_SWITCHED_EVENT } from "@/lib/accountEvents";
import { invalidateListCache } from "@/lib/listCache";

interface RefreshContextValue {
  refreshKey: number;
  isRefreshing: boolean;
  triggerRefresh: () => Promise<void>;
}

const RefreshContext = createContext<RefreshContextValue | null>(null);

const REFRESH_MIN_MS = 700;

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const triggerRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    invalidateListCache();
    setRefreshKey((k) => k + 1);
    await new Promise((resolve) => setTimeout(resolve, REFRESH_MIN_MS));
    setIsRefreshing(false);
  }, [isRefreshing]);

  useEffect(() => {
    const handleAccountSwitch = () => {
      invalidateListCache();
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener(ACCOUNT_SWITCHED_EVENT, handleAccountSwitch);
    return () => window.removeEventListener(ACCOUNT_SWITCHED_EVENT, handleAccountSwitch);
  }, []);

  const value = useMemo(
    () => ({ refreshKey, isRefreshing, triggerRefresh }),
    [refreshKey, isRefreshing, triggerRefresh],
  );

  return (
    <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>
  );
}

export function useRefresh() {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error("useRefresh must be used within RefreshProvider");
  return ctx;
}
