/** Reading the property itself can throw when browser storage is disabled. */
export function getBrowserStorage(windowRef = globalThis) {
  try { return windowRef.localStorage ?? null; } catch { return null; }
}

export function createMemoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: key => values.delete(String(key)) };
}
