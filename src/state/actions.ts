/* Every change to the app state goes through here. Each edit stamps the item's `updatedAt`, which sync merges by.
   Deletes are soft (`deletedAt`) with an Undo toast. Editing an example makes it yours (drops `example`). */
import { addMonths, monthDiff, monthEnd, monthOf, todayStr } from "../lib/dates";
import { showToast } from "../lib/toast";
import { uid } from "../lib/uid";
import type { AppState, Category, Recurring, Settings, Snapshot, Source, Txn } from "../types";
import { getState, update } from "./store";

type Item = { id: string; updatedAt: number; deletedAt?: number; example?: boolean };
type ListKey = "sources" | "snapshots" | "txns" | "categories" | "recurring";

const live = <T extends { deletedAt?: number }>(xs: T[]) => xs.filter((x) => !x.deletedAt);
export const liveSources = (s: AppState) => live(s.sources);
export const liveCategories = (s: AppState) => live(s.categories);
export const liveTxns = (s: AppState) => live(s.txns);
export const liveRecurring = (s: AppState) => live(s.recurring);
export const liveSnapshots = (s: AppState) => live(s.snapshots).filter((x) => s.sources.some((src) => src.id === x.sourceId && !src.deletedAt));

function edit<K extends ListKey>(key: K, id: string, fn: (x: AppState[K][number]) => void) {
  update((d) => {
    const x = (d[key] as Item[]).find((i) => i.id === id) as AppState[K][number] | undefined;
    if (x) { fn(x); delete (x as Item).example; x.updatedAt = Date.now(); }
  });
}

function softDelete<K extends ListKey>(key: K, id: string, label: string) {
  update((d) => {
    const x = (d[key] as Item[]).find((i) => i.id === id);
    if (x) { x.deletedAt = Date.now(); x.updatedAt = x.deletedAt; }
  });
  showToast(`Removed ${label}`, {
    label: "Undo",
    run: () => update((d) => {
      const x = (d[key] as Item[]).find((i) => i.id === id);
      if (x) { delete x.deletedAt; x.updatedAt = Date.now(); }
    }),
  });
}

// ── sources ───────────────────────────────────────────────────

/** The lowest colour slot no live source uses (8 = past the palette: drawn grey, folded into "Other"). */
function freeColor(s: AppState) {
  const used = new Set(liveSources(s).map((x) => x.color));
  for (let i = 0; i < 8; i++) if (!used.has(i)) return i;
  return 8;
}

export type SourceInput = Omit<Source, "id" | "updatedAt" | "color" | "example" | "deletedAt">;

export function addSource(s: SourceInput, balance?: number) {
  const id = uid();
  update((d) => {
    d.sources.push({ ...s, name: s.name.trim() || "Untitled", id, color: freeColor(d), updatedAt: Date.now() });
    if (balance != null && !Number.isNaN(balance)) d.snapshots.push({ id: uid(), sourceId: id, date: todayStr(), balance, updatedAt: Date.now() });
  });
  return id;
}

export const editSource = (id: string, fn: (s: Source) => void) => edit("sources", id, fn);

export function deleteSource(id: string) {
  const s = getState().sources.find((x) => x.id === id);
  if (s) softDelete("sources", id, s.name);
}

// ── snapshots ─────────────────────────────────────────────────

/** Record a balance; one per source per date (a second one on the same date replaces it). */
export function addSnapshot(sourceId: string, date: string, balance: number) {
  update((d) => {
    const same = d.snapshots.find((x) => x.sourceId === sourceId && x.date === date && !x.deletedAt);
    if (same) { same.balance = balance; delete same.example; same.updatedAt = Date.now(); }
    else d.snapshots.push({ id: uid(), sourceId, date, balance, updatedAt: Date.now() });
  });
}

export const editSnapshot = (id: string, fn: (s: Snapshot) => void) => edit("snapshots", id, fn);
export const deleteSnapshot = (id: string) => softDelete("snapshots", id, "the balance");

// ── transactions ──────────────────────────────────────────────

export type TxnInput = Omit<Txn, "id" | "updatedAt" | "example" | "deletedAt" | "recurringId" | "plan">;

export function addTxn(t: TxnInput) {
  const id = uid();
  update((d) => { d.txns.push({ ...t, note: t.note?.trim() || undefined, id, updatedAt: Date.now() }); });
  return id;
}

