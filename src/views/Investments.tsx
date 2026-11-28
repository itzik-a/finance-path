/* Investments: the sources with their latest balance and the loans (#investments), one source's page
   (#investments/<id>) and one loan's page (#investments/loan/<id>, src/views/LoanPage.tsx). */
import { useState } from "react";
import { ExamplesNote } from "../components/ExamplesNote";
import { IconBack, IconEdit, IconNext, IconPlus } from "../components/Icons";
import { SnapshotSheet } from "../components/SnapshotSheet";
import { SourceSheet } from "../components/SourceSheet";
import { SourceProjection } from "../components/SourceProjection";
import { TimeChart, monthTicks } from "../components/TimeChart";
import { addMonths, monthDiff, monthLabel, monthOf, monthTick, shortDate, thisMonth } from "../lib/dates";
import { balanceOf, kindLabel, netWorth, snapshotsOf, sourceColor, toDisplay } from "../lib/finance";
import { fmt, pct } from "../lib/money";
import { deleteSource, liveSources } from "../state/actions";
import { useAppState, type AppState } from "../state/store";
import { LoanList, LoanPage } from "./LoanPage";
import type { Snapshot, Source } from "../types";

export function Investments({ sub }: { sub?: string }) {
  const s = useAppState();
  const loan = sub?.startsWith("loan/") ? s.loans.find((x) => x.id === sub.slice(5) && !x.deletedAt) : undefined;
  if (loan) return <LoanPage s={s} loan={loan} />;
  const src = sub ? s.sources.find((x) => x.id === sub && !x.deletedAt) : undefined;
  if (sub && src) return <SourcePage s={s} source={src} />;
  return <SourceList s={s} />;
}

function SourceList({ s }: { s: AppState }) {
  const [adding, setAdding] = useState(false);
  const sources = liveSources(s);
  const nw = netWorth(s);
  const D = s.settings.display;

  return (
    <>
      <header className="page-head row-head">
        <div>
          <h1 className="display">Investments</h1>
          {sources.length > 0 && <p className="muted">{fmt(nw.assets, D)} in {sources.length} {sources.length === 1 ? "place" : "places"}</p>}
        </div>
        <button type="button" className="btn primary sm" onClick={() => setAdding(true)}><IconPlus /> Add</button>
      </header>
      <ExamplesNote />

      {sources.length === 0 ? (
        <section className="card empty">
          <h2>Where is your money invested?</h2>
          <p className="muted">Add each place: a pension fund, keren hishtalmut, a brokerage account, savings. Give it a balance, an expected return and what you add each month, and the projection does the rest.</p>
          <button type="button" className="btn primary" onClick={() => setAdding(true)}><IconPlus /> Add an investment</button>
        </section>
      ) : (
        <ul className="src-list">
          {sources.map((x) => <li key={x.id}><SourceRow s={s} source={x} total={nw.assets} /></li>)}
        </ul>
      )}
      <LoanList s={s} />
      {adding && <SourceSheet onClose={() => setAdding(false)} onSaved={(id) => { location.hash = `#investments/${id}`; }} />}
    </>
  );
}

function SourceRow({ s, source, total }: { s: AppState; source: Source; total: number }) {
  const b = balanceOf(s, source.id);
  const D = s.settings.display;
  const inD = b ? toDisplay(s, b.balance, source.currency) : 0;
  return (
    <a className="card src-card" href={`#investments/${source.id}`}>
      <span className="swatch" style={{ background: sourceColor(source) }} aria-hidden="true" />
      <span className="src-card-main">
        <span className="src-card-name">{source.name}{source.example && <span className="tag">Example</span>}</span>
        <span className="muted small">{pct(source.returnPct)} a year{source.monthly > 0 ? ` · ${fmt(source.monthly, source.currency)} a month` : ""}</span>
      </span>
      <span className="src-card-amt">
        <b>{b ? fmt(b.balance, source.currency) : "No balance"}</b>
        <span className="muted small">
          {b && source.currency !== D ? `${fmt(inD, D)} · ` : ""}{b ? (total > 0 ? `${Math.round((inD / total) * 100)}%` : "") : "Add one"}
        </span>
      </span>
      <IconNext className="chev" />
    </a>
  );
}

