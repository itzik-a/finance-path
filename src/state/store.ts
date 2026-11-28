/* App state, saved to localStorage on every change. Every change goes through src/state/actions.ts.
   New fields must be optional in normalize() so older saved copies still load. */
import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, SEED_CATEGORIES, seedState } from "../seed";
import type { AppState } from "../types";

export type { AppState };

const LS = "financePath.v1";

export const defaults = (): AppState => seedState();

const arr = <T,>(v: unknown, d: T[]): T[] => (Array.isArray(v) ? (v as T[]) : d);
const obj = <T extends object>(v: unknown): Partial<T> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<T>) : {});

/** Starter categories added after a copy was saved (e.g. Loan payments) join it, at their place in the seed list.
    They carry `updatedAt: 0`, so every device adds the same item and any edit or delete wins over it. */
function withSeedCategories(cats: AppState["categories"]): AppState["categories"] {
  const have = new Set(cats.map((c) => c.id));
  const out = [...cats];
  SEED_CATEGORIES.forEach((c, i) => {
    if (have.has(c.id)) return;
    const prev = SEED_CATEGORIES.slice(0, i).reverse().find((p) => have.has(p.id));
    const at = prev ? out.findIndex((x) => x.id === prev.id) + 1 : 0;
    out.splice(at, 0, c);
    have.add(c.id);
  });
  return out;
}

export function normalize(s: unknown): AppState {
  const d = defaults();
  if (!s || typeof s !== "object") return d;
  const x = s as Partial<AppState>;
  return {
    v: 1,
    sources: arr(x.sources, d.sources).map((src) => ({ ...src, raisePct: src.raisePct ?? 0, feeDepositPct: src.feeDepositPct ?? 0, feeBalancePct: src.feeBalancePct ?? 0, color: src.color ?? 0 })),
    snapshots: arr(x.snapshots, d.snapshots),
    txns: arr(x.txns, d.txns),
    categories: withSeedCategories(arr(x.categories, d.categories)),
    recurring: arr(x.recurring, d.recurring),
    settings: { ...DEFAULT_SETTINGS, ...obj<AppState["settings"]>(x.settings) },
    updatedAt: x.updatedAt || 0,
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* fall through */ }
  return defaults();
}

let state: AppState = load();
const listeners = new Set<() => void>();
const localListeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
function saveLocal() {
  try { localStorage.setItem(LS, JSON.stringify(state)); } catch { /* storage full or blocked */ }
}

export const getState = () => state;

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Apply a local change: copy, mutate, stamp, save, notify. */
export function update(fn: (draft: AppState) => void) {
  const next = structuredClone(state);
  fn(next);
  next.updatedAt = Date.now();
  state = next;
  saveLocal();
  emit();
  localListeners.forEach((l) => l());
}

/** Called after changes made on this device (not after sync replaces state). */
export function onLocalChange(l: () => void) {
  localListeners.add(l);
  return () => { localListeners.delete(l); };
}

/** Replace state wholesale (sync brought a newer copy, or a backup was merged in: `local` makes it sync out). */
export function replaceState(s: unknown, opts: { local?: boolean } = {}) {
  state = normalize(s);
  saveLocal();
  emit();
  if (opts.local) localListeners.forEach((l) => l());
}

export function useAppState() {
  return useSyncExternalStore(subscribe, getState);
}

/* Keep two open tabs on the same device in step. */
window.addEventListener("storage", (e) => {
  if (e.key === LS && e.newValue) {
    try { state = normalize(JSON.parse(e.newValue)); emit(); } catch { /* ignore */ }
  }
});
