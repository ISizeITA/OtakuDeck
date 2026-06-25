import { useEffect, useRef } from "react";
import "@/styles/components/filters.css";

interface FilterChip {
  id: string;
  label: string;
}

interface CollapsibleFilterProps {
  label: string;
  chips: FilterChip[];
  activeId: string;
  onChange: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  align?: "start" | "center" | "end";
}

export function CollapsibleFilter({
  label,
  chips,
  activeId,
  onChange,
  open,
  onOpenChange,
  align = "start",
}: CollapsibleFilterProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeChip = chips.find((c) => c.id === activeId);
  const hasSelection = activeId !== "" && activeChip != null;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const toggle = () => onOpenChange(!open);

  const select = (id: string) => {
    onChange(id);
    onOpenChange(false);
  };

  return (
    <div
      ref={rootRef}
      className={`collapsible-filter collapsible-filter--align-${align} ${open ? "collapsible-filter--open" : ""}`}
    >
      <button
        type="button"
        className="collapsible-filter__trigger"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="collapsible-filter__label">{label}</span>
        {hasSelection && (
          <span className="collapsible-filter__value">{activeChip.label}</span>
        )}
        <span className="collapsible-filter__chevron" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div
          className="collapsible-filter__panel"
          role="listbox"
          aria-label={label}
        >
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              role="option"
              aria-selected={activeId === chip.id}
              className={`collapsible-filter__option ${activeId === chip.id ? "collapsible-filter__option--active" : ""}`}
              onClick={() => select(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
