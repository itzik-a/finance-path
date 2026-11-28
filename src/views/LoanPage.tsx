/* Loans on the Investments screen: the list (LoanList) and one loan's page (#investments/loan/<id>): what's left,
   the payment, interest paid and still to pay, the balance falling, interest against principal by year, the prime
   rate's changes and balances from statements. */
import { useMemo, useState } from "react";
import { BarChart } from "../components/BarChart";
import { IconBack, IconEdit, IconNext, IconPlus } from "../components/Icons";
import { LoanBalanceSheet, LoanSheet, PrimeSheet } from "../components/LoanSheet";
import { TimeChart, monthTicks } from "../components/TimeChart";
import { monthDiff, monthLabel, monthTick, shortDate, thisMonth, todayStr } from "../lib/dates";
import { toDisplay } from "../lib/finance";
import { latestPrime, loanStatus, primeAt, type LoanStatus } from "../lib/loan";
import { fmt, pct } from "../lib/money";
import { deleteLoan, liveLoans } from "../state/actions";
import type { AppState } from "../state/store";
import type { Loan } from "../types";

const INTEREST_COLOR = "var(--s8)";
const PRINCIPAL_COLOR = "var(--s1)";
const BALANCE_COLOR = "var(--s2)";

const rateLabel = (s: AppState, l: Loan) => {
  if (l.rate === "fixed") return `Fixed ${pct(l.ratePct, 2)}`;
  const m = l.ratePct === 0 ? "" : ` ${l.ratePct > 0 ? "+" : "−"} ${pct(Math.abs(l.ratePct), 2)}`;
  return `Prime${m} · ${pct((primeAt(s.settings.prime, thisMonth()) ?? 0) + l.ratePct, 2)} now`;
};

