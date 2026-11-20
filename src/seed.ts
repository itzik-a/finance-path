/* Starting state: categories plus a few examples (sources, balances, transactions, recurring items),
   all with `updatedAt: 0`, so any edit, from any device, wins over them in a merge.
   **Never rename or reuse an id here**: devices match items by id. Examples can be removed in one go
   (removeExamples() in actions.ts); being soft deletes, the removal syncs to every device. */
import type { AppState, Category, Recurring, Settings, Snapshot, Source, Txn, TxnKind } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  display: "ILS",
  usdIls: 3.7,
  rateAuto: true,
  inflationPct: 2.5,
  spreadPct: 2,
  updatedAt: 0,
};

const cat = (id: string, kind: TxnKind, emoji: string, name: string): Category => ({ id, kind, emoji, name, updatedAt: 0 });

export const SEED_CATEGORIES: Category[] = [
  cat("c-salary", "income", "💼", "Salary"),
  cat("c-bonus", "income", "🎉", "Bonus"),
  cat("c-freelance", "income", "🧑‍💻", "Freelance"),
  cat("c-interest", "income", "📈", "Interest & dividends"),
  cat("c-gift-in", "income", "🎁", "Gifts received"),
  cat("c-income-other", "income", "➕", "Other income"),
  cat("c-housing", "expense", "🏠", "Housing"),
  cat("c-groceries", "expense", "🛒", "Groceries"),
  cat("c-eating", "expense", "🍽️", "Eating out"),
  cat("c-transport", "expense", "🚗", "Transport"),
  cat("c-bills", "expense", "💡", "Bills & utilities"),
  cat("c-health", "expense", "🩺", "Health"),
  cat("c-insurance", "expense", "🛡️", "Insurance"),
  cat("c-shopping", "expense", "🛍️", "Shopping"),
  cat("c-fun", "expense", "🎬", "Entertainment"),
  cat("c-subs", "expense", "🔁", "Subscriptions"),
  cat("c-travel", "expense", "✈️", "Travel"),
  cat("c-gifts", "expense", "💝", "Gifts & donations"),
  cat("c-education", "expense", "📚", "Education"),
  cat("c-expense-other", "expense", "📦", "Other"),
  cat("c-invest", "invest", "🌱", "Investing"),
  cat("c-savings", "invest", "🏦", "Savings"),
];

const src = (s: Omit<Source, "updatedAt" | "example">): Source => ({ ...s, example: true, updatedAt: 0 });

export const SEED_SOURCES: Source[] = [
  src({ id: "ex-pension", name: "Pension fund", kind: "pension", currency: "ILS", returnPct: 5.5, feeBalancePct: 0.22, feeDepositPct: 1.49, monthly: 3500, raisePct: 2, contribUntil: "2058-12", color: 0 }),
  src({ id: "ex-hishtalmut", name: "Keren hishtalmut", kind: "hishtalmut", currency: "ILS", returnPct: 6, feeBalancePct: 0.6, feeDepositPct: 0, monthly: 1571, raisePct: 0, color: 1 }),
  src({ id: "ex-sp500", name: "S&P 500 index fund", kind: "brokerage", currency: "USD", returnPct: 7, feeBalancePct: 0.1, feeDepositPct: 0, monthly: 500, raisePct: 3, color: 2 }),
  src({ id: "ex-deposit", name: "Savings deposit", kind: "savings", currency: "ILS", returnPct: 4, feeBalancePct: 0, feeDepositPct: 0, monthly: 0, raisePct: 0, color: 3 }),
];

const SNAP_DATES = ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30", "2026-10-31"];
const SNAP_VALUES: Record<string, number[]> = {
  "ex-pension": [368_400, 381_900, 393_200, 407_100, 412_300],
  "ex-hishtalmut": [126_200, 133_800, 139_100, 146_400, 148_900],
  "ex-sp500": [38_100, 40_200, 42_900, 45_400, 46_200],
  "ex-deposit": [50_000, 50_480, 50_960, 51_450, 51_600],
};

export const SEED_SNAPSHOTS: Snapshot[] = Object.entries(SNAP_VALUES).flatMap(([sourceId, values]) =>
  values.map((balance, i): Snapshot => ({ id: `ex-snap-${sourceId.slice(3)}-${i}`, sourceId, date: SNAP_DATES[i], balance, example: true, updatedAt: 0 })),
);

const rec = (r: Omit<Recurring, "updatedAt" | "example" | "start" | "end" | "every"> & Partial<Pick<Recurring, "every">>): Recurring => ({
  every: "month", start: "2026-09-01", end: "2026-12-31", ...r, example: true, updatedAt: 0,
});

export const SEED_RECURRING: Recurring[] = [
  rec({ id: "ex-r-salary", kind: "income", amount: 24_000, currency: "ILS", categoryId: "c-salary", note: "Salary", day: 10 }),
  rec({ id: "ex-r-rent", kind: "expense", amount: 6_500, currency: "ILS", categoryId: "c-housing", note: "Rent", day: 1 }),
  rec({ id: "ex-r-phone", kind: "expense", amount: 59, currency: "ILS", categoryId: "c-subs", note: "Phone plan", day: 5 }),
  rec({ id: "ex-r-stream", kind: "expense", amount: 15.49, currency: "USD", categoryId: "c-subs", note: "Streaming", day: 12 }),
  rec({ id: "ex-r-sp500", kind: "invest", amount: 500, currency: "USD", categoryId: "c-invest", sourceId: "ex-sp500", note: "Monthly buy", day: 15 }),
];

const tx = (id: string, date: string, kind: TxnKind, amount: number, categoryId: string, note: string): Txn => ({
  id: `ex-t-${id}`, kind, date, amount, currency: "ILS", categoryId, note, example: true, updatedAt: 0,
});

export const SEED_TXNS: Txn[] = [
  tx("1", "2026-10-03", "expense", 742, "c-groceries", "Supermarket"),
  tx("2", "2026-10-08", "expense", 186, "c-eating", "Dinner"),
  tx("3", "2026-10-14", "expense", 320, "c-transport", "Fuel"),
  tx("4", "2026-10-17", "expense", 611, "c-groceries", "Supermarket"),
  tx("5", "2026-10-21", "expense", 455, "c-bills", "Electricity"),
  tx("6", "2026-10-26", "expense", 240, "c-fun", "Concert"),
  tx("7", "2026-10-29", "expense", 380, "c-health", "Dentist"),
  tx("8", "2026-11-02", "expense", 688, "c-groceries", "Supermarket"),
  tx("9", "2026-11-06", "expense", 142, "c-eating", "Lunch"),
  tx("10", "2026-11-09", "expense", 295, "c-transport", "Fuel"),
  tx("11", "2026-11-13", "expense", 529, "c-shopping", "Shoes"),
  tx("12", "2026-11-16", "expense", 703, "c-groceries", "Supermarket"),
  tx("13", "2026-11-18", "income", 1_800, "c-freelance", "Side project"),
];

export function seedState(): AppState {
  return {
    v: 1,
    sources: structuredClone(SEED_SOURCES),
    snapshots: structuredClone(SEED_SNAPSHOTS),
    txns: structuredClone(SEED_TXNS),
    categories: structuredClone(SEED_CATEGORIES),
    recurring: structuredClone(SEED_RECURRING),
    settings: { ...DEFAULT_SETTINGS },
    updatedAt: 0,
  };
}
