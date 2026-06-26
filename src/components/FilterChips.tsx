import "@/styles/components/filters.css";

interface FilterChip {
  id: string;
  label: string;
}

interface FilterChipsProps {
  chips: FilterChip[];
  activeId: string;
  onChange: (id: string) => void;
  label?: string;
  multi?: boolean;
  activeIds?: string[];
}

export function FilterChips({
  chips,
  activeId,
  onChange,
  label,
  multi = false,
  activeIds = [],
}: FilterChipsProps) {
  const isActive = (id: string) =>
    multi ? activeIds.includes(id) : activeId === id;

  return (
    <div className="filter-chips">
      {label && <span className="filter-chips__label">{label}</span>}
      <div className="filter-chips__list" role="group" aria-label={label}>
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`filter-chips__chip ${isActive(chip.id) ? "filter-chips__chip--active" : ""}`}
            onClick={() => onChange(chip.id)}
            aria-pressed={isActive(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
