import { useState } from "react";
import { PillButton } from "@/components/PillButton";
import { useTranslation } from "@/context/SettingsContext";
import type { MalAccountSummary } from "@/types/accounts";
import "@/styles/components/account-switcher.css";

interface AccountSwitcherProps {
  accounts: MalAccountSummary[];
  loading?: boolean;
  busyId?: string | null;
  onSwitch: (accountId: string) => void | Promise<void>;
  onAdd: () => void | Promise<void>;
  onRemove: (accountId: string) => void | Promise<void>;
  onSignIn?: (accountId: string) => void | Promise<void>;
  compact?: boolean;
}

export function AccountSwitcher({
  accounts,
  loading = false,
  busyId = null,
  onSwitch,
  onAdd,
  onRemove,
  onSignIn,
  compact = false,
}: AccountSwitcherProps) {
  const { t } = useTranslation();
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="account-switcher account-switcher--loading">
        <span className="pill-button__spinner" />
      </div>
    );
  }

  const canAdd = accounts.length < 5;

  return (
    <div className={`account-switcher ${compact ? "account-switcher--compact" : ""}`}>
      <ul className="account-switcher__list" role="list">
        {accounts.map((account) => {
          const isBusy = busyId === account.id;
          const needsSignIn = !account.has_session;

          return (
            <li key={account.id} className="account-switcher__item">
              <button
                type="button"
                className={`account-switcher__row ${account.is_active ? "account-switcher__row--active" : ""}`}
                disabled={isBusy || (account.is_active && !needsSignIn)}
                onClick={() => {
                  if (needsSignIn) {
                    void onSignIn?.(account.id);
                  } else if (!account.is_active) {
                    void onSwitch(account.id);
                  }
                }}
              >
                {account.avatar_url ? (
                  <img
                    src={account.avatar_url}
                    alt=""
                    className="account-switcher__avatar"
                  />
                ) : (
                  <span className="account-switcher__avatar account-switcher__avatar--placeholder">
                    {account.display_name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="account-switcher__info">
                  <span className="account-switcher__name">{account.display_name}</span>
                  {needsSignIn && (
                    <span className="account-switcher__hint">{t("accounts.signInRequired")}</span>
                  )}
                </span>
                {account.is_active && !needsSignIn && (
                  <span className="account-switcher__check" aria-hidden="true">
                    ✓
                  </span>
                )}
                {isBusy && <span className="pill-button__spinner account-switcher__spinner" />}
              </button>

              {confirmRemoveId === account.id ? (
                <div className="account-switcher__confirm">
                  <span>{t("accounts.removeConfirm")}</span>
                  <div className="account-switcher__confirm-actions">
                    <button
                      type="button"
                      className="account-switcher__confirm-btn"
                      onClick={() => setConfirmRemoveId(null)}
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      type="button"
                      className="account-switcher__confirm-btn account-switcher__confirm-btn--danger"
                      onClick={() => {
                        setConfirmRemoveId(null);
                        void onRemove(account.id);
                      }}
                    >
                      {t("accounts.remove")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="account-switcher__remove"
                  aria-label={t("accounts.remove")}
                  onClick={() => setConfirmRemoveId(account.id)}
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {canAdd ? (
        <div className="account-switcher__add">
          <PillButton
            variant="secondary"
            onClick={() => void onAdd()}
            disabled={busyId !== null}
          >
            {t("accounts.add")}
          </PillButton>
        </div>
      ) : (
        <p className="account-switcher__limit">{t("accounts.maxReached")}</p>
      )}
    </div>
  );
}
