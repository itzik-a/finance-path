/* The $ → ₪ rate from the European Central Bank's daily reference rates (via frankfurter.dev,
   free, no key, nothing about the user is sent). Refreshed at most every 12 hours while "auto" is on. */
import { setRate } from "../state/actions";
import { getState } from "../state/store";

const URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=ILS";
const EVERY = 12 * 3600_000;

export async function fetchRate(): Promise<number> {
  const res = await fetch(URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Rate service answered ${res.status}`);
  const j = (await res.json()) as { rates?: { ILS?: number } };
  const r = j.rates?.ILS;
  if (!r || !(r > 0)) throw new Error("No ₪ rate in the answer");
  return r;
}

/** Refresh the rate if it's on auto and older than 12 hours. Quiet on failure (the last rate stays). */
export async function refreshRate(force = false) {
  const s = getState().settings;
  if (!s.rateAuto && !force) return;
  if (!force && s.rateAt && Date.now() - s.rateAt < EVERY) return;
  if (!navigator.onLine) return;
  try { setRate(await fetchRate(), true); } catch (e) { console.warn("[fx]", e); if (force) throw e; }
}
