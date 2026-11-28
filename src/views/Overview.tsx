/* Overview (#overview): net worth now and over time, this month's money, purchases still being paid off, and where it's heading. */
import { useMemo, useState } from "react";
import { ExamplesNote } from "../components/ExamplesNote";
import { IconNext, IconPlus } from "../components/Icons";
import { TimeChart, monthTicks } from "../components/TimeChart";
import { TxnSheet } from "../components/TxnSheet";
import type { Txn } from "../types";
import { addMonths, monthLabel, monthOf, monthTick, shortDate, thisMonth, todayStr } from "../lib/dates";
import { byCategory, monthSum, netWorth, netWorthSeries, sourceColor, upcomingPlans } from "../lib/finance";
import { fmt } from "../lib/money";
import { runAll, sum } from "../lib/projection";
import { liveSources, liveTxns } from "../state/actions";
import { useAppState, type AppState } from "../state/store";
import { FLOW_COLOR } from "./CashFlow";
import { WITHOUT_COLOR, WITH_COLOR } from "./Projection";

export function Overview() {
  const s = useAppState();
  const sources = liveSources(s);
  const hasTxns = liveTxns(s).length > 0;

  if (!sources.length && !hasTxns) {
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
      {sources.length > 0 && <NetWorth s={s} />}
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
  const { months, recorded, bySource } = series;
  const n = months.length;

  return (
    <section className="card" aria-labelledby="nw-title">
      <div className="card-head">
        <h2 id="nw-title">Net worth</h2>
        <a className="link" href="#investments">Investments <IconNext width={16} height={16} /></a>
      </div>
      <div>
        <span className="hero">{fmt(nw.total, D)}</span>
        <span className="muted small">
          {delta != null && <><b className={delta >= 0 ? "pos" : "neg"}>{fmt(delta, D, { sign: true })} ({delta >= 0 ? "+" : "−"}{Math.abs(Math.round((delta / yearAgo.total) * 100))}%)</b> in a year · </>}
          {nw.asOf ? `latest balances as of ${shortDate(nw.asOf)}` : "no balances yet"}
        </span>
      </div>
      {n > 1 && (
        <TimeChart
          n={n} title="Net worth by month, stacked by investment" stacked
          xLabel={(i) => `${monthLabel(months[i])}${recorded[i] ? "" : " · between balances"}`}
          xTick={(i) => (n > 25 ? months[i].slice(0, 4) : monthTick(months[i]))}
          xTicks={monthTicks(months[0], n)}
          series={bySource.map((b) => ({ id: b.source.id, label: b.source.name, color: sourceColor(b.source), values: b.values }))}
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

/** Purchases in payments that still have payments to come; a row opens the purchase. */
function Upcoming({ s }: { s: AppState }) {
  const D = s.settings.display;
  const { plans, total, nextMonth } = useMemo(() => upcomingPlans(s), [s]);
  const [open, setOpen] = useState<Txn | null>(null);
  if (!plans.length) return null;
  const nextName = monthLabel(addMonths(thisMonth(), 1)).split(" ")[0];
  const money = (v: number, c: Txn["currency"]) => fmt(v, c, { cents: v % 1 !== 0 });
  return (
    <section className="card" aria-labelledby="up-title">
      <div className="card-head">
        <h2 id="up-title">Upcoming payments</h2>
        <b>{fmt(total, D)} left</b>
      </div>
      <p className="muted small">
        {plans.length === 1 ? "1 purchase" : `${plans.length} purchases`} still being paid off
        {nextMonth > 0 ? <>; <b>{fmt(nextMonth, D)}</b> due in {nextName}.</> : "."}
      </p>
      <ul className="txn-list">
        {plans.map(({ next, left, leftAmount, last }) => {
          const ends = `Ends ${monthLabel(monthOf(last))}`;
          const c = s.categories.find((x) => x.id === next.categoryId);
          return (
            <li key={next.plan!.id}>
              <button type="button" className="txn-row" title={ends} onClick={() => setOpen(next)}>
                <span className="txn-emoji" aria-hidden="true">{c?.emoji ?? "•"}</span>
                <span className="txn-main">
                  <span className="txn-title" dir="auto">{next.note || c?.name || "Purchase"}</span>
                  <span className="muted small">
                    Next {dayMonth(next.date)} · {left > 1 ? `${next.plan!.part} of ${next.plan!.parts}` : "the last payment"}
                  </span>
                </span>
                <span className="txn-amt stacked">
                  {money(next.amount, next.currency)}
                  {left > 1 && <span className="muted small">{money(leftAmount, next.currency)} left</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && <TxnSheet txn={open} onClose={() => setOpen(null)} />}
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
