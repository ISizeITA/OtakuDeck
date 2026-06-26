import { useCallback, useEffect, useState } from "react";
import { PillButton } from "@/components/PillButton";
import { useTranslation } from "@/context/SettingsContext";
import { api } from "@/lib/api";
import "@/styles/components/profile.css";
import type { UpdateUserProfileRequest, UserProfile } from "@/types/mal";

interface ProfilePageProps {
  onClose: () => void;
  onSaved?: (name: string) => void;
}

const GENDER_OPTIONS = ["", "male", "female", "non-binary", "other"] as const;

export function ProfilePage({ onClose, onSaved }: ProfilePageProps) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [gender, setGender] = useState("");
  const [location, setLocation] = useState("");
  const [birthday, setBirthday] = useState("");
  const [timeZone, setTimeZone] = useState("");
  const [about, setAbout] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const applyProfile = useCallback((data: UserProfile) => {
    setProfile(data);
    setGender(data.gender ?? "");
    setLocation(data.location ?? "");
    setBirthday(data.birthday?.split("T")[0] ?? "");
    setTimeZone(data.time_zone ?? "");
    setAbout(data.about ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getUserProfile()
      .then((resp) => {
        if (cancelled) return;
        applyProfile(resp.data);
        setOffline(resp.from_cache);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyProfile]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const update: UpdateUserProfileRequest = {
      gender: gender || undefined,
      location: location.trim() || undefined,
      birthday: birthday || undefined,
      time_zone: timeZone.trim() || undefined,
      about: about.trim() || undefined,
    };
    try {
      const saved = await api.updateUserProfile(update);
      applyProfile(saved);
      setOffline(false);
      onSaved?.(saved.name);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const stats = profile?.anime_statistics;

  return (
    <div className="profile-overlay" onClick={onClose} role="presentation">
      <div
        className="profile-page"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="profile-title"
      >
        <header className="profile-page__header">
          <h2 id="profile-title" className="profile-page__title">
            {t("profile.title")}
          </h2>
          <button
            type="button"
            className="profile-page__close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>

        {loading ? (
          <div className="profile-page__loading">
            <span className="pill-button__spinner" />
          </div>
        ) : profile ? (
          <div className="profile-page__body">
            {offline && (
              <p className="profile-page__offline">{t("common.offlineCache")}</p>
            )}

            <div className="profile-hero">
              {profile.picture && (
                <img
                  className="profile-hero__avatar"
                  src={profile.picture}
                  alt=""
                />
              )}
              <div>
                <h3 className="profile-hero__name">{profile.name}</h3>
                <p className="profile-hero__hint">{t("profile.malSync")}</p>
              </div>
            </div>

            {stats && (
              <section className="profile-stats">
                <h4 className="profile-stats__title">{t("profile.stats")}</h4>
                <div className="profile-stats__grid">
                  <div>
                    <span className="profile-stats__value">
                      {stats.num_items ?? 0}
                    </span>
                    <span className="profile-stats__label">
                      {t("profile.statsTotal")}
                    </span>
                  </div>
                  <div>
                    <span className="profile-stats__value">
                      {stats.num_items_watching ?? 0}
                    </span>
                    <span className="profile-stats__label">
                      {t("listStatus.watching")}
                    </span>
                  </div>
                  <div>
                    <span className="profile-stats__value">
                      {stats.num_episodes ?? 0}
                    </span>
                    <span className="profile-stats__label">
                      {t("profile.statsEpisodes")}
                    </span>
                  </div>
                  <div>
                    <span className="profile-stats__value">
                      {stats.mean_score?.toFixed(1) ?? "—"}
                    </span>
                    <span className="profile-stats__label">
                      {t("profile.statsMean")}
                    </span>
                  </div>
                  <div>
                    <span className="profile-stats__value">
                      {(stats.num_items ?? 0) > 0
                        ? `${Math.round(((stats.num_items_completed ?? 0) / (stats.num_items ?? 1)) * 100)}%`
                        : "—"}
                    </span>
                    <span className="profile-stats__label">
                      {t("profile.statsCompletion")}
                    </span>
                  </div>
                  <div>
                    <span className="profile-stats__value">
                      {stats.num_items_dropped ?? 0}
                    </span>
                    <span className="profile-stats__label">
                      {t("profile.statsDropped")}
                    </span>
                  </div>
                  <div>
                    <span className="profile-stats__value">
                      {(stats.num_items ?? 0) > 0
                        ? Math.round((stats.num_episodes ?? 0) / (stats.num_items ?? 1))
                        : 0}
                    </span>
                    <span className="profile-stats__label">
                      {t("profile.statsAvgEpisodes")}
                    </span>
                  </div>
                </div>
              </section>
            )}

            <section className="profile-form">
              <h4 className="profile-form__title">{t("profile.edit")}</h4>

              <label className="profile-field">
                <span className="profile-field__label">{t("profile.gender")}</span>
                <select
                  className="profile-field__input"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  {GENDER_OPTIONS.map((value) => (
                    <option key={value || "none"} value={value}>
                      {value
                        ? t(`profile.gender.${value}` as "profile.gender")
                        : t("profile.gender.unset")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="profile-field">
                <span className="profile-field__label">{t("profile.location")}</span>
                <input
                  className="profile-field__input"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={1024}
                />
              </label>

              <label className="profile-field">
                <span className="profile-field__label">{t("profile.birthday")}</span>
                <input
                  className="profile-field__input"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
              </label>

              <label className="profile-field">
                <span className="profile-field__label">{t("profile.timeZone")}</span>
                <input
                  className="profile-field__input"
                  type="text"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  placeholder="Europe/Rome"
                />
              </label>

              <label className="profile-field">
                <span className="profile-field__label">{t("profile.about")}</span>
                <textarea
                  className="profile-field__textarea"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  rows={5}
                  maxLength={5000}
                />
              </label>

              {error && <p className="profile-page__error">{error}</p>}

              <PillButton
                variant="primary"
                onClick={handleSave}
                loading={saving}
                disabled={saving || offline}
              >
                {t("profile.save")}
              </PillButton>
            </section>
          </div>
        ) : (
          <p className="profile-page__error">{error ?? t("profile.loadError")}</p>
        )}
      </div>
    </div>
  );
}
