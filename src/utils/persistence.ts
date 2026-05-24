/** Load state from localStorage, fallback to defaultValue */
export function loadState<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // corrupted data — ignore
  }
  return defaultValue;
}

/** Save state to localStorage */
export function saveState<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // storage full or unavailable — surface a warning so silent persistence
    // failures don't go unnoticed in production.
    const name = (e as { name?: string })?.name;
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      console.warn(`[persistence] localStorage quota exceeded — failed to save '${key}'.`);
    } else {
      console.warn(`[persistence] Failed to save '${key}':`, e);
    }
  }
}
