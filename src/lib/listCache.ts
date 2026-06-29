export const LIST_CACHE_INVALIDATE_EVENT = "otakudeck:list-cache-invalidate";

export function invalidateListCache(): void {
  window.dispatchEvent(new Event(LIST_CACHE_INVALIDATE_EVENT));
}
