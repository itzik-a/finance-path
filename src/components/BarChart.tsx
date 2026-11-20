/* Grouped columns, one group per month (SVG, no library). Dataviz specs: columns at most 24px wide with
   4px rounded tops, square at the baseline, a 2px surface gap between neighbours, hairline grid, one y-axis,
   legend for 2+ series, and a tooltip per month listing every series (pointer, touch, arrow keys). */
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export interface BarSeries { id: string; label: string; color: string; values: number[] }

function niceStep(x: number) {
  if (!(x > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/** A column with a rounded top (or bottom, for negatives) and a square base. */
function column(x: number, w: number, y0: number, y1: number) {
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return "";
  const r = Math.min(4, w / 2, h);
  if (y1 < y0) return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

export function BarChart({ labels, tipLabels, series, format, tick, title, height = 210, current, onPick }: {
  /** axis label per group */
  labels: string[];
  /** tooltip heading per group */
  tipLabels: string[];
  series: BarSeries[];
  format: (v: number) => string;
  tick: (v: number) => string;
  title: string;
  height?: number;
  /** the group to mark as selected */
  current?: number;
  onPick?: (i: number) => void;
}) {
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

  const n = labels.length;
  if (!n) return null;
  const padL = 46, padR = 6, padT = 12, padB = 24;
  const iw = Math.max(40, w - padL - padR), ih = height - padT - padB;
  const all = series.flatMap((s) => s.values);
  const maxV = Math.max(...all, 0), minV = Math.min(...all, 0);
  const step = niceStep((maxV - minV || 1) / 4);
  const top = Math.max(step, Math.ceil(maxV / step) * step);
  const bottom = Math.floor(minV / step) * step;
  const y = (v: number) => padT + ih - ((v - bottom) / (top - bottom)) * ih;
  const band = iw / n;
  const gap = 2;
  const bw = Math.max(2, Math.min(24, (band * 0.72 - gap * (series.length - 1)) / series.length));
  const groupW = bw * series.length + gap * (series.length - 1);
  const gx = (i: number) => padL + band * i + (band - groupW) / 2;
  const yTicks: number[] = [];
  for (let v = bottom; v <= top + step / 1000; v += step) yTicks.push(Math.round(v * 1e6) / 1e6);
  const every = Math.ceil(n / Math.max(1, Math.floor(iw / 40)));

  const at = (px: number) => Math.max(0, Math.min(n - 1, Math.floor((px - padL) / band)));
  const onMove = (e: PointerEvent<SVGSVGElement>) => setActive(at(e.clientX - e.currentTarget.getBoundingClientRect().left));
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "Enter" && active != null) { onPick?.(active); return; }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = active ?? current ?? n - 1;
    setActive(Math.max(0, Math.min(n - 1, i + (e.key === "ArrowRight" ? 1 : -1))));
  };
  const a = active;
  const tipLeft = a != null ? Math.min(Math.max(padL + band * (a + 0.5), 90), w - 90) : 0;

  return (
    <div className="chart-block">
      <div className="chart" ref={wrap}>
        <svg width={w} height={height} role="img" tabIndex={0} aria-label={`${title}. Use the arrow keys to read each month${onPick ? ", Enter to open it" : ""}.`}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={(e) => { if (e.pointerType !== "touch") setActive(null); }}
          onClick={(e) => onPick?.(at(e.clientX - e.currentTarget.getBoundingClientRect().left))}
          onKeyDown={onKey} onBlur={() => setActive(null)} style={onPick ? { cursor: "pointer" } : undefined}>
          {current != null && <rect className="bar-current" x={padL + band * current} y={padT} width={band} height={ih} rx={6} />}
          {a != null && <rect className="bar-hover" x={padL + band * a} y={padT} width={band} height={ih} rx={6} />}
          {yTicks.map((v) => (
            <g key={v}>
              <line className={v === 0 ? "chart-base" : "chart-grid"} x1={padL} x2={padL + iw} y1={y(v)} y2={y(v)} />
              <text className="chart-tick" x={padL - 8} y={y(v)} dy="0.32em" textAnchor="end">{tick(v)}</text>
            </g>
          ))}
          {labels.map((l, i) => (i % every === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= every) && (
            <text key={i} className={`chart-tick${i === current ? " strong" : ""}`} x={padL + band * (i + 0.5)} y={height - 7} textAnchor="middle">{l}</text>
          ))}
          {series.map((s, k) => s.values.map((v, i) => (
            <path key={`${s.id}${i}`} d={column(gx(i) + k * (bw + gap), bw, y(0), y(v))} style={{ fill: s.color }} />
          )))}
        </svg>
        {a != null && (
          <div className="chart-tip" style={{ left: tipLeft }} role="status">
            <span className="tip-head">{tipLabels[a]}</span>
            {series.map((s) => (
              <span key={s.id} className="tip-row"><i className="key-rect" style={{ background: s.color }} /><b>{format(s.values[a])}</b><span>{s.label}</span></span>
            ))}
          </div>
        )}
      </div>
      {series.length > 1 && (
        <ul className="legend" aria-label="Legend">
          {series.map((s) => <li key={s.id}><i className="key-rect" style={{ background: s.color }} />{s.label}</li>)}
        </ul>
      )}
    </div>
  );
}
