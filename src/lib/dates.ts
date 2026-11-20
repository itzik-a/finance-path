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

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const mon = (ym: string) => Number(ym.slice(5, 7)) - 1;

/** "November 2026" or, short, "Nov 2026" */
export const monthLabel = (ym: string, short = false) => `${short ? MONTHS[mon(ym)].slice(0, 3) : MONTHS[mon(ym)]} ${ym.slice(0, 4)}`;

/** "Nov '26", for chart axes */
export const monthTick = (ym: string) => `${MONTHS[mon(ym)].slice(0, 3)} '${ym.slice(2, 4)}`;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon 16 Nov", with the year when it isn't this year */
export function dayLabel(date: string): string {
  const d = parse(date);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}${sameYear ? "" : ` ${d.getFullYear()}`}`;
}

/** "16 Nov 2026" */
export const shortDate = (date: string) => { const d = parse(date); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };

export function ago(t?: number) {
  if (!t) return "not yet";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return shortDate(dateStr(new Date(t)));
}
