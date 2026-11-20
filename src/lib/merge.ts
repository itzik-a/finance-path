/* Merging two copies of the state (this device and the gist). Type-only imports, so it can be tested alone.
   - every list (sources, snapshots, txns, categories, recurring): per item, the newer `updatedAt` wins
     (soft deletes win the same way)
   - settings: the copy with the newer `settings.updatedAt` */
import type { AppState } from "../types";

function byId<T extends { id: string; updatedAt: number }>(a: T[], b: T[]): T[] {
  const out = new Map<string, T>();
  for (const x of a) out.set(x.id, x);
  for (const y of b) {
    const x = out.get(y.id);
    if (!x || (y.updatedAt || 0) > (x.updatedAt || 0)) out.set(y.id, y);
  }
  return [...out.values()];
}

export function merge(local: AppState, remote: AppState): AppState {
  return {
    v: 1,
    sources: byId(local.sources, remote.sources),
    snapshots: byId(local.snapshots, remote.snapshots),
    txns: byId(local.txns, remote.txns),
    categories: byId(local.categories, remote.categories),
    recurring: byId(local.recurring, remote.recurring),
    settings: (remote.settings.updatedAt || 0) > (local.settings.updatedAt || 0) ? remote.settings : local.settings,
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0),
  };
}

/** JSON with object keys sorted and lists in id order, so two copies with the same content compare equal. */
export function serialize(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) => {
    if (Array.isArray(x) && x.every((i) => i && typeof i === "object" && typeof (i as { id?: unknown }).id === "string")) {
      return [...x].sort((a, b) => ((a as { id: string }).id < (b as { id: string }).id ? -1 : 1));
    }
    return x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : x;
  });
}
