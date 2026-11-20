/* Projection (#projection, #projection/<source id>): where the money is heading, per source or combined,
   over a chosen period, with and / or without contributions, nominal or in today's money, with a low–high range. */
import { useMemo } from "react";
import { ExamplesNote } from "../components/ExamplesNote";
import { IconPlus } from "../components/Icons";
import { TimeChart, monthTicks, type ChartSeries } from "../components/TimeChart";
import { Seg, Stepper, Switch, useLocalState } from "../components/ui";
import { addMonths, monthEnd, monthLabel, monthTick, thisMonth } from "../lib/dates";
import { balanceOf, snapshotsOf, sourceColor, toDisplay } from "../lib/finance";
import { fmt, pct } from "../lib/money";
import { runAll, sum, type SourceRun } from "../lib/projection";
import { liveSources } from "../state/actions";
import { useAppState, type AppState } from "../state/store";
import type { Currency } from "../types";

type Contrib = "both" | "with" | "without";
export interface ProjPrefs { years: number; contrib: Contrib; real: boolean; range: boolean; split: "total" | "sources"; ids: string[] | null }
export const PROJ_DEFAULTS: ProjPrefs = { years: 10, contrib: "both", real: false, range: false, split: "total", ids: null };
const PRESETS = [1, 5, 10, 20, 30];

export const WITH_COLOR = "var(--s1)";
export const WITHOUT_COLOR = "var(--s2)";

