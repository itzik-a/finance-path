/* Reading the state: balances, net worth, month sums. Pure functions of AppState. */
import { liveSnapshots, liveSources, liveTxns } from "../state/actions";
import type { AppState, Currency, Snapshot, Source, SourceKind, TxnKind } from "../types";
import { addMonths, monthDiff, monthEnd, monthOf, thisMonth, todayStr } from "./dates";
import { convert } from "./money";

export const KINDS: { id: SourceKind; label: string; returnPct: number }[] = [
  { id: "pension", label: "Pension fund", returnPct: 5 },
  { id: "hishtalmut", label: "Keren hishtalmut", returnPct: 5.5 },
  { id: "gemel", label: "Kupat gemel", returnPct: 5 },
  { id: "brokerage", label: "Stocks & funds", returnPct: 7 },
  { id: "savings", label: "Savings & deposits", returnPct: 4 },
  { id: "crypto", label: "Crypto", returnPct: 8 },
  { id: "cash", label: "Cash", returnPct: 0 },
  { id: "realestate", label: "Real estate", returnPct: 4 },
  { id: "other", label: "Other", returnPct: 4 },
];
export const kindLabel = (k: SourceKind) => KINDS.find((x) => x.id === k)?.label ?? "Other";

/** The CSS colour of a source's slot (past eight: grey "other"). */
export const sourceColor = (s: Pick<Source, "color">) => (s.color >= 0 && s.color < 8 ? `var(--s${s.color + 1})` : "var(--s-other)");

/** A source's balances, oldest first. */
export function snapshotsOf(s: AppState, sourceId: string): Snapshot[] {
  return liveSnapshots(s).filter((x) => x.sourceId === sourceId).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.updatedAt - b.updatedAt));
}

/** The latest balance on or before `date` (default: any). */
export function balanceOf(s: AppState, sourceId: string, date?: string): Snapshot | undefined {
  const xs = snapshotsOf(s, sourceId);
  for (let i = xs.length - 1; i >= 0; i--) if (!date || xs[i].date <= date) return xs[i];
  return undefined;
}

/** Amount in the display currency. */
export const toDisplay = (s: AppState, amount: number, from: Currency) => convert(amount, from, s.settings.display, s.settings);

/** Net worth now, in the display currency, and the oldest "as of" among the sources. */
export function netWorth(s: AppState, date?: string): { total: number; asOf?: string } {
  let total = 0;
  let asOf: string | undefined;
  for (const src of liveSources(s)) {
    const b = balanceOf(s, src.id, date);
    if (!b) continue;
    total += toDisplay(s, b.balance, src.currency);
    if (!asOf || b.date < asOf) asOf = b.date;
  }
  return { total, asOf };
}

const dayNum = (date: string) => { const [y, m, d] = date.split("-").map(Number); return Date.UTC(y, m - 1, d) / 86_400_000; };

/** A source's value on a date: straight between its recorded balances, flat after the last, 0 before the first. */
function valueOn(snaps: Snapshot[], date: string): number {
  if (!snaps.length || date < snaps[0].date) return 0;
  for (let i = snaps.length - 1; i >= 0; i--) {
    if (snaps[i].date > date) continue;
    const a = snaps[i], b = snaps[i + 1];
    if (!b) return a.balance;
    const f = (dayNum(date) - dayNum(a.date)) / Math.max(1, dayNum(b.date) - dayNum(a.date));
    return a.balance + (b.balance - a.balance) * f;
  }
  return 0;
}

/** Months from the first balance to this month, with each source's value at each month's end (drawn straight
    between recorded balances), in the display currency. `recorded[i]`: some source has a balance dated in month i. */
export function netWorthSeries(s: AppState, maxMonths = 120): { months: string[]; recorded: boolean[]; bySource: { source: Source; values: number[] }[] } {
  const sources = liveSources(s);
  const dates = liveSnapshots(s).map((x) => x.date).sort();
  if (!dates.length) return { months: [], recorded: [], bySource: [] };
  const end = thisMonth();
  let start = monthOf(dates[0]);
  if (monthDiff(start, end) > maxMonths) start = addMonths(end, -maxMonths);
  const n = monthDiff(start, end) + 1;
  const months = Array.from({ length: n }, (_, i) => addMonths(start, i));
  const recorded = months.map((ym) => dates.some((d) => d.startsWith(ym)));
  const bySource = sources.map((source) => {
    const snaps = snapshotsOf(s, source.id);
    const values = months.map((ym) => toDisplay(s, valueOn(snaps, ym === end ? todayStr() : monthEnd(ym)), source.currency));
    return { source, values };
  }).filter((x) => x.values.some((v) => v > 0));
  return { months, recorded, bySource };
}

export interface MonthSum { income: number; expense: number; invest: number; net: number; rate: number | null }

/** A month's totals in the display currency. net = income − expenses − invested; rate = (income − expenses) / income. */
export function monthSum(s: AppState, ym: string): MonthSum {
  const sum: Record<TxnKind, number> = { income: 0, expense: 0, invest: 0 };
  for (const t of liveTxns(s)) if (t.date.startsWith(ym)) sum[t.kind] += toDisplay(s, t.amount, t.currency);
  return { ...sum, net: sum.income - sum.expense - sum.invest, rate: sum.income > 0 ? (sum.income - sum.expense) / sum.income : null };
}

/** Spending per category in a month (display currency), largest first. */
export function byCategory(s: AppState, ym: string, kind: TxnKind = "expense"): { categoryId: string; total: number; count: number }[] {
  const m = new Map<string, { total: number; count: number }>();
  for (const t of liveTxns(s)) {
    if (t.kind !== kind || !t.date.startsWith(ym)) continue;
    const x = m.get(t.categoryId) ?? { total: 0, count: 0 };
    x.total += toDisplay(s, t.amount, t.currency);
    x.count++;
    m.set(t.categoryId, x);
  }
  return [...m.entries()].map(([categoryId, x]) => ({ categoryId, ...x })).sort((a, b) => b.total - a.total);
}
