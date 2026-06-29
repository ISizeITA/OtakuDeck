import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type ReactNode,
} from "react";
import { useTranslation } from "@/context/SettingsContext";
import "@/styles/components/pull-to-refresh.css";

const THRESHOLD = 72;
const MAX_PULL = 120;

interface PullToRefreshProps {
  enabled: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onRefresh: () => Promise<void>;
  refreshing?: boolean;
  children: ReactNode;
}

export function PullToRefresh({
  enabled,
  containerRef,
  onRefresh,
  refreshing = false,
  children,
}: PullToRefreshProps) {
  const { t } = useTranslation();
  const [pull, setPull] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const busyRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    pullRef.current = pull;
  }, [pull]);

  useEffect(() => {
    busyRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const resetPull = () => {
      pulling.current = false;
      setPull(0);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (busyRef.current || el.scrollTop > 0) return;
      startY.current = event.touches[0]?.clientY ?? 0;
      pulling.current = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pulling.current || busyRef.current) return;

      if (el.scrollTop > 0) {
        resetPull();
        return;
      }

      const delta = (event.touches[0]?.clientY ?? 0) - startY.current;
      if (delta <= 0) {
        resetPull();
        return;
      }

      event.preventDefault();
      setPull(Math.min(MAX_PULL, delta * 0.45));
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;

      const currentPull = pullRef.current;
      if (currentPull >= THRESHOLD && !busyRef.current) {
        setPull(0);
        void onRefreshRef.current();
        return;
      }

      setPull(0);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", resetPull);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", resetPull);
    };
  }, [enabled, containerRef]);

  if (!enabled) return <>{children}</>;

  const progress = Math.min(1, pull / THRESHOLD);
  const pullOffset = refreshing ? 48 : pull;

  return (
    <div
      className="pull-to-refresh"
      style={{ "--pull-offset": `${pullOffset}px` } as CSSProperties}
    >
      <div
        className={`pull-to-refresh__indicator ${refreshing ? "pull-to-refresh__indicator--active" : ""}`}
        style={{ height: refreshing ? 48 : pull, opacity: refreshing ? 1 : progress }}
        aria-hidden="true"
      >
        <span
          className={`pill-button__spinner ${refreshing ? "pull-to-refresh__spinner--spin" : ""}`}
          style={{ transform: refreshing ? undefined : `rotate(${progress * 360}deg)` }}
        />
        {!refreshing && pull > 24 && (
          <span className="pull-to-refresh__label">
            {pull >= THRESHOLD ? t("common.releaseToRefresh") : t("common.pullToRefresh")}
          </span>
        )}
        {refreshing && (
          <span className="pull-to-refresh__label">{t("common.refreshing")}</span>
        )}
      </div>
      {children}
    </div>
  );
}
