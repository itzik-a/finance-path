/* Checks the loan schedule against hand calculations (closed-form Shpitzer formulas). Run: npm run check */
import { balanceOn, paymentDate, primeAt, schedule } from "../src/lib/loan.ts";

let fails = 0;
function near(name: string, got: number, want: number, tol = 0.02) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${got.toFixed(2)} (want ${want.toFixed(2)})`);
}
function same(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${JSON.stringify(got)} (want ${JSON.stringify(want)})`);
}
const pmt = (B: number, yearly: number, k: number) => { const r = yearly / 1200; return (B * r) / (1 - (1 + r) ** -k); };
const pv = (P: number, yearly: number, k: number) => { const r = yearly / 1200; return (P * (1 - (1 + r) ** -k)) / r; };
const fixed = (principal: number, ratePct: number, months: number) => ({ principal, ratePct, months, rate: "fixed" as const, first: "2026-01-10" });

// 1. 100,000 at 6% over 12 months: payment 8,606.64; interest 3,279.68 in all; nothing left.
const a = schedule(fixed(100_000, 6, 12));
near("12m payment", a[0].payment, 8606.64);
near("12m first interest", a[0].interest, 500);
near("12m total interest", a.reduce((s, r) => s + r.interest, 0), 8606.64 * 12 - 100_000, 0.1);
near("12m principal repaid", a.reduce((s, r) => s + r.principal, 0), 100_000);
near("12m left", a[11].balance, 0);
same("12m count", a.length, 12);

// 2. No interest: 1,200 over 12 months = 100 a month.
near("0% payment", schedule(fixed(1200, 0, 12))[5].payment, 100);

// 3. Mortgage 300,000 at 5% over 30 years: payment 1,610.46; first month 1,250 interest, 360.46 principal.
const m = schedule(fixed(300_000, 5, 360));
near("30y payment", m[0].payment, 1610.46);
near("30y first principal", m[0].principal, 360.46);
// After k payments of the rounded payment P: B(1+r)^k − P((1+r)^k − 1)/r; the rest is each month's interest rounded to the agora.
const g = (1 + 5 / 1200) ** 120;
near("30y balance after 10 years", m[119].balance, 300_000 * g - (1610.46 * (g - 1)) / (5 / 1200), 1);
near("30y left", m[359].balance, 0);
console.log(`     30y: interest falls from ${m[0].interest} to ${m[359].interest}`);

// 4. Prime: 100,000 over 24 months at prime + 1; prime 4% then 6% from the 13th payment → 5%, then 7%.
const prime = [{ from: "2020-01", pct: 4 }, { from: "2027-01", pct: 6 }];
const p = schedule({ principal: 100_000, ratePct: 1, months: 24, rate: "prime", first: "2026-01-10" }, prime);
const p1 = pmt(100_000, 5, 24);
const b12 = pv(p1, 5, 12);
near("prime first payment", p[0].payment, p1);
near("prime balance after 12", p[11].balance, b12, 0.1);
near("prime payment after the change", p[12].payment, pmt(b12, 7, 12), 0.05);
same("prime rate in force", [p[11].ratePct, p[12].ratePct], [5, 7]);
near("prime left", p[23].balance, 0);

// 5. A statement balance: 50,000 after the 6th payment of 100,000 / 24 at 6% → payments from there clear it in 18.
const st = schedule({ ...fixed(100_000, 6, 24), balances: [{ month: "2026-06", balance: 50_000 }] });
near("statement balance kept", st[5].balance, 50_000);
near("payment after statement", st[6].payment, pmt(50_000, 6, 18));
near("statement loan left", st[23].balance, 0);
same("paid off by statement", schedule({ ...fixed(100_000, 6, 24), balances: [{ month: "2026-03", balance: 0 }] }).length, 3);

// 6. Prime before its first known change takes the first one; dates on the 31st fall on the month's last day.
same("prime before history", primeAt(prime, "2010-05"), 4);
same("prime at a change", primeAt(prime, "2027-01"), 6);
same("31st in February", paymentDate("2026-01-31", 1), "2026-02-28");

// 7. Owed: nothing before it's borrowed (the month before the first payment), the principal until the first payment.
const L = fixed(100_000, 6, 12);
same("before borrowing", balanceOn(L, a, "2025-11-30"), 0);
same("borrowed, before first payment", balanceOn(L, a, "2026-01-09"), 100_000);
near("after 2 payments", balanceOn(L, a, "2026-02-15"), a[1].balance);

console.log(fails ? `\n${fails} failed` : "\nall ok");
if (fails) process.exit(1);
