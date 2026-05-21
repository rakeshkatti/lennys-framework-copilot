export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PersistedSnapshot {
  specId: string;
  specVersion: string;
  cursor: string;
  inputs: Record<string, unknown>;
}

export interface LoadResult {
  snapshot: PersistedSnapshot | null;
  discarded: boolean;
  notice: string | null;
}

export function storageKeyFor(specId: string): string {
  return `lenny-copilot:engine:${specId}`;
}

export function saveSnapshot(
  storage: Storage,
  snapshot: PersistedSnapshot,
): void {
  storage.setItem(storageKeyFor(snapshot.specId), JSON.stringify(snapshot));
}

export function loadSnapshot(
  storage: Storage,
  specId: string,
  currentSpecVersion: string,
): LoadResult {
  const raw = storage.getItem(storageKeyFor(specId));
  if (!raw) return { snapshot: null, discarded: false, notice: null };
  let parsed: PersistedSnapshot;
  try {
    parsed = JSON.parse(raw) as PersistedSnapshot;
  } catch {
    storage.removeItem(storageKeyFor(specId));
    return {
      snapshot: null,
      discarded: true,
      notice: "Saved progress was corrupt and has been discarded.",
    };
  }
  if (parsed.specVersion !== currentSpecVersion) {
    storage.removeItem(storageKeyFor(specId));
    return {
      snapshot: null,
      discarded: true,
      notice: `Framework spec changed (was v${parsed.specVersion}, now v${currentSpecVersion}). Saved progress has been discarded.`,
    };
  }
  return { snapshot: parsed, discarded: false, notice: null };
}

export function clearSnapshot(storage: Storage, specId: string): void {
  storage.removeItem(storageKeyFor(specId));
}

export function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}
