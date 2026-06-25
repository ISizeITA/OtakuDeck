import { useId } from "react";

interface OtakuDeckLogoProps {
  className?: string;
  title?: string;
}

export function OtakuDeckLogo({ className, title = "OtakuDeck" }: OtakuDeckLogoProps) {
  const gradientId = useId().replace(/:/g, "");

  return (
    <svg
      className={className}
      viewBox="0 0 36 36"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff5e3a" />
          <stop offset="100%" stopColor="#ffb900" />
        </linearGradient>
      </defs>
      <rect x="4" y="8" width="28" height="20" rx="6" fill={`url(#${gradientId})`} />
      <rect x="8" y="12" width="8" height="12" rx="3" fill="#121214" opacity="0.55" />
      <rect x="20" y="12" width="8" height="12" rx="3" fill="#121214" opacity="0.55" />
      <circle cx="18" cy="6" r="3" fill={`url(#${gradientId})`} />
    </svg>
  );
}
