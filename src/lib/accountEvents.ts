export const ACCOUNT_SWITCHED_EVENT = "account-switched";

export function dispatchAccountSwitched(accountId: string) {
  window.dispatchEvent(
    new CustomEvent(ACCOUNT_SWITCHED_EVENT, { detail: { accountId } }),
  );
}
