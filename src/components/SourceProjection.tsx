/* A source's own projection on its page: 10 years with and without its contributions. */
import { TimeChart, monthTicks } from "./TimeChart";
import { addMonths, monthLabel } from "../lib/dates";
import { balanceOf } from "../lib/finance";
import { project } from "../lib/compound";
import { fmt } from "../lib/money";
import type { AppState } from "../state/store";
import type { Source } from "../types";
import { thisMonth } from "../lib/dates";
import { WITHOUT_COLOR, WITH_COLOR } from "../views/Projection";

const YEARS = 10;

export function SourceProjection({ s, source }: { s: AppState; source: Source }) {
  const b0 = balanceOf(s, source.id)?.balance ?? 0;
  if (!b0 && !source.monthly) return null;
  const months = YEARS * 12;
  const w = project(source, b0, { months, contributions: true });
  const wo = project(source, b0, { months, contributions: false });
  const C = source.currency;
  const now = thisMonth();
  const hasContrib = source.monthly > 0;
  return (
    <section className="card" aria-labelledby="sp-title">
      <div className="card-head">
        <h2 id="sp-title">In {YEARS} years</h2>
        <a className="btn ghost sm" href={`#projection/${source.id}`}>More</a>
      </div>
      <div className="tiles">
        {hasContrib && (
          <div className="tile">
            <span className="tile-label"><i className="key-line" style={{ background: WITH_COLOR }} />With contributions</span>
            <b className="tile-value">{fmt(w.balance[months], C)}</b>
            <span className="muted small">You put in {fmt(w.contributed[months], C, { compact: true })}</span>
          </div>
        )}
        <div className="tile">
          <span className="tile-label"><i className={`key-line${hasContrib ? " dashed" : ""}`} style={{ background: WITHOUT_COLOR, color: WITHOUT_COLOR }} />{hasContrib ? "Without contributions" : "Balance"}</span>
          <b className="tile-value">{fmt(wo.balance[months], C)}</b>
          <span className="muted small">Fees {fmt(wo.fees[months], C, { compact: true })}</span>
        </div>
      </div>
      <TimeChart
        n={months + 1} title={`${source.name} projected over ${YEARS} years`}
        xLabel={(i) => monthLabel(addMonths(now, i))} xTick={(i) => addMonths(now, i).slice(0, 4)} xTicks={monthTicks(now, months + 1)}
        series={[
          ...(hasContrib ? [{ id: "with", label: "With contributions", color: WITH_COLOR, values: w.balance }] : []),
          { id: "without", label: hasContrib ? "Without contributions" : "Balance", color: WITHOUT_COLOR, values: wo.balance, dashed: hasContrib },
        ]}
        format={(v) => fmt(v, C)} tick={(v) => fmt(v, C, { compact: true })} height={190} legend={false}
      />
    </section>
  );
}
