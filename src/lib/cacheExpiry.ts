/** Keep the soonest cache expiry when multiple API responses use cache. */
export function mergeCacheExpiry(
  current: string | null,
  next?: string | null,
): string | null {
  if (!next) return current;
  if (!current) return next;
  return new Date(next).getTime() < new Date(current).getTime() ? next : current;
}

export function cacheExpiryFromResponse(
  fromCache: boolean,
  cacheExpiresAt?: string | null,
): string | null {
  return fromCache && cacheExpiresAt ? cacheExpiresAt : null;
}