export const editTxn = (id: string, fn: (t: Txn) => void) => edit("txns", id, fn);
export const deleteTxn = (id: string) => softDelete("txns", id, "the transaction");

// ── purchases in payments ─────────────────────────────────────

/** A total split into `parts` amounts, to the agora / cent; what doesn't divide evenly goes on the first. */
export function splitAmount(total: number, parts: number): number[] {
  const cents = Math.round(total * 100);
  const each = Math.floor(cents / parts);
  return Array.from({ length: parts }, (_, i) => (i === 0 ? cents - each * (parts - 1) : each) / 100);
}

/** The date of payment i (0 = the first): the first one's day of the month, or that month's last day. */
export function planDate(first: string, i: number): string {
  const ym = addMonths(monthOf(first), i);
  const date = `${ym}-${first.slice(8, 10)}`;
  const end = monthEnd(ym);
  return date > end ? end : date;
}

/** The first payment's date of a purchase (from its first payment, or worked back from this one). */
export function planFirstDate(s: AppState, t: Txn): string {
  if (!t.plan) return t.date;
  const first = s.txns.find((x) => x.id === `p_${t.plan!.id}_1`);
  return first?.date ?? planDate(t.date, 1 - t.plan.part);
}

export type PlanInput = Omit<TxnInput, "amount" | "date" | "plan"> & { total: number; parts: number; first: string };

/** Save a purchase paid in monthly payments: one transaction per payment, id `p_<plan id>_<n>`, so two devices
    write the same ones. Saving again rewrites every payment and removes those past a smaller count (one payment
    leaves a plain transaction). `replace`: a plain transaction being turned into payments, removed. */
export function savePlan(p: PlanInput, planId = uid(), replace?: string) {
  const { total, parts, first, ...base } = p;
  const amounts = splitAmount(total, parts);
  update((d) => {
    const now = Date.now();
    for (let i = 0; i < parts; i++) {
      const id = `p_${planId}_${i + 1}`;
      const t: Txn = { ...base, note: base.note?.trim() || undefined, id, date: planDate(first, i), amount: amounts[i], updatedAt: now };
      if (parts > 1) t.plan = { id: planId, part: i + 1, parts, total };
      const at = d.txns.findIndex((x) => x.id === id);
      if (at >= 0) d.txns[at] = t; else d.txns.push(t);
    }
    for (const x of d.txns) {
      if ((x.plan?.id === planId && x.plan.part > parts && !x.deletedAt) || (replace && x.id === replace)) { x.deletedAt = now; x.updatedAt = now; }
    }
  });
}

/** Remove every payment of a purchase, with one Undo. */
export function deletePlan(planId: string) {
  const ids = getState().txns.filter((t) => t.plan?.id === planId && !t.deletedAt).map((t) => t.id);
  update((d) => {
    const now = Date.now();
    for (const x of d.txns) if (ids.includes(x.id)) { x.deletedAt = now; x.updatedAt = now; }
  });
  showToast(`Removed the purchase (${ids.length} payments)`, {
    label: "Undo",
    run: () => update((d) => {
      const now = Date.now();
      for (const x of d.txns) if (ids.includes(x.id)) { delete x.deletedAt; x.updatedAt = now; }
    }),
  });
}

// ── categories ────────────────────────────────────────────────

export function addCategory(c: Pick<Category, "name" | "kind" | "emoji">) {
  const id = uid();
  update((d) => { d.categories.push({ ...c, name: c.name.trim() || "Untitled", id, updatedAt: Date.now() }); });
  return id;
}

export const editCategory = (id: string, fn: (c: Category) => void) => edit("categories", id, fn);

export function deleteCategory(id: string) {
  const c = getState().categories.find((x) => x.id === id);
  if (c) softDelete("categories", id, c.name);
}

// ── recurring ─────────────────────────────────────────────────

export type RecurringInput = Omit<Recurring, "id" | "updatedAt" | "example" | "deletedAt">;

export function addRecurring(r: RecurringInput) {
  const id = uid();
  update((d) => { d.recurring.push({ ...r, id, updatedAt: Date.now() }); });
  applyRecurring();
  return id;
}

export function editRecurring(id: string, fn: (r: Recurring) => void) {
  edit("recurring", id, fn);
  applyRecurring();
}

