/* Overview (#overview): net worth now and over time, this month's money, what's coming up to pay (purchases in payments, recurring expenses), and where it's heading. */
import { useMemo, useState } from "react";
import { ExamplesNote } from "../components/ExamplesNote";
import { IconNext, IconPlus, IconRepeat } from "../components/Icons";
import { TimeChart, monthTicks } from "../components/TimeChart";
import { TxnSheet } from "../components/TxnSheet";
import type { Recurring, Txn } from "../types";
import { addMonths, monthLabel, monthOf, monthTick, shortDate, thisMonth, todayStr } from "../lib/dates";
import { byCategory, monthSum, netWorth, netWorthSeries, sourceColor, upcoming } from "../lib/finance";
import { fmt } from "../lib/money";
import { runAll, sum } from "../lib/projection";
import { liveLoans, liveSources, liveTxns } from "../state/actions";
import { useAppState, type AppState } from "../state/store";
import { FLOW_COLOR } from "./CashFlow";
import { WITHOUT_COLOR, WITH_COLOR } from "./Projection";

export function Overview() {
  const s = useAppState();
  const sources = liveSources(s);
  const hasTxns = liveTxns(s).length > 0;
  const hasLoans = liveLoans(s).length > 0;

  if (!sources.length && !hasTxns && !hasLoans) {
    return (
      <>
        <header className="page-head"><h1 className="display">Overview</h1></header>
        <section className="card empty">
          <h2>Welcome</h2>
          <p className="muted">Start with where your money is invested (pension, keren hishtalmut, stocks, savings), then add what comes in and goes out each month.</p>
          <div className="btn-row">
            <a className="btn primary" href="#investments"><IconPlus /> Add an investment</a>
            <a className="btn ghost" href="#cashflow">Add income or an expense</a>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="page-head"><h1 className="display">Overview</h1></header>
      <ExamplesNote />
      {(sources.length > 0 || hasLoans) && <NetWorth s={s} />}
      <ThisMonth s={s} />
      <Upcoming s={s} />
      {sources.length > 0 && <Heading s={s} />}
    </>
  );
}

function NetWorth({ s }: { s: AppState }) {
  const D = s.settings.display;
  const nw = netWorth(s);
  const series = useMemo(() => netWorthSeries(s), [s]);
  const yearAgo = netWorth(s, `${Number(todayStr().slice(0, 4)) - 1}${todayStr().slice(4)}`);
  const delta = yearAgo.total > 0 ? nw.total - yearAgo.total : null;
  const { months, recorded, bySource, debts } = series;
  const n = months.length;

  return (
    <section className="card" aria-labelledby="nw-title">
      <div className="card-head">
        <h2 id="nw-title">Net worth</h2>
        <a className="link" href="#investments">Investments <IconNext width={16} height={16} /></a>
      </div>
      <div className="hero-stack">
        <span className="hero">{fmt(nw.total, D)}</span>
        <span className="muted small">
          {delta != null && <><b className={delta >= 0 ? "pos" : "neg"}>{fmt(delta, D, { sign: true })} ({delta >= 0 ? "+" : "−"}{Math.abs(Math.round((delta / yearAgo.total) * 100))}%)</b> in a year · </>}
          {nw.asOf ? `latest balances as of ${shortDate(nw.asOf)}` : "no balances yet"}
        </span>
        {nw.debts > 0 && <span className="muted small">{fmt(nw.assets, D)} invested, less {fmt(nw.debts, D)} owed on loans</span>}
      </div>
      {n > 1 && (
        <TimeChart
          n={n} title="Net worth by month, stacked by investment" stacked
          xLabel={(i) => `${monthLabel(months[i])}${recorded[i] ? "" : " · between balances"}`}
          xTick={(i) => (n > 25 ? months[i].slice(0, 4) : monthTick(months[i]))}
          xTicks={monthTicks(months[0], n)}
          series={bySource.map((b) => ({ id: b.source.id, label: b.source.name, color: sourceColor(b.source), values: b.values }))}
          overlay={debts ? { id: "net", label: "Net of loans", color: "var(--ink)", dashed: true, values: bySource.length ? months.map((_, i) => bySource.reduce((a, b) => a + b.values[i], 0) - debts[i]) : debts.map((d) => -d) } : undefined}
          format={(v) => fmt(v, D)} tick={(v) => fmt(v, D, { compact: true })} height={220}
        />
      )}
    </section>
  );
}

function ThisMonth({ s }: { s: AppState }) {
  const D = s.settings.display;
  const ym = thisMonth();
  const m = monthSum(s, ym);
  const prev = monthSum(s, addMonths(ym, -1));
  const cats = byCategory(s, ym).slice(0, 4);
  const max = cats[0]?.total ?? 0;
  const day = Number(todayStr().slice(8, 10));

  return (
    <section className="card" aria-labelledby="tm-title">
      <div className="card-head">
        <h2 id="tm-title">{monthLabel(ym)}</h2>
        <a className="link" href="#cashflow" onClick={() => sessionStorage.setItem("financePath.month", JSON.stringify(ym))}>Cash flow <IconNext width={16} height={16} /></a>
      </div>
      <dl className="sum-grid">
        <div><dt><i className="key-rect" style={{ background: FLOW_COLOR.income }} />Income</dt><dd>{fmt(m.income, D)}</dd></div>
        <div><dt><i className="key-rect" style={{ background: FLOW_COLOR.expense }} />Expenses</dt><dd>{fmt(m.expense, D)}</dd></div>
        <div><dt><i className="key-rect" style={{ background: FLOW_COLOR.invest }} />Invested</dt><dd>{fmt(m.invest, D)}</dd></div>
        <div><dt>Left over</dt><dd className={m.net >= 0 ? "pos" : "neg"}>{fmt(m.net, D, { sign: true })}</dd></div>
      </dl>
      <p className="muted small">
        {m.rate != null ? <>Saved <b className={m.rate >= 0 ? "pos" : "neg"}>{Math.round(m.rate * 100)}%</b> of income so far. </> : "No income recorded yet this month. "}
        {prev.expense > 0 && <>Spent {fmt(m.expense, D)} in {day} {day === 1 ? "day" : "days"}, against {fmt(prev.expense, D)} in all of {monthLabel(addMonths(ym, -1)).split(" ")[0]}.</>}
      </p>
      {cats.length > 0 && (
        <ul className="cat-bars">
          {cats.map((r) => {
            const c = s.categories.find((x) => x.id === r.categoryId);
            return (
              <li key={r.categoryId}>
                <div className="cat-bar-head">
                  <span><span aria-hidden="true">{c?.emoji ?? "•"}</span> {c?.name ?? "No category"}</span>
                  <b>{fmt(r.total, D)}</b>
                </div>
                <div className="cat-bar-track"><div className="cat-bar" style={{ width: `${Math.max(1.5, (r.total / max) * 100)}%`, background: FLOW_COLOR.expense }} /></div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** What's coming up to pay, by date: purchases in payments, recurring expenses and loans; a row opens it. */
function Upcoming({ s }: { s: AppState }) {
  const D = s.settings.display;
  const { rows, owed, purchases, owedLoans, loans, restOfMonth, nextMonth } = useMemo(() => upcoming(s), [s]);
  const [open, setOpen] = useState<{ txn?: Txn; recurring?: Recurring } | null>(null);
  if (!rows.length) return null;
  const ym = thisMonth();
  const name = (m: string) => monthLabel(m).split(" ")[0];
  const money = (v: number, c: Txn["currency"]) => fmt(v, c, { cents: v % 1 !== 0 });
  const owing = [
    purchases > 0 && <><b>{fmt(owed, D)}</b> on {purchases === 1 ? "1 purchase" : `${purchases} purchases`} in payments</>,
    loans > 0 && <><b>{fmt(owedLoans, D)}</b> on {loans === 1 ? "1 loan" : `${loans} loans`}</>,
  ].filter(Boolean);
  return (
    <section className="card" aria-labelledby="up-title">
      <div className="card-head">
        <h2 id="up-title">Upcoming payments</h2>
        <b title={`Due in ${monthLabel(addMonths(ym, 1))}`}>{fmt(nextMonth, D)} in {monthLabel(addMonths(ym, 1), true).split(" ")[0]}</b>
      </div>
      {(restOfMonth > 0 || owing.length > 0) && (
        <p className="muted small">
          {restOfMonth > 0 && <><b>{fmt(restOfMonth, D)}</b> more due in {name(ym)}. </>}
          {owing.length > 0 && <>Still owed: {owing[0]}{owing[1] && <>; {owing[1]}</>}.</>}
        </p>
      )}
      <ul className="txn-list">
        {rows.map((row) => {
          const cat = row.kind === "plan" ? row.next.categoryId : row.kind === "recurring" ? row.r.categoryId : row.loan.categoryId;
          const c = s.categories.find((x) => x.id === cat);
          const key = row.kind === "plan" ? `p${row.next.plan!.id}` : row.kind === "recurring" ? `r${row.r.id}` : `l${row.loan.id}`;
          const title = row.kind === "plan" ? row.next.note : row.kind === "recurring" ? row.r.note : row.loan.name;
          const C = row.kind === "plan" ? row.next.currency : row.kind === "recurring" ? row.r.currency : row.loan.currency;
          const amount = row.kind === "plan" ? row.next.amount : row.kind === "recurring" ? row.r.amount : row.next.payment;
          const what = row.kind === "plan" ? (row.left > 1 ? `${row.next.plan!.part} of ${row.next.plan!.parts}` : "the last payment")
            : row.kind === "recurring" ? (row.r.every === "month" ? "monthly" : "yearly")
            : `${row.next.i + 1} of ${row.loan.months}`;
          const onOpen = () => {
            if (row.kind === "loan") location.hash = `#investments/loan/${row.loan.id}`;
            else setOpen(row.kind === "plan" ? { txn: row.next } : { recurring: row.r });
          };
          return (
            <li key={key}>
              <button type="button" className="txn-row" onClick={onOpen}>
                <span className="txn-emoji" aria-hidden="true">{c?.emoji ?? "•"}</span>
                <span className="txn-main">
                  <span className="txn-title" dir="auto">{title || c?.name || "Payment"}</span>
                  <span className="muted small">
                    <span className="inline-icon">
                      {row.kind === "recurring" && <IconRepeat aria-label="Recurring" width={14} height={14} />}
                      Next {dayMonth(row.date)} · {what}
                    </span>
                  </span>
                </span>
                <span className="txn-amt stacked">
                  {money(amount, C)}
                  {row.kind === "plan" && row.left > 1 && <span className="muted small">{money(row.leftAmount, C)} left</span>}
                  {row.kind === "recurring" && row.r.end && <span className="muted small">until {monthLabel(monthOf(row.r.end), true)}</span>}
                  {row.kind === "loan" && <span className="muted small">{fmt(row.balance, C)} left</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && <TxnSheet txn={open.txn} recurring={open.recurring} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** "1 Dec", with the year when it isn't this year */
const dayMonth = (date: string) => { const d = shortDate(date); return date.slice(0, 4) === todayStr().slice(0, 4) ? d.slice(0, -5) : d; };

function Heading({ s }: { s: AppState }) {
  const D = s.settings.display;
  const years = 10, months = years * 12;
  const runs = useMemo(() => runAll(s, null, months, { real: false, range: false, rangeWith: true }), [s, months]);
  const w = sum(runs.map((r) => r.with.balance), months + 1);
  const wo = sum(runs.map((r) => r.without.balance), months + 1);
  const put = sum(runs.map((r) => r.with.contributed), months + 1);
  const now = thisMonth();
  return (
    <section className="card" aria-labelledby="hd-title">
      <div className="card-head">
        <h2 id="hd-title">In {years} years</h2>
        <a className="link" href="#projection">Projection <IconNext width={16} height={16} /></a>
      </div>
      <div className="tiles">
        <div className="tile">
          <span className="tile-label"><i className="key-line" style={{ background: WITH_COLOR }} />With contributions</span>
          <b className="tile-value">{fmt(w[months], D)}</b>
          <span className="muted small">{fmt(put[months], D, { compact: true })} put in</span>
        </div>
        <div className="tile">
          <span className="tile-label"><i className="key-line dashed" style={{ background: WITHOUT_COLOR, color: WITHOUT_COLOR }} />Without contributions</span>
          <b className="tile-value">{fmt(wo[months], D)}</b>
          <span className="muted small">from {fmt(w[0], D, { compact: true })} today</span>
        </div>
      </div>
      <TimeChart
        n={months + 1} title={`Combined projection over ${years} years`}
        xLabel={(i) => monthLabel(addMonths(now, i))} xTick={(i) => addMonths(now, i).slice(0, 4)} xTicks={monthTicks(now, months + 1)}
        series={[
          { id: "with", label: "With contributions", color: WITH_COLOR, values: w },
          { id: "without", label: "Without contributions", color: WITHOUT_COLOR, values: wo, dashed: true },
        ]}
        format={(v) => fmt(v, D)} tick={(v) => fmt(v, D, { compact: true })} height={170} legend={false}
      />
    </section>
  );
}
