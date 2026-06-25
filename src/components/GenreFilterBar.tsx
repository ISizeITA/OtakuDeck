import { GENRE_BY_ID } from "@/data/malGenres";
import { useTranslation } from "@/context/SettingsContext";
import { useMalLabels } from "@/hooks/useMalLabels";
import type { TranslationKey } from "@/i18n/translations";
import "@/styles/components/genre-picker.css";

interface GenreFilterBarProps {
  selectedIds: string[];
  onOpenPicker: () => void;
  onChange: (ids: string[]) => void;
  labelKey?: TranslationKey;
}

export function GenreFilterBar({
  selectedIds,
  onOpenPicker,
  onChange,
  labelKey = "archive.genres",
}: GenreFilterBarProps) {
  const { t } = useTranslation();
  const { genre } = useMalLabels();

  const remove = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  const labelFor = (id: string) => {
    const num = Number(id);
    const meta = GENRE_BY_ID.get(num);
    return genre(num, meta?.name);
  };

  return (
    <div className="genre-filter">
      <span className="genre-filter__label">{t(labelKey)}</span>
      <div className="genre-filter__actions">
        <button type="button" className="genre-filter__open" onClick={onOpenPicker}>
          {t("archive.genreChoose")}
          <span className="genre-filter__chevron" aria-hidden="true">
            ▾
          </span>
        </button>
        {selectedIds.length > 0 && (
          <button
            type="button"
            className="genre-filter__clear"
            onClick={() => onChange([])}
          >
            {t("archive.genreClear")}
          </button>
        )}
      </div>
      {selectedIds.length > 0 && (
        <div className="genre-filter__active">
          {selectedIds.map((id) => (
            <button
              key={id}
              type="button"
              className="genre-filter__pill"
              onClick={() => remove(id)}
              aria-label={t("archive.genreRemove", { name: labelFor(id) })}
            >
              {labelFor(id)}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <span className="genre-filter__count">
            {t("archive.genreSelectedCount", { count: selectedIds.length })}
          </span>
        </div>
      )}
    </div>
  );
}
