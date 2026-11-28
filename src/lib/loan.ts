/* A loan's schedule: Shpitzer (שפיצר), a fixed monthly payment that pays the month's interest first and the rest
   off the balance, so early payments are mostly interest and late ones mostly principal.

     r        = yearly rate / 12 / 100                      (the rate in force that month)
     payment  = B × r / (1 − (1 + r)^−k)                     B = balance, k = payments left (r = 0: B / k)
     interest = B × r, principal = payment − interest, B ← B − principal

   The payment is worked out again, from the balance and the payments left, in the first month and whenever the
   rate changes (prime moved) or a balance from a statement replaces the computed one: what banks do. Amounts are
   rounded to the agora / cent each month; the last payment clears what's left. A prime loan's rate is
   prime + margin, prime taken from `settings.prime` (the latest change on or before the month; the first one
   also covers earlier months). Pure functions (`npm run check` tests them: scripts/check-loan.ts). */
import type { Loan, PrimeRate } from "../types.ts";
import { addMonths, monthEnd, monthOf } from "./dates.ts";

export interface LoanRow {
  /** 0 = the first payment */
  i: number;
  month: string;
  date: string;
  /** yearly rate in force, percent */
  ratePct: number;
  payment: number;
  interest: number;
  principal: number;
  /** what's left after this payment */
  balance: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Prime in a month ("YYYY-MM"): the latest change on or before it, else the first one; none known = undefined. */
export function primeAt(prime: PrimeRate[] | undefined, month: string): number | undefined {
  if (!prime?.length) return undefined;
  const xs = [...prime].sort((a, b) => (a.from < b.from ? -1 : 1));
  let pct = xs[0].pct;
  for (const p of xs) if (p.from <= month) pct = p.pct;
  return pct;
}

/** The latest known prime rate (what the forecast assumes from then on). */
export const latestPrime = (prime: PrimeRate[] | undefined) => (prime?.length ? [...prime].sort((a, b) => (a.from < b.from ? -1 : 1)).at(-1)!.pct : undefined);

/** The loan's yearly rate in a month, percent. */
export const rateAt = (loan: Pick<Loan, "rate" | "ratePct">, prime: PrimeRate[] | undefined, month: string) =>
  loan.rate === "fixed" ? loan.ratePct : (primeAt(prime, month) ?? 0) + loan.ratePct;

/** Payment i's date: the first payment's day of the month, or that month's last day. */
export function paymentDate(first: string, i: number): string {
  const ym = addMonths(monthOf(first), i);
  const date = `${ym}-${first.slice(8, 10)}`;
  const end = monthEnd(ym);
  return date > end ? end : date;
}

/** The fixed monthly payment that clears `balance` in `k` payments at a yearly rate. */
export function shpitzerPayment(balance: number, yearlyPct: number, k: number): number {
  const r = yearlyPct / 1200;
  if (k <= 0) return balance;
  return r === 0 ? balance / k : (balance * r) / (1 - (1 + r) ** -k);
}

/** Every payment, from the first to the last (fewer when a statement balance paid it off early). */
export function schedule(loan: Pick<Loan, "principal" | "first" | "months" | "rate" | "ratePct" | "balances">, prime?: PrimeRate[]): LoanRow[] {
  const rows: LoanRow[] = [];
  const statements = new Map((loan.balances ?? []).map((b) => [b.month, b.balance]));
  const n = Math.max(0, Math.round(loan.months));
  let balance = loan.principal;
  let payment = 0, lastRate = NaN, recalc = true;
  for (let i = 0; i < n && balance > 0.004; i++) {
    const month = addMonths(monthOf(loan.first), i);
    const ratePct = rateAt(loan, prime, month);
    if (ratePct !== lastRate) recalc = true;
    if (recalc) { payment = round2(shpitzerPayment(balance, ratePct, n - i)); lastRate = ratePct; recalc = false; }
    const interest = round2((balance * ratePct) / 1200);
    const principal = i === n - 1 ? balance : Math.min(balance, round2(payment - interest));
    balance = round2(balance - principal);
    const stated = statements.get(month);
    if (stated != null) { balance = Math.max(0, stated); recalc = true; }
    rows.push({ i, month, date: paymentDate(loan.first, i), ratePct, payment: round2(principal + interest), interest, principal: round2(principal), balance });
  }
  return rows;
}

/** What's owed on a date: nothing before the month ahead of the first payment (not borrowed yet), the principal until
    the first payment, then the balance after the latest payment made. */
export function balanceOn(loan: Pick<Loan, "principal" | "first">, rows: LoanRow[], date: string): number {
  if (date < `${addMonths(monthOf(loan.first), -1)}-01`) return 0;
  let b = loan.principal;
  for (const r of rows) { if (r.date > date) break; b = r.balance; }
  return b;
}

export interface LoanStatus {
  rows: LoanRow[];
  /** owed today */
  balance: number;
  /** the next payment after today, if any */
  next?: LoanRow;
  /** payments made up to today */
  made: number;
  interestPaid: number;
  interestLeft: number;
  /** the last payment */
  last?: LoanRow;
}

export function loanStatus(loan: Loan, prime: PrimeRate[] | undefined, today: string): LoanStatus {
  const rows = schedule(loan, prime);
  const past = rows.filter((r) => r.date <= today);
  return {
    rows,
    balance: balanceOn(loan, rows, today),
    next: rows.find((r) => r.date > today),
    made: past.length,
    interestPaid: round2(past.reduce((a, r) => a + r.interest, 0)),
    interestLeft: round2(rows.filter((r) => r.date > today).reduce((a, r) => a + r.interest, 0)),
    last: rows[rows.length - 1],
  };
}
