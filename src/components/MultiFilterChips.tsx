import "@/styles/components/filters.css";

interface FilterChip {
  id: string;
  label: string;
}

interface MultiFilterChipsProps {
  chips: FilterChip[];
  activeIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}

export function MultiFilterChips({
  chips,
  activeIds,
  onChange,
  label,
}: MultiFilterChipsProps) {
  const toggle = (id: string) => {
    if (activeIds.includes(id)) {
      onChange(activeIds.filter((x) => x !== id));
    } else {
      onChange([...activeIds, id]);
    }
  };

  return (
    <div className="filter-chips">
      {label && (
        <span className="filter-chips__label">
          {label}
          {activeIds.length > 0 && (
            <span className="filter-chips__count"> ({activeIds.length})</span>
          )}
        </span>
      )}
      <div className="filter-chips__list" role="group" aria-label={label}>
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`filter-chips__chip ${activeIds.includes(chip.id) ? "filter-chips__chip--active" : ""}`}
            onClick={() => toggle(chip.id)}
            aria-pressed={activeIds.includes(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