/** The loans, under the investments; an empty one invites the first. */
export function LoanList({ s }: { s: AppState }) {
  const [adding, setAdding] = useState(false);
  const loans = liveLoans(s);
  const D = s.settings.display;
  const today = todayStr();
  const owed = loans.reduce((a, l) => a + toDisplay(s, loanStatus(l, s.settings.prime, today).balance, l.currency), 0);
  return (
    <section className="loans" aria-labelledby="loans-title">
      <div className="card-head">
        <h2 id="loans-title">Loans{loans.length > 0 && <span className="muted small"> · {fmt(owed, D)} owed</span>}</h2>
        <button type="button" className="btn ghost sm" onClick={() => setAdding(true)}><IconPlus /> Add loan</button>
      </div>
      {loans.length === 0 ? (
        <p className="muted small">A mortgage or another loan: its payments go into Cash flow by themselves, with the interest worked out each month, and what's left comes off your net worth.</p>
      ) : (
        <ul className="src-list">
          {loans.map((l) => {
            const st = loanStatus(l, s.settings.prime, today);
            return (
              <li key={l.id}>
                <a className="card src-card" href={`#investments/loan/${l.id}`}>
                  <span className="src-card-main">
                    <span className="src-card-name" dir="auto">{l.name}</span>
                    <span className="muted small">{rateLabel(s, l)}{st.next ? ` · ${fmt(st.next.payment, l.currency)} a month` : " · paid off"}</span>
                  </span>
                  <span className="src-card-amt">
                    <b>{fmt(st.balance, l.currency)}</b>
                    <span className="muted small">{st.last ? `to ${monthLabel(st.last.month, true)}` : ""}</span>
                  </span>
                  <IconNext className="chev" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {adding && <LoanSheet onClose={() => setAdding(false)} onSaved={(id) => { location.hash = `#investments/loan/${id}`; }} />}
    </section>
  );
}

export function LoanPage({ s, loan }: { s: AppState; loan: Loan }) {
  const [sheet, setSheet] = useState<"edit" | "prime" | { balance?: string } | null>(null);
  const today = todayStr();
  const st = useMemo(() => loanStatus(loan, s.settings.prime, today), [loan, s.settings.prime, today]);
  const C = loan.currency;
  const money = (v: number) => fmt(v, C, { cents: v % 1 !== 0 && Math.abs(v) < 1000 });
  const nowPrime = primeAt(s.settings.prime, thisMonth());
  const primeSince = [...(s.settings.prime ?? [])].filter((p) => p.from <= thisMonth()).pop()?.from;

  return (
    <>
      <a className="back" href="#investments"><IconBack /> Investments</a>
      <header className="src-head card">
        <div className="row-head">
          <div>
            <span className="eyebrow">Loan · {rateLabel(s, loan)}</span>
            <h1 className="display" dir="auto">{loan.name}</h1>
          </div>
          <button type="button" className="icon-btn" aria-label={`Edit ${loan.name}`} onClick={() => setSheet("edit")}><IconEdit /></button>
        </div>
        <div className="hero-row">
          <div>
            <span className="hero">{fmt(st.balance, C)}</span>
            <span className="muted small">left of {fmt(loan.principal, C)} · {st.made} of {st.rows.length} payments made</span>
          </div>
          <button type="button" className="btn ghost" onClick={() => setSheet({})}><IconPlus /> Balance from statement</button>
        </div>
        <dl className="facts">
          <div><dt>Next payment</dt><dd>{st.next ? `${money(st.next.payment)} · ${shortDate(st.next.date).slice(0, -5)}` : "Paid off"}</dd></div>
          {st.next && <div><dt>Of it interest</dt><dd>{money(st.next.interest)} ({Math.round((st.next.interest / st.next.payment) * 100)}%)</dd></div>}
          <div><dt>Interest paid</dt><dd>{fmt(st.interestPaid, C)}</dd></div>
          <div><dt>Interest to come</dt><dd>{fmt(st.interestLeft, C)}{loan.rate === "prime" ? " *" : ""}</dd></div>
          <div><dt>Last payment</dt><dd>{st.last ? monthLabel(st.last.month) : "—"}</dd></div>
        </dl>
        {loan.rate === "prime" && <p className="muted small">* If prime stays at {pct(latestPrime(s.settings.prime) ?? 0, 2)}{latestPrime(s.settings.prime) !== nowPrime ? ` (from ${monthLabel(s.settings.prime!.map((p) => p.from).sort().at(-1)!, true)})` : ""}.</p>}
        {loan.note && <p className="small note" dir="auto">{loan.note}</p>}
      </header>

      {loan.rate === "prime" && (
        <section className="card" aria-labelledby="prime-title">
          <div className="card-head">
            <h2 id="prime-title">Prime {pct(nowPrime ?? 0, 2)}</h2>
            <button type="button" className="btn ghost sm" onClick={() => setSheet("prime")}>Prime changed</button>
          </div>
          <p className="muted small">
            {primeSince ? `Since ${monthLabel(primeSince)}. ` : ""}This loan is at prime {loan.ratePct >= 0 ? "+" : "−"} {pct(Math.abs(loan.ratePct), 2)}. When prime changes, the payment is worked out again from that month, from what's left and the payments still to go.
          </p>
        </section>
      )}

      {st.rows.length > 1 && <BalanceChart loan={loan} st={st} />}
      {st.rows.length > 1 && <YearChart loan={loan} st={st} />}

      <section className="card" aria-labelledby="stmt-title">
        <div className="card-head"><h2 id="stmt-title">Balances from statements</h2></div>
        {!loan.balances?.length ? (
          <p className="muted small">The schedule is worked out from the loan's terms. Now and then, enter what the bank says is left: the payments from then on follow it.</p>
        ) : (
          <ul className="snap-list">
            {[...loan.balances].reverse().map((b) => (
              <li key={b.month}>
                <button type="button" className="snap-row" onClick={() => setSheet({ balance: b.month })}>
                  <span>After the {monthLabel(b.month)} payment</span>
                  <span className="snap-amt"><b>{fmt(b.balance, C)}</b></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" className="btn ghost danger" onClick={() => { deleteLoan(loan.id); location.hash = "#investments"; }}>Remove {loan.name} and its payments</button>

      {sheet === "edit" && <LoanSheet loan={loan} onClose={() => setSheet(null)} />}
      {sheet === "prime" && <PrimeSheet onClose={() => setSheet(null)} />}
      {sheet && typeof sheet === "object" && <LoanBalanceSheet loan={loan} month={sheet.balance} onClose={() => setSheet(null)} />}
    </>
  );
}

/** What's left after each payment, with a Today line and the balances from statements as dots. */
function BalanceChart({ loan, st }: { loan: Loan; st: LoanStatus }) {
  const C = loan.currency;
  const first = st.rows[0].month;
  const n = st.rows.length;
  const now = monthDiff(first, thisMonth());
  const stated = new Map((loan.balances ?? []).map((b) => [b.month, b.balance]));
  return (
    <section className="card" aria-labelledby="bal-title">
      <h2 id="bal-title">Balance</h2>
      <TimeChart
        n={n} title={`${loan.name}: what's left after each payment`}
        xLabel={(i) => `${monthLabel(st.rows[i].month)} · payment ${i + 1}: ${fmt(st.rows[i].payment, C)}, ${fmt(st.rows[i].interest, C)} interest`}
        xTick={(i) => (n > 25 ? st.rows[i].month.slice(0, 4) : monthTick(st.rows[i].month))} xTicks={monthTicks(first, n)}
        series={[{ id: "bal", label: "Left", color: BALANCE_COLOR, values: st.rows.map((r) => r.balance) }]}
        points={stated.size ? { label: "From a statement", values: st.rows.map((r) => stated.get(r.month) ?? null) } : undefined}
        today={now >= 0 && now < n ? now : undefined}
        format={(v) => fmt(v, C)} tick={(v) => fmt(v, C, { compact: true })} height={200} legend={false} dots={false}
      />
    </section>
  );
}

/** Interest against principal, year by year: early years mostly interest, late ones mostly principal. */
function YearChart({ loan, st }: { loan: Loan; st: LoanStatus }) {
  const C = loan.currency;
  const years = new Map<string, { interest: number; principal: number; payment: number; balance: number }>();
  for (const r of st.rows) {
    const y = r.month.slice(0, 4);
    const x = years.get(y) ?? { interest: 0, principal: 0, payment: 0, balance: 0 };
    x.interest += r.interest; x.principal += r.principal; x.payment += r.payment; x.balance = r.balance;
    years.set(y, x);
  }
  const ys = [...years.keys()];
  const thisYear = todayStr().slice(0, 4);
  return (
    <>
      <section className="card" aria-labelledby="yr-title">
        <h2 id="yr-title">Interest and principal by year</h2>
        <BarChart
          title="Interest and principal paid each year"
          labels={ys.map((y) => (ys.length > 12 ? `'${y.slice(2)}` : y))} tipLabels={ys}
          series={[
            { id: "interest", label: "Interest", color: INTEREST_COLOR, values: ys.map((y) => years.get(y)!.interest) },
            { id: "principal", label: "Principal", color: PRINCIPAL_COLOR, values: ys.map((y) => years.get(y)!.principal) },
          ]}
          format={(v) => fmt(v, C)} tick={(v) => fmt(v, C, { compact: true })}
          current={ys.indexOf(thisYear)}
        />
      </section>
      <details className="card year-table">
        <summary><h2>Year by year</h2><span className="muted small">{ys.length} {ys.length === 1 ? "row" : "rows"}</span></summary>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Year</th><th>Paid</th><th>Interest</th><th>Principal</th><th>Left</th></tr></thead>
            <tbody>
              {ys.map((y) => {
                const x = years.get(y)!;
                return <tr key={y}><th>{y}</th><td>{fmt(x.payment, C)}</td><td>{fmt(x.interest, C)}</td><td>{fmt(x.principal, C)}</td><td>{fmt(x.balance, C)}</td></tr>;
              })}
            </tbody>
            <tfoot><tr><th>In all</th><td>{fmt(st.rows.reduce((a, r) => a + r.payment, 0), C)}</td><td>{fmt(st.rows.reduce((a, r) => a + r.interest, 0), C)}</td><td>{fmt(st.rows.reduce((a, r) => a + r.principal, 0), C)}</td><td /></tr></tfoot>
          </table>
        </div>
      </details>
    </>
  );
}

