/* Checks the projection math against hand calculations. Run: npm run check */
import { deflate, project } from "../src/lib/compound.ts";

let fails = 0;
function near(name: string, got: number, want: number, tol = 0.01) {
  const ok = Math.abs(got - want) <= tol * Math.max(1, Math.abs(want)) / 100;
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${got.toFixed(2)} (want ${want.toFixed(2)})`);
}
const base = { returnPct: 0, feeBalancePct: 0, feeDepositPct: 0, monthly: 0, raisePct: 0 };

// 1. No return, no fees: 100 a month for 12 months = 1,200.
near("flat contributions", project({ ...base, monthly: 100 }, 0, { months: 12, contributions: true, start: "2026-01" }).balance[12], 1200);

// 2. 6% a year, no contributions, 10 years: 10,000 × 1.06^10 = 17,908.48.
near("compound 10y", project({ ...base, returnPct: 6 }, 10_000, { months: 120, contributions: false }).balance[120], 10_000 * 1.06 ** 10);

// 3. Future value of an annuity: 500/month at 6%/yr (monthly rate (1.06)^(1/12)−1), 30 years, deposits at month end.
const r = 1.06 ** (1 / 12) - 1;
near("annuity 30y", project({ ...base, returnPct: 6, monthly: 500 }, 0, { months: 360, contributions: true }).balance[360], 500 * ((1 + r) ** 360 - 1) / r);

// 4. Balance fee 1%/yr on 0% return: 10,000 × (1 − 0.01/12)^12 = 9,900.46.
near("balance fee", project({ ...base, feeBalancePct: 1 }, 10_000, { months: 12, contributions: false }).balance[12], 10_000 * (1 - 0.01 / 12) ** 12);

// 5. Deposit fee 2%: 1,000 a month for 3 months = 2,940; contributed 3,000; fees 60.
const d = project({ ...base, feeDepositPct: 2, monthly: 1000 }, 0, { months: 3, contributions: true });
near("deposit fee balance", d.balance[3], 2940);
near("deposit fee contributed", d.contributed[3], 3000);
near("deposit fee fees", d.fees[3], 60);

// 6. Raise 10%/yr: months 1–12 at 100, 13–24 at 110 → 2,520.
near("raise", project({ ...base, monthly: 100, raisePct: 10 }, 0, { months: 24, contributions: true }).balance[24], 2520);

// 7. Contributions stop after the last month: start 2026-01, last month 2026-06 → months 1–5 (Feb–Jun) = 500.
near("last month", project({ ...base, monthly: 100, contribUntil: "2026-06" }, 0, { months: 12, contributions: true, start: "2026-01" }).balance[12], 500);

// 8. Today's money: 10,000 in 10 years at 2.5% inflation = 10,000 / 1.025^10.
near("deflate", deflate([10_000, ...new Array(119).fill(0), 10_000], 2.5)[120], 10_000 / 1.025 ** 10);

// 9. Low scenario: returnDelta −2 on 6% = 4%.
near("scenario", project({ ...base, returnPct: 6 }, 1000, { months: 12, contributions: false, returnDelta: -2 }).balance[12], 1040);

console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
