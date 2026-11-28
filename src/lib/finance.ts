/* Reading the state: balances, net worth, month sums. Pure functions of AppState. */
import { dueIn, liveLoans, liveRecurring, liveSnapshots, liveSources, liveTxns, nextDue } from "../state/actions";
import type { AppState, Currency, Loan, Recurring, Snapshot, Source, SourceKind, Txn, TxnKind } from "../types";
import { addMonths, monthDiff, monthEnd, monthOf, thisMonth, todayStr } from "./dates";
import { balanceOn, loanStatus, schedule, type LoanRow } from "./loan";
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

/** Net worth on a date (default today), in the display currency: what's invested (`assets`, the latest balances) less
    what's owed on loans (`debts`, from their schedules); `asOf` is the oldest "as of" among the sources. */
export function netWorth(s: AppState, date?: string): { total: number; assets: number; debts: number; asOf?: string } {
  let assets = 0;
  let asOf: string | undefined;
  for (const src of liveSources(s)) {
    const b = balanceOf(s, src.id, date);
    if (!b) continue;
    assets += toDisplay(s, b.balance, src.currency);
    if (!asOf || b.date < asOf) asOf = b.date;
  }
  const debts = debtsOn(s, date ?? todayStr());
  return { total: assets - debts, assets, debts, asOf };
}

/** What's owed on every loan on a date, in the display currency. */
export function debtsOn(s: AppState, date: string, rows = loanRows(s)): number {
  return liveLoans(s).reduce((a, l) => a + toDisplay(s, balanceOn(l, rows.get(l.id)!, date), l.currency), 0);
}

/** Each live loan's schedule, by loan id. */
export const loanRows = (s: AppState) => new Map<string, LoanRow[]>(liveLoans(s).map((l) => [l.id, schedule(l, s.settings.prime)]));

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
export function netWorthSeries(s: AppState, maxMonths = 120): { months: string[]; recorded: boolean[]; bySource: { source: Source; values: number[] }[]; debts: number[] | null } {
  const sources = liveSources(s);
  const dates = liveSnapshots(s).map((x) => x.date).sort();
  if (!dates.length) return { months: [], recorded: [], bySource: [], debts: null };
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
  // what was owed on loans at each month's end (null when there are no loans)
  const rows = loanRows(s);
  const debts = rows.size ? months.map((ym) => debtsOn(s, ym === end ? todayStr() : monthEnd(ym), rows)) : null;
  return { months, recorded, bySource, debts };
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

export type UpcomingRow =
  /** a purchase in payments: its next payment, how many are left and their sum (the purchase's currency), the last one's date */
  | { kind: "plan"; date: string; next: Txn; left: number; leftAmount: number; last: string }
  /** a recurring expense: its next date */
  | { kind: "recurring"; date: string; r: Recurring }
  /** a loan: its next payment and what's owed today (the loan's currency) */
  | { kind: "loan"; date: string; loan: Loan; next: LoanRow; balance: number };

/** What's still to pay: purchases in payments with payments after today, and recurring expenses with a next date,
    the soonest first. In the display currency: `owed`, what's left on the purchases; `restOfMonth`, what falls due
    after today this month; `nextMonth`, what falls due next month. */
export function upcoming(s: AppState, today = todayStr()) {
  const ym = monthOf(today), next = addMonths(ym, 1);
  const rows: UpcomingRow[] = [];
  let owed = 0, restOfMonth = 0, nextMonth = 0;
  const byPlan = new Map<string, Txn[]>();
  for (const t of liveTxns(s)) {
    if (!t.plan || t.date <= today) continue;
    byPlan.set(t.plan.id, [...(byPlan.get(t.plan.id) ?? []), t]);
  }
  for (const xs of byPlan.values()) {
    xs.sort((a, b) => (a.date < b.date ? -1 : 1));
    const leftAmount = xs.reduce((a, t) => a + t.amount, 0);
    rows.push({ kind: "plan", date: xs[0].date, next: xs[0], left: xs.length, leftAmount, last: xs[xs.length - 1].date });
    owed += toDisplay(s, leftAmount, xs[0].currency);
    for (const t of xs) {
      if (t.date.startsWith(ym)) restOfMonth += toDisplay(s, t.amount, t.currency);
      else if (t.date.startsWith(next)) nextMonth += toDisplay(s, t.amount, t.currency);
    }
  }
  for (const r of liveRecurring(s)) {
    if (r.kind !== "expense") continue;
    const date = nextDue(r, today);
    if (!date) continue;
    rows.push({ kind: "recurring", date, r });
    const amount = toDisplay(s, r.amount, r.currency);
    restOfMonth += dueIn(r, ym, today).length * amount;
    nextMonth += dueIn(r, next).length * amount;
  }
  let owedLoans = 0, loans = 0;
  for (const l of liveLoans(s)) {
    const st = loanStatus(l, s.settings.prime, today);
    if (!st.next) continue;
    loans++;
    rows.push({ kind: "loan", date: st.next.date, loan: l, next: st.next, balance: st.balance });
    owedLoans += toDisplay(s, st.balance, l.currency);
    for (const r of st.rows) {
      if (r.date <= today) continue;
      if (r.month === ym) restOfMonth += toDisplay(s, r.payment, l.currency);
      else if (r.month === next) nextMonth += toDisplay(s, r.payment, l.currency);
    }
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { rows, owed, purchases: byPlan.size, owedLoans, loans, restOfMonth, nextMonth };
}
