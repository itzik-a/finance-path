/* Money: formatting, converting between ₪ and $, and reading typed amounts. */
import type { Currency, Settings } from "../types";

export const SYMBOL: Record<Currency, string> = { ILS: "₪", USD: "$" };

const cache = new Map<string, Intl.NumberFormat>();
function nf(key: string, opts: Intl.NumberFormatOptions) {
  let f = cache.get(key);
  if (!f) { f = new Intl.NumberFormat("en-US", opts); cache.set(key, f); }
  return f;
}

/** ₪12,345 · $1,234.50 · ₪1.2M (compact) · +₪500 (sign) */
export function fmt(amount: number, currency: Currency, o: { compact?: boolean; sign?: boolean; cents?: boolean } = {}): string {
  const abs = Math.abs(amount);
  const cents = o.cents ?? (abs < 100 && abs % 1 !== 0);
  const compact = o.compact && abs >= 10_000;
  const f = compact
    ? nf(`${currency}c${abs >= 1e6 ? 2 : 1}`, { style: "currency", currency, notation: "compact", maximumFractionDigits: abs >= 1e6 ? 2 : 1 })
    : nf(`${currency}${cents ? "d" : ""}`, { style: "currency", currency, minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  const s = f.format(abs);
  return amount < 0 ? `−${s}` : o.sign && amount > 0 ? `+${s}` : s;
}

/** A plain number with separators: 12,345 */
export const num = (n: number, digits = 0) => nf(`n${digits}`, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);

/** Percent: 5.5% */
export const pct = (n: number, digits = 1) => `${num(n, n % 1 === 0 ? 0 : digits)}%`;

/** Convert between ₪ and $ at the settings' rate. */
export function convert(amount: number, from: Currency, to: Currency, s: Pick<Settings, "usdIls">): number {
  if (from === to) return amount;
  return from === "USD" ? amount * s.usdIls : amount / s.usdIls;
}

/** "12,345.6", "12 345", "₪1,000" → 12345.6; empty or junk → NaN */
export function parseAmount(raw: string): number {
  const t = raw.replace(/[₪$\s,]/g, "").replace(/[^\d.\-]/g, "");
  if (!t || t === "." || t === "-") return NaN;
  return Number(t);
}

/** A number for an input box (no separators, no trailing .00). */
export const inputValue = (n: number | undefined) => (n == null || Number.isNaN(n) ? "" : String(Math.round(n * 100) / 100));
