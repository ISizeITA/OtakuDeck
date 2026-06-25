import { useCallback, useEffect, useState, type RefObject } from "react";
import { useTranslation } from "@/context/SettingsContext";
import "@/styles/components/scroll-to-top.css";

const SCROLL_THRESHOLD = 300;

interface ScrollToTopProps {
  containerRef: RefObject<HTMLElement | null>;
}

export function ScrollToTop({ containerRef }: ScrollToTopProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      setVisible(container.scrollTop > SCROLL_THRESHOLD);
    };

    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [containerRef]);

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [containerRef]);

  return (
    <button
      type="button"
      className={`scroll-to-top ${visible ? "scroll-to-top--visible" : ""}`}
      onClick={scrollToTop}
      aria-label={t("common.scrollToTop")}
      title={t("common.scrollToTop")}
    >
      <span className="scroll-to-top__glow" aria-hidden="true" />
      <span className="scroll-to-top__inner">
        <svg
          className="scroll-to-top__icon"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 5v14M6 11l6-6 6 6"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}