function SourcePage({ s, source }: { s: AppState; source: Source }) {
  const [editing, setEditing] = useState(false);
  const [snapSheet, setSnapSheet] = useState<Snapshot | "new" | null>(null);
  const snaps = snapshotsOf(s, source.id);
  const b = snaps[snaps.length - 1];
  const C = source.currency;
  const D = s.settings.display;

  return (
    <>
      <a className="back" href="#investments"><IconBack /> Investments</a>
      <header className="src-head card">
        <div className="row-head">
          <div>
            <span className="eyebrow"><span className="swatch sm" style={{ background: sourceColor(source) }} aria-hidden="true" /> {kindLabel(source.kind)}{source.example ? " · Example" : ""}</span>
            <h1 className="display">{source.name}</h1>
          </div>
          <button type="button" className="icon-btn" aria-label={`Edit ${source.name}`} onClick={() => setEditing(true)}><IconEdit /></button>
        </div>
        <div className="hero-row">
          <div>
            <span className="hero">{b ? fmt(b.balance, C) : "—"}</span>
            <span className="muted small">
              {b ? `on ${shortDate(b.date)}` : "No balance yet"}
              {b && C !== D ? ` · ${fmt(toDisplay(s, b.balance, C), D)} at ${s.settings.usdIls.toFixed(2)}` : ""}
            </span>
          </div>
          <button type="button" className="btn primary" onClick={() => setSnapSheet("new")}><IconPlus /> Add balance</button>
        </div>
        <dl className="facts">
          <div><dt>Expected return</dt><dd>{pct(source.returnPct, 2)} a year</dd></div>
          <div><dt>Fees</dt><dd>{pct(source.feeBalancePct, 2)} of balance{source.feeDepositPct ? ` · ${pct(source.feeDepositPct, 2)} of deposits` : ""}</dd></div>
          <div><dt>Monthly</dt><dd>{source.monthly > 0 ? fmt(source.monthly, C) : "Nothing"}{source.monthly > 0 && source.raisePct ? `, +${pct(source.raisePct)} a year` : ""}</dd></div>
          {source.monthly > 0 && <div><dt>Until</dt><dd>{source.contribUntil ? monthLabel(source.contribUntil) : "No end date"}</dd></div>}
        </dl>
        {source.note && <p className="small note">{source.note}</p>}
      </header>

      <SourceProjection s={s} source={source} />

      <section className="card" aria-labelledby="hist-title">
        <div className="card-head"><h2 id="hist-title">Balance history</h2></div>
        {snaps.length === 0 ? (
          <p className="muted small">Add a balance from a statement now and then (monthly or quarterly is plenty). They build this chart and show whether you're ahead of the projection.</p>
        ) : (
          <>
            {snaps.length > 1 && <History snaps={snaps} source={source} />}
            <ul className="snap-list">
              {[...snaps].reverse().map((x, i, arr) => {
                const prev = arr[i + 1];
                const d = prev ? x.balance - prev.balance : null;
                return (
                  <li key={x.id}>
                    <button type="button" className="snap-row" onClick={() => setSnapSheet(x)}>
                      <span>{shortDate(x.date)}</span>
                      <span className="snap-amt">
                        <b>{fmt(x.balance, C)}</b>
                        {d != null && <span className={`small ${d >= 0 ? "pos" : "neg"}`}>{fmt(d, C, { sign: true })}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <button type="button" className="btn ghost danger" onClick={() => { deleteSource(source.id); location.hash = "#investments"; }}>Remove {source.name}</button>

      {editing && <SourceSheet source={source} onClose={() => setEditing(false)} />}
      {snapSheet && <SnapshotSheet source={source} snapshot={snapSheet === "new" ? undefined : snapSheet} onClose={() => setSnapSheet(null)} />}
    </>
  );
}

/** Balances by month: the month's latest balance; the line runs straight across months without one. */
function History({ snaps, source }: { snaps: Snapshot[]; source: Source }) {
  const first = monthOf(snaps[0].date);
  const last = monthOf(snaps[snaps.length - 1].date) > thisMonth() ? monthOf(snaps[snaps.length - 1].date) : thisMonth();
  const n = monthDiff(first, last) + 1;
  const values: (number | null)[] = new Array(n).fill(null);
  for (const x of snaps) values[monthDiff(first, monthOf(x.date))] = x.balance;
  const C = source.currency;
  return (
    <TimeChart
      n={n} title={`${source.name} balance by month`}
      xLabel={(i) => monthLabel(addMonths(first, i))} xTick={(i) => { const ym = addMonths(first, i); return n > 25 ? ym.slice(0, 4) : monthTick(ym); }}
      xTicks={monthTicks(first, n)}
      series={[{ id: "bal", label: "Balance", color: sourceColor(source), values, connect: true }]}
      format={(v) => fmt(v, C)} tick={(v) => fmt(v, C, { compact: true })}
      height={200} endLabels legend={false} zero={false}
    />
  );
}
