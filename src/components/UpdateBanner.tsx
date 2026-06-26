import { PillButton } from "@/components/PillButton";
import { useTranslation } from "@/context/SettingsContext";
import { useUpdate } from "@/context/UpdateContext";
import "@/styles/components/update-banner.css";

export function UpdateBanner() {
  const { t } = useTranslation();
  const { bannerVisible, updateAvailable, latestVersion, changelog, applyUpdate, dismissBanner } =
    useUpdate();

  if (!bannerVisible || !updateAvailable) return null;

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <div className="update-banner__pill">
        <span className="update-banner__text">
          <span>{t("update.banner", { version: latestVersion ?? "" })}</span>
          {changelog[0] && (
            <span className="update-banner__changelog">{changelog[0]}</span>
          )}
        </span>
        <PillButton variant="primary" onClick={() => void applyUpdate()}>
          {t("update.action")}
        </PillButton>
        <button
          type="button"
          className="update-banner__close"
          onClick={dismissBanner}
          aria-label={t("common.close")}
        >
          ×
        </button>
      </div>
    </div>
  );
}
