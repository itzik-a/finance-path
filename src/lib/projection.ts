/* Projections for the app's sources: with and without contributions, in the display currency,
   optionally in today's money, with low / high scenarios. The math is in compound.ts. */
import { liveSources } from "../state/actions";
import type { AppState, Source } from "../types";
import { deflate, project, type Projection } from "./compound";
import { balanceOf, toDisplay } from "./finance";

export type { Projection };

export interface SourceRun {
  source: Source;
  /** starting balance in the display currency */
  now: number;
  with: Projection;
  without: Projection;
  low?: number[];
  high?: number[];
}

/** Every selected source projected with and without contributions, converted to the display currency
    (at today's rate: the rate is assumed to stay), optionally in today's money, with low / high scenarios. */
export function runAll(s: AppState, ids: string[] | null, months: number, opts: { real: boolean; range: boolean; rangeWith: boolean }): SourceRun[] {
  const sources = liveSources(s).filter((x) => !ids || ids.includes(x.id));
  const conv = (src: Source, xs: number[]) => {
    const d = xs.map((v) => toDisplay(s, v, src.currency));
    return opts.real ? deflate(d, s.settings.inflationPct) : d;
  };
  const convP = (src: Source, p: Projection): Projection => ({ balance: conv(src, p.balance), contributed: conv(src, p.contributed), fees: conv(src, p.fees) });
  return sources.map((src) => {
    const b0 = balanceOf(s, src.id)?.balance ?? 0;
    const run: SourceRun = {
      source: src,
      now: toDisplay(s, b0, src.currency),
      with: convP(src, project(src, b0, { months, contributions: true })),
      without: convP(src, project(src, b0, { months, contributions: false })),
    };
    if (opts.range) {
      const d = s.settings.spreadPct;
      run.low = conv(src, project(src, b0, { months, contributions: opts.rangeWith, returnDelta: -d }).balance);
      run.high = conv(src, project(src, b0, { months, contributions: opts.rangeWith, returnDelta: d }).balance);
    }
    return run;
  });
}

/** Element-wise sum. */
export function sum(rows: number[][], n: number): number[] {
  const out = new Array<number>(n).fill(0);
  for (const r of rows) for (let i = 0; i < n; i++) out[i] += r[i] ?? 0;
  return out;
}
