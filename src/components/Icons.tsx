/* Small stroke icons, 24px grid, drawn in currentColor. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  "aria-hidden": true, ...p,
});

export const IconOverview = (p: P) => (
  <svg {...base(p)}><rect x="4" y="4" width="7" height="9" rx="2" /><rect x="13" y="4" width="7" height="5" rx="2" /><rect x="13" y="11" width="7" height="9" rx="2" /><rect x="4" y="15" width="7" height="5" rx="2" /></svg>
);
export const IconCashflow = (p: P) => (
  <svg {...base(p)}><path d="M7 20V5M3.5 8.5 7 5l3.5 3.5M17 4v15M13.5 15.5 17 19l3.5-3.5" /></svg>
);
export const IconInvest = (p: P) => (
  <svg {...base(p)}><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12V3.5Z" /><path d="M15 3.8A8.5 8.5 0 0 1 20.2 9H15V3.8Z" /></svg>
);
export const IconProjection = (p: P) => (
  <svg {...base(p)}><path d="M4 19h16" /><path d="M5 15.5 10 11l3 2.5 6-6.5" /><path d="M15 7h4v4" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base({ width: 18, height: 18, ...p })}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base({ width: 16, height: 16, strokeWidth: 2.2, ...p })}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconBack = (p: P) => (
  <svg {...base({ width: 20, height: 20, strokeWidth: 2.2, ...p })}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconNext = (p: P) => (
  <svg {...base({ width: 20, height: 20, strokeWidth: 2.2, ...p })}><path d="M9 5l7 7-7 7" /></svg>
);
export const IconChevronDown = (p: P) => (
  <svg {...base({ width: 16, height: 16, strokeWidth: 2.2, ...p })}><path d="M6 9l6 6 6-6" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base({ width: 18, height: 18, strokeWidth: 2.2, ...p })}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconMinus = (p: P) => (
  <svg {...base({ width: 18, height: 18, strokeWidth: 2.2, ...p })}><path d="M5 12h14" /></svg>
);
export const IconExternal = (p: P) => (
  <svg {...base({ width: 14, height: 14, strokeWidth: 2, ...p })}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base({ width: 14, height: 14, strokeWidth: 2.6, ...p })}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const IconRepeat = (p: P) => (
  <svg {...base({ width: 14, height: 14, strokeWidth: 2, ...p })}><path d="M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3" /></svg>
);
export const IconLock = (p: P) => (
  <svg {...base({ width: 14, height: 14, strokeWidth: 2, ...p })}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const IconEdit = (p: P) => (
  <svg {...base({ width: 18, height: 18, ...p })}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="M13.5 6.5l4 4" /></svg>
);
