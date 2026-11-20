/* The projection: month by month, per source, in the source's own currency.

     balance ← balance × (1 + r)            r = (1 + yearly return)^(1/12) − 1
     balance ← balance − balance × fee / 12 yearly fee on the balance, taken monthly
     balance ← balance + c × (1 − deposit fee)
     c = monthly × (1 + raise)^(whole years since the start), until the source's last month

   Index 0 is now (the latest balance); index m is m months ahead. Pure functions (`npm run check` tests them against hand calculations: scripts/check-compound.ts). */
import type { Source } from "../types.ts";
import { addMonths, thisMonth } from "./dates.ts";

export interface Projection {
  /** balance at each month, index 0 = now */
  balance: number[];
  /** money put in so far (before deposit fees) */
  contributed: number[];
  /** fees paid so far (balance + deposit fees) */
  fees: number[];
}

export interface ProjectOpts {
  months: number;
  contributions: boolean;
  /** added to the expected return, in percentage points (scenarios) */
  returnDelta?: number;
  /** the month index 0 stands for, "YYYY-MM" (default this month) */
  start?: string;
}

export function project(src: Pick<Source, "returnPct" | "feeBalancePct" | "feeDepositPct" | "monthly" | "raisePct" | "contribUntil">, startBalance: number, o: ProjectOpts): Projection {
  const start = o.start ?? thisMonth();
  const R = Math.max(-99, src.returnPct + (o.returnDelta ?? 0)) / 100;
  const r = Math.pow(1 + R, 1 / 12) - 1;
  const feeM = Math.max(0, src.feeBalancePct) / 100 / 12;
  const feeD = Math.min(100, Math.max(0, src.feeDepositPct)) / 100;
  let b = startBalance, put = 0, fees = 0;
  const out: Projection = { balance: [b], contributed: [0], fees: [0] };
  for (let m = 1; m <= o.months; m++) {
    b *= 1 + r;
    const fee = b * feeM;
    b -= fee;
    fees += fee;
    if (o.contributions && src.monthly > 0 && (!src.contribUntil || addMonths(start, m) <= src.contribUntil)) {
      const c = src.monthly * Math.pow(1 + src.raisePct / 100, Math.floor((m - 1) / 12));
      b += c * (1 - feeD);
      put += c;
      fees += c * feeD;
    }
    out.balance.push(b);
    out.contributed.push(put);
    out.fees.push(fees);
  }
  return out;
}

/** Divide by inflation since now: "today's money". */
export const deflate = (xs: number[], inflationPct: number) => xs.map((v, m) => v / Math.pow(1 + inflationPct / 100, m / 12));

