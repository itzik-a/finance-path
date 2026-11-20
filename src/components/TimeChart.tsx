/* Values over months (SVG, no library), following the dataviz skill's specs:
   2px lines, ~10% wash under a lone line, stacked areas split by a 2px surface gap, r=4 dots with a 2px surface ring,
   hairline solid grid, one y-axis, a legend for 2+ series, sparing end labels, and a crosshair tooltip that lists
   every series at the hovered month (pointer, touch and arrow keys). Text stays in ink colours; series colours
   only paint marks and the small keys beside their names. */
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export interface ChartSeries {
  id: string;
  label: string;
  /** a CSS colour, e.g. "var(--s1)" */
  color: string;
  values: (number | null)[];
  dashed?: boolean;
  /** draw the line straight across missing values instead of breaking it */
  connect?: boolean;
}

interface Props {
  /** number of x positions (months) */
  n: number;
  /** tooltip heading for position i, e.g. "November 2026" */
  xLabel: (i: number) => string;
  /** axis label for position i, e.g. "2030" or "Nov '26" */
  xTick: (i: number) => string;
  /** which positions get an axis label */
  xTicks: number[];
  series: ChartSeries[];
  stacked?: boolean;
  /** a shaded range drawn behind the lines (e.g. low–high scenarios) */
  band?: { lo: (number | null)[]; hi: (number | null)[]; label: string; color: string };
  /** dots for actual values (e.g. recorded balances) */
  points?: { label: string; values: (number | null)[] };
  /** a vertical "Today" line at this position */
  today?: number;
  format: (v: number) => string;
  tick: (v: number) => string;
  title: string;
  height?: number;
  /** label the end of each line (when they don't collide) */
  endLabels?: boolean;
  legend?: boolean;
  /** dots on a lone line's values (default on, up to 40 positions) */
  dots?: boolean;
  /** start the y-axis at zero (default); off fits the axis to the values (lines only, no wash) */
  zero?: boolean;
}

