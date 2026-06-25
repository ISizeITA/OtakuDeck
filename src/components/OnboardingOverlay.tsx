import { useState } from "react";
import { PillButton } from "@/components/PillButton";
import { OtakuDeckLogo } from "@/components/OtakuDeckLogo";
import { useSettings } from "@/context/SettingsContext";
import { markOnboardingComplete } from "@/lib/settingsStorage";
import type { TranslationKey } from "@/i18n/translations";
import "@/styles/components/onboarding.css";

const STEPS: { titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
  { titleKey: "onboarding.home.title", bodyKey: "onboarding.home.body" },
  { titleKey: "onboarding.archive.title", bodyKey: "onboarding.archive.body" },
  { titleKey: "onboarding.list.title", bodyKey: "onboarding.list.body" },
  { titleKey: "onboarding.calendar.title", bodyKey: "onboarding.calendar.body" },
  { titleKey: "onboarding.search.title", bodyKey: "onboarding.search.body" },
];

interface OnboardingOverlayProps {
  onComplete: () => void;
}

export function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const { t, searchShortcutLabel } = useSettings();
  const [step, setStep] = useState(0);

  const finish = () => {
    markOnboardingComplete();
    onComplete();
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true">
      <div className="onboarding-card">
        <OtakuDeckLogo className="onboarding-card__logo" title="" />
        <p className="onboarding-card__step">
          {t("onboarding.step", { current: step + 1, total: STEPS.length })}
        </p>
        <h2 className="onboarding-card__title">{t(current.titleKey)}</h2>
        <p className="onboarding-card__body">
          {current.bodyKey === "onboarding.search.body"
            ? t(current.bodyKey, { shortcut: searchShortcutLabel })
            : t(current.bodyKey)}
        </p>

        <div className="onboarding-card__dots" aria-hidden="true">
          {STEPS.map((_, index) => (
            <span
              key={index}
              className={`onboarding-card__dot ${index === step ? "onboarding-card__dot--active" : ""}`}
            />
          ))}
        </div>

        <div className="onboarding-card__actions">
          <button type="button" className="onboarding-card__skip" onClick={finish}>
            {t("onboarding.skip")}
          </button>
          {!isLast ? (
            <PillButton variant="primary" onClick={() => setStep((s) => s + 1)}>
              {t("onboarding.next")}
            </PillButton>
          ) : (
            <PillButton variant="primary" onClick={finish}>
              {t("onboarding.start")}
            </PillButton>
          )}
        </div>
      </div>
    </div>
  );
}
