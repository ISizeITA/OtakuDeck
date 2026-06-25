import "@/styles/components/pill-button.css";
import "@/styles/components/landing.css";

interface PillButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
}

export function PillButton({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  loading = false,
  type = "button",
}: PillButtonProps) {
  return (
    <button
      type={type}
      className={`pill-button pill-button--${variant}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && <span className="pill-button__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