/** 1, 2, 2.5, 5 × 10^k at or above x. */
function niceStep(x: number) {
  if (!(x > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/** Axis positions for a run of `n` months starting at `firstMonth` ("YYYY-MM"): years when it spans
    more than two years (every 1, 2, 5 or 10 so at most `max` labels), else every k months. */
export function monthTicks(firstMonth: string, n: number, max = 5): number[] {
  if (n <= 1) return [0];
  const m0 = Number(firstMonth.slice(5, 7)) - 1;
  if (n > 25) {
    const years = (n - 1) / 12;
    const step = [1, 2, 5, 10, 20].find((s) => years / s <= max - 1) ?? 20;
    const y0 = Number(firstMonth.slice(0, 4));
    const out: number[] = [];
    for (let i = (12 - m0) % 12; i < n; i += 12) if ((y0 + Math.floor((m0 + i) / 12)) % step === 0) out.push(i);
    return out.length ? out : [0, n - 1];
  }
  const step = [1, 2, 3, 4, 6, 12].find((s) => (n - 1) / s <= max - 1) ?? 12;
  const out: number[] = [];
  for (let i = 0; i < n; i += step) out.push(i);
  if (out[out.length - 1] !== n - 1 && n - 1 - out[out.length - 1] >= step / 2) out.push(n - 1);
  return out;
}

export function TimeChart({ n, xLabel, xTick, xTicks, series, stacked, band, points, today, format, tick, title, height = 230, endLabels, legend, dots = true, zero = true }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [active, setActive] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (n < 1 || !series.length) return null;

  // Stacked: each layer sits on the sum of the ones below it.
  const tops: (number | null)[][] = [];
  if (stacked) {
    const acc = new Array<number>(n).fill(0);
    for (const s of series) tops.push(acc.map((a, i) => (acc[i] = a + (s.values[i] ?? 0))));
  }
  const totals = stacked ? tops[tops.length - 1] : null;

  const all: number[] = [];
  const push = (xs: (number | null)[] | undefined) => xs?.forEach((v) => { if (v != null && Number.isFinite(v)) all.push(v); });
  if (stacked) tops.forEach(push); else series.forEach((s) => push(s.values));
  push(band?.hi); push(band?.lo); push(points?.values);
  const fit = !zero && !stacked;
  const maxV = Math.max(...all, fit ? -Infinity : 0);
  const minV = Math.min(...all, fit ? Infinity : 0);

  const padL = 52, padR = 14, padT = 22, padB = 26;
  const iw = Math.max(40, w - padL - padR), ih = height - padT - padB;
  const step = niceStep((maxV - minV || Math.abs(maxV) || 1) / 4);
  let top = Math.max(fit ? -Infinity : step, Math.ceil(maxV / step) * step);
  const bottom = Math.floor(minV / step) * step;
  if (top <= bottom) top = bottom + step;
  const y = (v: number) => padT + ih - ((v - bottom) / (top - bottom)) * ih;
  const x = (i: number) => (n === 1 ? padL + iw / 2 : padL + (i / (n - 1)) * iw);
  const yTicks: number[] = [];
  for (let v = bottom; v <= top + step / 1000; v += step) yTicks.push(Math.round(v * 1e6) / 1e6);

  /** "M…L…" through the non-null values, breaking at gaps. */
  const linePath = (vals: (number | null)[], connect = false) => {
    let d = "", pen = false;
    vals.forEach((v, i) => {
      if (v == null) { if (!connect) pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const areaPath = (hi: (number | null)[], lo: (number | null)[] | null) => {
    const idx = hi.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0);
    if (idx.length < 2) return "";
    const upper = idx.map((i, k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(hi[i]!).toFixed(1)}`).join("");
    const lower = [...idx].reverse().map((i) => `L${x(i).toFixed(1)},${y(lo ? lo[i] ?? 0 : 0).toFixed(1)}`).join("");
    return `${upper}${lower}Z`;
  };

  const nearest = (px: number) => Math.max(0, Math.min(n - 1, Math.round(((px - padL) / iw) * (n - 1))));
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setActive(nearest(e.clientX - r.left));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const i = active ?? n - 1;
    const big = e.shiftKey ? 12 : 1;
    setActive(e.key === "Home" ? 0 : e.key === "End" ? n - 1 : Math.max(0, Math.min(n - 1, i + (e.key === "ArrowRight" ? big : -big))));
  };

  const lastIdx = (vals: (number | null)[]) => { for (let i = vals.length - 1; i >= 0; i--) if (vals[i] != null) return i; return -1; };

  // End labels: only for plain lines, and only where they don't collide (else legend + tooltip carry it).
  const ends: { id: string; i: number; v: number; yy: number }[] = [];
  if (endLabels && !stacked && active == null) {
    const cand = series.map((s) => { const i = lastIdx(s.values); return i === n - 1 ? { id: s.id, i, v: s.values[i]!, yy: y(s.values[i]!) } : null; })
      .filter((c): c is NonNullable<typeof c> => !!c).sort((a, b) => a.yy - b.yy);
    for (const c of cand) if (!ends.length || c.yy - ends[ends.length - 1].yy >= 16) ends.push(c);
  }
  if (endLabels && stacked && totals && active == null) {
    const i = lastIdx(totals);
    if (i >= 0) ends.push({ id: "total", i, v: totals[i]!, yy: y(totals[i]!) });
  }

  // Axis labels at least 48px apart (greedy from the left).
  const shownTicks: number[] = [];
  for (const i of xTicks) if (!shownTicks.length || x(i) - x(shownTicks[shownTicks.length - 1]) >= 48) shownTicks.push(i);

  const a = active;
  const tipLeft = a != null ? Math.min(Math.max(x(a), 90), w - 90) : 0;
  const showLegend = legend ?? (series.length >= 2 || !!band || !!points);
  const lastTotal = totals ? totals[lastIdx(totals)] : series[0].values[lastIdx(series[0].values)];

  return (
    <div className="chart-block">
      <div className="chart" ref={wrap}>
        <svg
          width={w} height={height} role="img" tabIndex={0}
          aria-label={`${title}.${lastTotal != null ? ` At the end: ${format(lastTotal)}.` : ""} Use the arrow keys to read each month.`}
          onPointerMove={onMove} onPointerDown={onMove}
          onPointerLeave={(e) => { if (e.pointerType !== "touch") setActive(null); }}
          onKeyDown={onKey} onBlur={() => setActive(null)}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line className={v === 0 ? "chart-base" : "chart-grid"} x1={padL} x2={padL + iw} y1={y(v)} y2={y(v)} />
              <text className="chart-tick" x={padL - 8} y={y(v)} dy="0.32em" textAnchor="end">{tick(v)}</text>
            </g>
          ))}
          {shownTicks.map((i) => (
            <text key={i} className="chart-tick" x={x(i)} y={height - 7}
              textAnchor={n === 1 ? "middle" : x(i) - padL < 20 ? "start" : padL + iw - x(i) < 20 ? "end" : "middle"}>
              {xTick(i)}
            </text>
          ))}
          {today != null && today > 0 && today < n - 1 && (
            <g>
              <line className="chart-today" x1={x(today)} x2={x(today)} y1={padT - 4} y2={y(bottom)} />
              <text className="chart-tick" x={x(today) + 4} y={padT - 8}>Today</text>
            </g>
          )}

          {band && <path className="chart-band" d={areaPath(band.hi, band.lo)} style={{ fill: band.color }} />}

          {stacked
            ? series.map((s, k) => (
              <path key={s.id} className="chart-stack" d={areaPath(tops[k], k ? tops[k - 1] : null)} style={{ fill: s.color }} />
            ))
            : series.length === 1 && !fit && <path className="chart-area" d={areaPath(series[0].values, null)} style={{ fill: series[0].color }} />}
          {stacked && series.map((s, k) => <path key={`g${s.id}`} className="chart-gap" d={linePath(tops[k])} />)}
          {!stacked && series.map((s) => (
            <path key={s.id} className={`chart-line${s.dashed ? " dashed" : ""}`} d={linePath(s.values, s.connect)} style={{ stroke: s.color }} />
          ))}
          {!stacked && dots && series.length === 1 && (n <= 40 || series[0].connect) && series[0].values.map((v, i) => v != null && (
            <circle key={i} className="chart-dot" cx={x(i)} cy={y(v)} r={4} style={{ fill: series[0].color }} />
          ))}
          {points?.values.map((v, i) => v != null && <circle key={`p${i}`} className="chart-point" cx={x(i)} cy={y(v)} r={4} />)}

          {a != null && <line className="chart-cross" x1={x(a)} x2={x(a)} y1={padT - 4} y2={y(bottom)} />}
          {a != null && !stacked && series.map((s) => s.values[a] != null && (
            <circle key={s.id} className="chart-dot" cx={x(a)} cy={y(s.values[a]!)} r={5} style={{ fill: s.color }} />
          ))}
          {a != null && stacked && tops.map((t, k) => t[a] != null && (
            <circle key={k} className="chart-dot" cx={x(a)} cy={y(t[a]!)} r={4} style={{ fill: series[k].color }} />
          ))}
          {ends.map((e) => (
            <text key={e.id} className="chart-end" x={x(e.i)} y={e.yy - 10} textAnchor={n === 1 ? "middle" : "end"}>{format(e.v)}</text>
          ))}
        </svg>
        {a != null && (
          <div className="chart-tip" style={{ left: tipLeft }} role="status">
            <span className="tip-head">{xLabel(a)}</span>
            {stacked && totals && <span className="tip-row total"><b>{format(totals[a] ?? 0)}</b><span>Total</span></span>}
            {[...series].reverse().map((s) => s.values[a] != null && (
              <span key={s.id} className="tip-row">
                <i className={`key-line${s.dashed ? " dashed" : ""}`} style={{ background: s.color, color: s.color }} />
                <b>{format(s.values[a]!)}</b><span>{s.label}</span>
              </span>
            ))}
            {band && band.lo[a] != null && band.hi[a] != null && (
              <span className="tip-row"><i className="key-band" style={{ background: band.color }} /><b>{format(band.lo[a]!)} – {format(band.hi[a]!)}</b><span>{band.label}</span></span>
            )}
            {!series.some((s) => s.values[a] != null) && !(points && points.values[a] != null) && <span className="tip-row"><span>Nothing recorded</span></span>}
            {points && points.values[a] != null && (
              <span className="tip-row"><i className="key-point" /><b>{format(points.values[a]!)}</b><span>{points.label}</span></span>
            )}
          </div>
        )}
      </div>
      {showLegend && (
        <ul className="legend" aria-label="Legend">
          {series.map((s) => (
            <li key={s.id}>
              <i className={stacked ? "key-rect" : `key-line${s.dashed ? " dashed" : ""}`} style={{ background: s.color, color: s.color }} />
              {s.label}
            </li>
          ))}
          {band && <li><i className="key-band" style={{ background: band.color }} />{band.label}</li>}
          {points && <li><i className="key-point" />{points.label}</li>}
        </ul>
      )}
    </div>
  );
}