export function Projection({ sub }: { sub?: string }) {
  const s = useAppState();
  const [p, setP] = useLocalState<ProjPrefs>("financePath.projection", PROJ_DEFAULTS);
  const prefs = { ...PROJ_DEFAULTS, ...p };
  const set = (x: Partial<ProjPrefs>) => setP({ ...prefs, ...x });
  const sources = liveSources(s);

  // #projection/<id> opens with just that source picked.
  const ids = useMemo(() => {
    if (sub && sources.some((x) => x.id === sub)) return [sub];
    const live = prefs.ids?.filter((id) => sources.some((x) => x.id === id));
    return live && live.length && live.length < sources.length ? live : null;
  }, [sub, prefs.ids, sources]);

  const pick = (id: string | null) => {
    if (sub) history.replaceState(null, "", "#projection");
    if (id == null) return set({ ids: null });
    const cur = ids ?? [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    set({ ids: next.length && next.length < sources.length ? next : null });
  };

  if (!sources.length) {
    return (
      <>
        <header className="page-head"><h1 className="display">Projection</h1></header>
        <section className="card empty">
          <h2>Nothing to project yet</h2>
          <p className="muted">Add your investments with a balance, an expected return and what you add each month.</p>
          <a className="btn primary" href="#investments"><IconPlus /> Add an investment</a>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="page-head">
        <h1 className="display">Projection</h1>
        <p className="muted">Where your investments are heading, if the returns hold.</p>
      </header>
      <ExamplesNote />

      <section className="controls card" aria-label="What to project">
        <div className="chips" role="group" aria-label="Investments">
          <button type="button" className="chip" aria-pressed={!ids} onClick={() => pick(null)}>All</button>
          {sources.map((x) => (
            <button key={x.id} type="button" className="chip src-chip" aria-pressed={!!ids?.includes(x.id)} onClick={() => pick(x.id)}>
              <span className="swatch sm" style={{ background: sourceColor(x) }} aria-hidden="true" />{x.name}
            </button>
          ))}
        </div>
        <div className="ctl-row">
          <Seg<number> label="Period" className="period" value={PRESETS.includes(prefs.years) ? prefs.years : -1}
            onChange={(y) => set({ years: y === -1 ? (PRESETS.includes(prefs.years) ? 15 : prefs.years) : y })}
            options={[...PRESETS.map((y) => ({ id: y, label: `${y}y` })), { id: -1, label: "Other" }]} />
          {!PRESETS.includes(prefs.years) && (
            <Stepper label="Years" value={prefs.years} min={1} max={60} step={1} onChange={(y) => set({ years: y })} />
          )}
        </div>
        <div className="ctl-row">
          <Seg<Contrib> label="Contributions" value={prefs.contrib} onChange={(c) => set({ contrib: c })}
            options={[{ id: "both", label: "Both" }, { id: "with", label: "With" }, { id: "without", label: "Without" }]} />
          <Seg<"nominal" | "real"> label="Values" value={prefs.real ? "real" : "nominal"} onChange={(v) => set({ real: v === "real" })}
            options={[{ id: "nominal", label: "Nominal" }, { id: "real", label: "Today's money" }]} />
        </div>
        <div className="ctl-row switches">
          <label className="switch-row"><Switch on={prefs.range} onChange={(on) => set({ range: on })} label="Show the low–high range" />
            <span>Range <span className="muted">±{pct(s.settings.spreadPct)}</span></span></label>
          {(!ids || ids.length > 1) && (
            <label className="switch-row"><Switch on={prefs.split === "sources"} onChange={(on) => set({ split: on ? "sources" : "total" })} label="Split by investment" />
              <span>By investment</span></label>
          )}
        </div>
      </section>

      <ProjectionBody s={s} ids={ids} prefs={prefs} />
    </>
  );
}

function ProjectionBody({ s, ids, prefs }: { s: AppState; ids: string[] | null; prefs: ProjPrefs }) {
  const D = s.settings.display;
  const months = prefs.years * 12;
  const showWith = prefs.contrib !== "without";
  const showWithout = prefs.contrib !== "with";
  const runs = useMemo(
    () => runAll(s, ids, months, { real: prefs.real, range: prefs.range, rangeWith: showWith }),
    [s, ids, months, prefs.real, prefs.range, showWith],
  );
  const now = thisMonth();
  const hist = useHistory(s, runs, months);
  const H = hist.length; // months of actual history before now
  const n = H + months + 1;
  const first = addMonths(now, -H);
  const pad = (xs: number[]) => [...new Array<null>(H).fill(null), ...xs];

  const withTotal = sum(runs.map((r) => r.with.balance), months + 1);
  const withoutTotal = sum(runs.map((r) => r.without.balance), months + 1);
  const contributed = sum(runs.map((r) => r.with.contributed), months + 1);
  const feesWith = sum(runs.map((r) => r.with.fees), months + 1);
  const feesWithout = sum(runs.map((r) => r.without.fees), months + 1);
  const low = prefs.range ? sum(runs.map((r) => r.low!), months + 1) : null;
  const high = prefs.range ? sum(runs.map((r) => r.high!), months + 1) : null;
  const start = withTotal[0];
  const stacked = prefs.split === "sources" && runs.length > 1;

  let series: ChartSeries[];
  if (stacked) {
    const pick = (r: SourceRun) => (showWith ? r.with.balance : r.without.balance);
    series = runs.map((r) => ({ id: r.source.id, label: r.source.name, color: sourceColor(r.source), values: [...hist.map((h) => h.by[r.source.id] ?? 0), ...pick(r)] }));
  } else {
    series = [];
    if (showWith) series.push({ id: "with", label: "With contributions", color: WITH_COLOR, values: pad(withTotal) });
    if (showWithout) series.push({ id: "without", label: "Without contributions", color: WITHOUT_COLOR, values: pad(withoutTotal), dashed: prefs.contrib === "both" });
    if (H) series.unshift({ id: "actual", label: "Actual", color: "var(--ink)", values: [...hist.map((h) => (h.recorded ? h.total : null)), start], connect: true });
  }

  const end = months;
  const fmtD = (v: number) => fmt(v, D);
  const fmtC = (v: number) => fmt(v, D, { compact: true });
  const endYm = addMonths(now, months);
  const label = prefs.years === 1 ? "In 1 year" : `In ${prefs.years} years`;
  const realNote = prefs.real ? ` in today's money (${pct(s.settings.inflationPct)} inflation)` : "";

  return (
    <>
      <section className="card" aria-labelledby="proj-title">
        <div className="card-head">
          <h2 id="proj-title">{label}<span className="muted small"> · {monthLabel(endYm)}{realNote}</span></h2>
        </div>
        <div className="tiles">
          {showWith && (
            <div className="tile">
              <span className="tile-label"><i className="key-line" style={{ background: WITH_COLOR }} />With contributions</span>
              <b className="tile-value">{fmtD(withTotal[end])}</b>
              {low && high && showWith && <span className="muted small">{fmtC(low[end])} – {fmtC(high[end])}</span>}
            </div>
          )}
          {showWithout && (
            <div className="tile">
              <span className="tile-label"><i className={`key-line${prefs.contrib === "both" ? " dashed" : ""}`} style={{ background: WITHOUT_COLOR, color: WITHOUT_COLOR }} />Without contributions</span>
              <b className="tile-value">{fmtD(withoutTotal[end])}</b>
              {low && high && !showWith && <span className="muted small">{fmtC(low[end])} – {fmtC(high[end])}</span>}
            </div>
          )}
        </div>
        <TimeChart
          n={n} title={`Projected balance, ${label.toLowerCase()}`}
          xLabel={(i) => `${monthLabel(addMonths(first, i))}${i < H ? " · actual" : i === H ? " · now" : ""}`}
          xTick={(i) => { const ym = addMonths(first, i); return n > 25 ? ym.slice(0, 4) : monthTick(ym); }}
          xTicks={monthTicks(first, n)}
          series={series} stacked={stacked}
          band={low && high && !stacked ? { lo: pad(low), hi: pad(high), label: `Range (return ±${pct(s.settings.spreadPct)})`, color: showWith ? WITH_COLOR : WITHOUT_COLOR } : undefined}
          today={H || undefined}
          format={fmtD} tick={fmtC} endLabels height={260}
        />
        {stacked && prefs.contrib === "both" && <p className="muted small">Stacked with contributions. Pick "Without" to stack those instead.</p>}
      </section>

      <section className="card" aria-labelledby="break-title">
        <h2 id="break-title">How it gets there</h2>
        <dl className="breakdown">
          <div><dt>Today</dt><dd>{fmtD(start)}</dd></div>
          {showWith && <div><dt>You put in</dt><dd>+{fmtD(contributed[end])}</dd></div>}
          {showWith && <div><dt>Growth, with contributions</dt><dd className="pos">+{fmtD(withTotal[end] - start - contributed[end] + feesWith[end])}</dd></div>}
          {showWith && <div><dt>Fees, with contributions</dt><dd className="neg">−{fmtD(feesWith[end])}</dd></div>}
          {showWithout && <div><dt>Growth, without contributions</dt><dd className="pos">+{fmtD(withoutTotal[end] - start + feesWithout[end])}</dd></div>}
          {showWithout && <div><dt>Fees, without contributions</dt><dd className="neg">−{fmtD(feesWithout[end])}</dd></div>}
        </dl>
        {prefs.real && <p className="muted small">Every amount is in today's money: future amounts are divided by {pct(s.settings.inflationPct)} inflation a year.</p>}
        {runs.some((r) => r.source.currency !== D) && (
          <p className="muted small">{D === "ILS" ? "$" : "₪"} investments are projected in their own currency and shown at today's rate ({s.settings.usdIls.toFixed(2)} ₪ per $).</p>
        )}
      </section>

      {runs.length > 1 && <BySource runs={runs} end={end} D={D} showWith={showWith} showWithout={showWithout} label={label} />}
      <YearTable years={prefs.years} D={D} showWith={showWith} showWithout={showWithout} withTotal={withTotal} withoutTotal={withoutTotal} contributed={contributed} />
    </>
  );
}

/** The actual total of the picked sources at each past month's end (each source's latest balance by then),
    for up to a quarter of the period before now (at least 6 months, at most 5 years), only as far back as
    there are balances. `recorded`: some picked source has a balance dated in that month (the line joins those). */
function useHistory(s: AppState, runs: SourceRun[], months: number): { total: number; by: Record<string, number>; recorded: boolean }[] {
  const now = thisMonth();
  const earliest = runs.map((r) => snapshotsOf(s, r.source.id)[0]?.date).filter(Boolean).sort()[0];
  if (!earliest) return [];
  const want = Math.min(60, Math.max(6, Math.round(months / 4)));
  let H = 0;
  while (H < want && addMonths(now, -(H + 1)) >= earliest.slice(0, 7)) H++;
  const out: { total: number; by: Record<string, number>; recorded: boolean }[] = [];
  for (let k = H; k >= 1; k--) {
    const ym = addMonths(now, -k);
    const date = monthEnd(ym);
    const recorded = runs.some((r) => snapshotsOf(s, r.source.id).some((x) => x.date.startsWith(ym)));
    const by: Record<string, number> = {};
    let total = 0;
    for (const r of runs) {
      const b = balanceOf(s, r.source.id, date);
      const v = b ? toDisplay(s, b.balance, r.source.currency) : 0;
      by[r.source.id] = v;
      total += v;
    }
    out.push({ total, by, recorded });
  }
  // Past balances are shown as they were; "today's money" only deflates the future.
  return out;
}

function BySource({ runs, end, D, showWith, showWithout, label }: { runs: SourceRun[]; end: number; D: Currency; showWith: boolean; showWithout: boolean; label: string }) {
  const tot = (f: (r: SourceRun) => number) => runs.reduce((a, r) => a + f(r), 0);
  return (
    <section className="card" aria-labelledby="bys-title">
      <h2 id="bys-title">By investment <span className="muted small">· {label.toLowerCase()}</span></h2>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th scope="col">Investment</th><th scope="col">Today</th>{showWith && <th scope="col">With</th>}{showWithout && <th scope="col">Without</th>}</tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.source.id}>
                <th scope="row"><span className="swatch sm" style={{ background: sourceColor(r.source) }} aria-hidden="true" /> {r.source.name}</th>
                <td>{fmt(r.now, D, { compact: true })}</td>
                {showWith && <td>{fmt(r.with.balance[end], D, { compact: true })}</td>}
                {showWithout && <td>{fmt(r.without.balance[end], D, { compact: true })}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>{fmt(tot((r) => r.now), D, { compact: true })}</td>
              {showWith && <td>{fmt(tot((r) => r.with.balance[end]), D, { compact: true })}</td>}
              {showWithout && <td>{fmt(tot((r) => r.without.balance[end]), D, { compact: true })}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function YearTable({ years, D, showWith, showWithout, withTotal, withoutTotal, contributed }: {
  years: number; D: Currency; showWith: boolean; showWithout: boolean; withTotal: number[]; withoutTotal: number[]; contributed: number[];
}) {
  const now = thisMonth();
  const rows = Array.from({ length: years }, (_, k) => (k + 1) * 12);
  return (
    <details className="card year-table">
      <summary><h2>Year by year</h2><span className="muted small">{years} {years === 1 ? "row" : "rows"}</span></summary>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th scope="col">Year</th>{showWith && <th scope="col">Put in</th>}{showWith && <th scope="col">With</th>}{showWithout && <th scope="col">Without</th>}</tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m}>
                <th scope="row">{m / 12} <span className="muted">· {monthLabel(addMonths(now, m), true)}</span></th>
                {showWith && <td>{fmt(contributed[m], D, { compact: true })}</td>}
                {showWith && <td>{fmt(withTotal[m], D, { compact: true })}</td>}
                {showWithout && <td>{fmt(withoutTotal[m], D, { compact: true })}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
