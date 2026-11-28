/* The app's saved state (localStorage `financePath.v1`, and encrypted in the gist file finance-path.json).
   Every list item has `updatedAt` (sync merges per item by it) and an optional `deletedAt` (soft delete).
   Money amounts are plain numbers in the item's own currency. Dates are local "YYYY-MM-DD", months "YYYY-MM".
   New fields must be optional in normalize() (src/state/store.ts) so older saved copies still load. */

export type Currency = "ILS" | "USD";

export type SourceKind = "pension" | "hishtalmut" | "gemel" | "brokerage" | "savings" | "crypto" | "cash" | "realestate" | "other";

/** One place money is invested. Its balance comes from snapshots; the rest drives the projection. */
export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  currency: Currency;
  /** expected yearly return before fees, in percent (6 = 6%) */
  returnPct: number;
  /** yearly management fee on the balance, percent (דמי ניהול מצבירה) */
  feeBalancePct: number;
  /** fee taken from each deposit, percent (דמי ניהול מהפקדה) */
  feeDepositPct: number;
  /** monthly contribution, in the source's currency */
  monthly: number;
  /** yearly raise of the monthly contribution, percent */
  raisePct: number;
  /** last month with a contribution ("YYYY-MM"), e.g. retirement; none = for the whole period */
  contribUntil?: string;
  /** categorical colour slot 0–7, fixed when the source is made (colour follows the source) */
  color: number;
  note?: string;
  /** part of the starter examples (shown with an "Example" tag, removable in one go) */
  example?: boolean;
  updatedAt: number;
  deletedAt?: number;
}

/** A source's actual balance on a date, copied from a statement. */
export interface Snapshot {
  id: string;
  sourceId: string;
  date: string;
  balance: number;
  example?: boolean;
  updatedAt: number;
  deletedAt?: number;
}

/** income, an expense, or money moved into an investment (counted as saved, not spent) */
export type TxnKind = "income" | "expense" | "invest";

export interface Txn {
  id: string;
  kind: TxnKind;
  date: string;
  /** always positive; `kind` gives the direction */
  amount: number;
  currency: Currency;
  categoryId: string;
  /** for kind "invest": where the money went */
  sourceId?: string;
  note?: string;
  /** made by this recurring item (id = `r_<recurring id>_<YYYY-MM or YYYY>`) */
  recurringId?: string;
  /** a loan's monthly payment (id = `l_<loan id>_<YYYY-MM>`), made from the loan's schedule; `interest` is its interest part */
  loanId?: string;
  interest?: number;
  /** one monthly payment of a purchase split into payments (id = `p_<plan id>_<part>`); `total` is the full price */
  plan?: { id: string; part: number; parts: number; total: number };
  example?: boolean;
  updatedAt: number;
  deletedAt?: number;
}

export interface Category {
  id: string;
  name: string;
  /** "invest" categories are for money moved into investments */
  kind: TxnKind;
  emoji: string;
  updatedAt: number;
  deletedAt?: number;
}

/** A transaction that repeats. Due ones are added when the app opens, each with a fixed id, so devices agree. */
export interface Recurring {
  id: string;
  kind: TxnKind;
  amount: number;
  currency: Currency;
  categoryId: string;
  sourceId?: string;
  note?: string;
  every: "month" | "year";
  /** day of the month, 1–28 */
  day: number;
  /** for yearly items, 1–12 */
  month?: number;
  /** first date it can be due on */
  start: string;
  /** stop after this date */
  end?: string;
  example?: boolean;
  updatedAt: number;
  deletedAt?: number;
}

/** The prime rate from a month on ("YYYY-MM"); the first one also covers the months before it. */
export interface PrimeRate {
  from: string;
  pct: number;
}

/** Money borrowed and paid back in monthly Shpitzer payments (fixed payment, recalculated when the rate changes).
    Its schedule (src/lib/loan.ts) gives each month's payment, interest and balance; due payments become expenses. */
export interface Loan {
  id: string;
  name: string;
  currency: Currency;
  /** the amount borrowed */
  principal: number;
  /** the first payment's date; the others fall on its day of the month (or the month's last day) */
  first: string;
  /** number of monthly payments */
  months: number;
  /** fixed rate, or prime + margin (the prime rate's history is `settings.prime`) */
  rate: "fixed" | "prime";
  /** fixed: the yearly rate in percent; prime: the margin over prime (may be below zero) */
  ratePct: number;
  /** the expense category its payments get */
  categoryId: string;
  /** first month ("YYYY-MM") whose payment is added to Cash flow; earlier ones are only in the schedule */
  addFrom: string;
  /** balances from statements: what was left after that month's payment; the schedule continues from them */
  balances?: { month: string; balance: number }[];
  note?: string;
  updatedAt: number;
  deletedAt?: number;
}

export interface Settings {
  /** currency totals are shown in */
  display: Currency;
  /** ₪ per $1 */
  usdIls: number;
  /** keep usdIls fresh from the daily ECB rate */
  rateAuto: boolean;
  /** when usdIls was last fetched */
  rateAt?: number;
  /** yearly inflation for "today's money", percent */
  inflationPct: number;
  /** low / high scenarios: expected return − / + this many percentage points */
  spreadPct: number;
  /** the prime rate's history, for prime-linked loans, oldest first */
  prime?: PrimeRate[];
  updatedAt: number;
}

export interface AppState {
  v: 1;
  sources: Source[];
  snapshots: Snapshot[];
  txns: Txn[];
  categories: Category[];
  recurring: Recurring[];
  loans: Loan[];
  settings: Settings;
  updatedAt: number;
}