export function deleteRecurring(id: string) {
  softDelete("recurring", id, "the recurring item");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Every date a recurring item was due on, from its start up to today (or its end). */
export function dueDates(r: Recurring, today = todayStr()): { key: string; date: string }[] {
  const last = r.end && r.end < today ? r.end : today;
  const out: { key: string; date: string }[] = [];
  const day = pad(Math.min(28, Math.max(1, r.day)));
  if (r.every === "month") {
    const first = monthOf(r.start);
    const n = monthDiff(first, monthOf(last));
    for (let i = 0; i <= n; i++) {
      const ym = addMonths(first, i);
      const date = `${ym}-${day}`;
      if (date >= r.start && date <= last) out.push({ key: ym, date });
    }
  } else {
    const m = pad(Math.min(12, Math.max(1, r.month ?? 1)));
    for (let y = Number(r.start.slice(0, 4)); y <= Number(last.slice(0, 4)); y++) {
      const date = `${y}-${m}-${day}`;
      if (date >= r.start && date <= last) out.push({ key: String(y), date });
    }
  }
  return out;
}

/** The first date after today a recurring item is due on; none once it has ended. */
export function nextDue(r: Recurring, today = todayStr()): string | undefined {
  const day = pad(Math.min(28, Math.max(1, r.day)));
  const from = r.start > today ? r.start : today;
  for (let i = 0; i < 14; i++) {
    const ym = addMonths(monthOf(from), i);
    if (r.every === "year" && Number(ym.slice(5, 7)) !== Math.min(12, Math.max(1, r.month ?? 1))) continue;
    const date = `${ym}-${day}`;
    if (date > today && date >= r.start) return r.end && date > r.end ? undefined : date;
  }
  return undefined;
}

/** The dates a recurring item is due on within a month ("YYYY-MM"), after `after` (a date) when given. */
export const dueIn = (r: Recurring, ym: string, after = "") =>
  dueDates(r, monthEnd(ym)).filter((x) => x.date.startsWith(ym) && x.date > after).map((x) => x.date);

/** Add the transactions recurring items are due for. Ids are fixed (`r_<id>_<period>`), so two devices
    add the same ones, and a deleted one stays deleted. Called on start, after sync and after edits. */
export function applyRecurring() {
  const s = getState();
  const have = new Set(s.txns.map((t) => t.id));
  const add: Txn[] = [];
  for (const r of liveRecurring(s)) {
    for (const { key, date } of dueDates(r)) {
      const id = `r_${r.id}_${key}`;
      if (have.has(id)) continue;
      add.push({
        id, kind: r.kind, date, amount: r.amount, currency: r.currency, categoryId: r.categoryId, sourceId: r.sourceId,
        note: r.note, recurringId: r.id, ...(r.example ? { example: true, updatedAt: 0 } : { updatedAt: Date.now() }),
      });
    }
  }
  if (add.length) update((d) => { d.txns.push(...add); });
}

// ── settings ──────────────────────────────────────────────────

export function setSettings(fn: (s: Settings) => void) {
  update((d) => { fn(d.settings); d.settings.updatedAt = Date.now(); });
}

export function setRate(usdIls: number, fromService = false) {
  setSettings((s) => {
    s.usdIls = Math.round(usdIls * 10_000) / 10_000;
    if (fromService) s.rateAt = Date.now();
    else s.rateAuto = false;
  });
}

// ── examples ──────────────────────────────────────────────────

const LISTS: ListKey[] = ["sources", "snapshots", "txns", "categories", "recurring"];

export const hasExamples = (s: AppState) => LISTS.some((k) => (s[k] as Item[]).some((x) => x.example && !x.deletedAt));

/** Remove every example still untouched (edited ones are yours and stay). */
export function removeExamples() {
  const ids: [ListKey, string][] = [];
  update((d) => {
    const now = Date.now();
    for (const k of LISTS) for (const x of d[k] as Item[]) {
      if (x.example && !x.deletedAt) { x.deletedAt = now; x.updatedAt = now; ids.push([k, x.id]); }
    }
  });
  showToast("Examples removed", {
    label: "Undo",
    run: () => update((d) => {
      const now = Date.now();
      for (const [k, id] of ids) {
        const x = (d[k] as Item[]).find((i) => i.id === id);
        if (x) { delete x.deletedAt; x.updatedAt = now; }
      }
    }),
  });
}
