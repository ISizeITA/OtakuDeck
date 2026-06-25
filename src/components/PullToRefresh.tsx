import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type ReactNode,
} from "react";
import "@/styles/components/pull-to-refresh.css";

const THRESHOLD = 72;
const MAX_PULL = 120;

interface PullToRefreshProps {
  enabled: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}

export function PullToRefresh({
  enabled,
  containerRef,
  onRefresh,
  children,
}: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    pullRef.current = pull;
  }, [pull]);

  useEffect(() => {
    refreshingRef.current = refreshing;
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
      if (refreshingRef.current || el.scrollTop > 0) return;
      startY.current = event.touches[0]?.clientY ?? 0;
      pulling.current = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pulling.current || refreshingRef.current) return;

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
      if (currentPull >= THRESHOLD && !refreshingRef.current) {
        setRefreshing(true);
        void (async () => {
          try {
            await onRefreshRef.current();
          } finally {
            setRefreshing(false);
            setPull(0);
          }
        })();
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
        style={{ height: refreshing ? 48 : pull, opacity: progress }}
        aria-hidden="true"
      >
        <span
          className={`pill-button__spinner ${refreshing ? "pull-to-refresh__spinner--spin" : ""}`}
          style={{ transform: refreshing ? undefined : `rotate(${progress * 360}deg)` }}
        />
      </div>
      {children}
    </div>
  );
}
