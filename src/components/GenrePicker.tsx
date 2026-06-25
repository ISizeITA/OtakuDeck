import { useEffect, useMemo, useState } from "react";
import { GENRE_BY_ID, GENRE_GROUPS, type GenreGroupId } from "@/data/malGenres";
import { useTranslation } from "@/context/SettingsContext";
import { useMalLabels } from "@/hooks/useMalLabels";
import type { TranslationKey } from "@/i18n/translations";
import "@/styles/components/genre-picker.css";

const DEFAULT_OPEN: Record<GenreGroupId, boolean> = {
  main: true,
  demographic: false,
  theme: false,
  explicit: false,
};

interface GenrePickerProps {
  open: boolean;
  selectedIds: string[];
  onClose: () => void;
  onApply: (ids: string[]) => void;
}

function genreLabel(id: number, genre: (id: number, fallback?: string) => string): string {
  const meta = GENRE_BY_ID.get(id);
  return genre(id, meta?.name);
}

export function GenrePicker({ open, selectedIds, onClose, onApply }: GenrePickerProps) {
  const { t } = useTranslation();
  const { genre } = useMalLabels();
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const [query, setQuery] = useState("");
  const [openSections, setOpenSections] = useState(DEFAULT_OPEN);

  useEffect(() => {
    if (open) {
      setDraft(selectedIds);
      setQuery("");
      setOpenSections(DEFAULT_OPEN);
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  }, [open, selectedIds]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return GENRE_GROUPS;

    return GENRE_GROUPS.map((group) => ({
      ...group,
      genreIds: group.genreIds.filter((id) =>
        genreLabel(id, genre).toLowerCase().includes(normalizedQuery),
      ),
    })).filter((group) => group.genreIds.length > 0);
  }, [normalizedQuery, genre]);

  const toggleGenre = (id: string) => {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSection = (id: GenreGroupId) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!open) return null;

  return (
    <div className="genre-picker-overlay" onClick={onClose} role="presentation">
      <div
        className="genre-picker"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="genre-picker-title"
      >
        <header className="genre-picker__header">
          <h2 id="genre-picker-title" className="genre-picker__title">
            {t("archive.genrePickerTitle")}
          </h2>
          <button
            type="button"
            className="genre-picker__close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>

        <div className="genre-picker__body">
          <input
            type="search"
            className="genre-picker__search"
            placeholder={t("archive.genreSearchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {filteredGroups.length === 0 ? (
            <p className="genre-picker__empty">{t("archive.genreSearchEmpty")}</p>
          ) : (
            <div className="genre-picker__sections">
            {filteredGroups.map((group) => {
              const sectionOpen = normalizedQuery ? true : openSections[group.id];
              const title = t(`archive.genreGroup.${group.id}` as TranslationKey);

              return (
                <section
                  key={group.id}
                  className={`genre-picker__section ${sectionOpen ? "genre-picker__section--open" : ""}`}
                >
                  <button
                    type="button"
                    className="genre-picker__section-toggle"
                    onClick={() => toggleSection(group.id)}
                    aria-expanded={sectionOpen}
                  >
                    <span>{title}</span>
                    <span className="genre-picker__chevron" aria-hidden="true">
                      {sectionOpen ? "▾" : "▸"}
                    </span>
                  </button>
                  {sectionOpen && (
                    <div className="genre-picker__section-panel">
                      <div className="genre-picker__chips" role="group" aria-label={title}>
                      {group.genreIds.map((id) => {
                        const sid = String(id);
                        const active = draft.includes(sid);
                        return (
                          <button
                            key={sid}
                            type="button"
                            className={`genre-picker__chip ${active ? "genre-picker__chip--active" : ""}`}
                            onClick={() => toggleGenre(sid)}
                            aria-pressed={active}
                          >
                            {genreLabel(id, genre)}
                          </button>
                        );
                      })}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
            </div>
          )}
        </div>

        <footer className="genre-picker__footer">
          <button type="button" className="genre-picker__btn genre-picker__btn--ghost" onClick={onClose}>
            {t("archive.genreCancel")}
          </button>
          <button
            type="button"
            className="genre-picker__btn genre-picker__btn--primary"
            onClick={() => onApply(draft)}
          >
            {t("archive.genreApply", { count: draft.length })}
          </button>
        </footer>
      </div>
    </div>
  );
}
