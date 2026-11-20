/* Local calendar dates as strings: days "YYYY-MM-DD", months "YYYY-MM". */

const pad = (n: number) => String(n).padStart(2, "0");

export const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => dateStr(new Date());
export const monthOf = (date: string) => date.slice(0, 7);
export const thisMonth = () => monthOf(todayStr());

/** "YYYY-MM" plus n months (n may be negative). */
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}

/** Whole months from a to b ("YYYY-MM"), b − a. */
export function monthDiff(a: string, b: string): number {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/** The last day of a month, as "YYYY-MM-DD". */
export function monthEnd(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${ym}-${pad(new Date(y, m, 0).getDate())}`;
}

const parse = (date: string) => { const [y, m, d] = date.split("-").map(Number); return new Date(y, m - 1, d || 1); };

/** "November 2026" or, short, "Nov 2026" */
export const monthLabel = (ym: string, short = false) =>
  parse(ym).toLocaleDateString("en-GB", { month: short ? "short" : "long", year: "numeric" });

/** "Nov '26", for chart axes */
export const monthTick = (ym: string) => {
  const d = parse(ym);
  return `${d.toLocaleDateString("en-GB", { month: "short" })} '${String(d.getFullYear()).slice(2)}`;
};

/** "Mon 16 Nov", with the year when it isn't this year */
export function dayLabel(date: string): string {
  const d = parse(date);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/** "16 Nov 2026" */
export const shortDate = (date: string) => parse(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function ago(t?: number) {
  if (!t) return "not yet";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
