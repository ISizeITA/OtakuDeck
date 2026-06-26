import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import {
  UPDATE_BANNER_DURATION_MS,
  type UpdateCheckResult,
} from "@/types/updates";

interface UpdateContextValue {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  checking: boolean;
  checkError: string | null;
  bannerVisible: boolean;
  changelog: string[];
  checkForUpdates: () => Promise<UpdateCheckResult | null>;
  applyUpdate: () => Promise<void>;
  dismissBanner: () => void;
}

const UpdateContext = createContext<UpdateContextValue | null>(null);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [currentVersion, setCurrentVersion] = useState("");
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShownBannerRef = useRef(false);

  const clearBannerTimer = useCallback(() => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
  }, []);

  const dismissBanner = useCallback(() => {
    clearBannerTimer();
    setBannerVisible(false);
  }, [clearBannerTimer]);

  const showBannerOnce = useCallback(() => {
    if (hasShownBannerRef.current) return;
    hasShownBannerRef.current = true;
    setBannerVisible(true);
    clearBannerTimer();
    bannerTimerRef.current = setTimeout(() => {
      setBannerVisible(false);
      bannerTimerRef.current = null;
    }, UPDATE_BANNER_DURATION_MS);
  }, [clearBannerTimer]);

  const applyResult = useCallback(
    (result: UpdateCheckResult) => {
      setCurrentVersion(result.current_version);
      setLatestVersion(result.latest_version);
      setUpdateAvailable(result.update_available);
      setDownloadUrl(result.download_url ?? null);
      setReleaseUrl(result.release_url ?? null);
      setChangelog(result.changelog ?? []);
      setCheckError(result.error ?? null);

      if (result.update_available) {
        showBannerOnce();
      }
    },
    [showBannerOnce],
  );

  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    setCheckError(null);
    try {
      const result = await api.checkForUpdates();
      applyResult(result);
      return result;
    } catch (err) {
      const message = String(err);
      setCheckError(message);
      return null;
    } finally {
      setChecking(false);
    }
  }, [applyResult]);

  const applyUpdate = useCallback(async () => {
    const target = downloadUrl ?? releaseUrl;
    if (!target) return;
    dismissBanner();
    await api.installAppUpdate(target);
  }, [downloadUrl, releaseUrl, dismissBanner]);

  useEffect(() => {
    void api.getAppVersion().then(setCurrentVersion).catch(() => {});
    void checkForUpdates();
    return () => clearBannerTimer();
    // Initial update check once when the app shell mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      currentVersion,
      latestVersion,
      updateAvailable,
      checking,
      checkError,
      bannerVisible,
      changelog,
      checkForUpdates,
      applyUpdate,
      dismissBanner,
    }),
    [
      currentVersion,
      latestVersion,
      updateAvailable,
      checking,
      checkError,
      bannerVisible,
      changelog,
      checkForUpdates,
      applyUpdate,
      dismissBanner,
    ],
  );

  return (
    <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
  );
}

export function useUpdate() {
  const ctx = useContext(UpdateContext);
  if (!ctx) {
    throw new Error("useUpdate must be used within UpdateProvider");
  }
  return ctx;
}
