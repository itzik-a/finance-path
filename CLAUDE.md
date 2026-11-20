# Finance Path

A personal finance web app (React, built with Vite, hosted on GitHub Pages), used on a MacBook and an iPhone (installed to the Home Screen): income, expenses, investment balances, and growth projections per source and combined. See `PLAN.md` for the concepts, milestones and decisions.

## How it's built

Vite + React 19 + TypeScript. Node 22 (`.nvmrc`). On this Mac `npm start` runs `nvm use` and then the dev server; `npm run dev` alone runs the local server (also reachable from the iPhone on the same Wi-Fi); `npm run build` typechecks and builds into `dist/`.

- Routing is the URL hash: `#overview`, `#cashflow`, `#investments`, `#investments/<source id>`, `#projection`, `#projection/<source id>` (`readHash()` in `src/App.tsx`; everything after the first `/` is `sub`).
- `src/types.ts`: the whole saved state (`AppState`): `sources`, `snapshots` (balances), `txns`, `categories`, `recurring`, `settings`. Amounts are in the item's own currency (`ILS` / `USD`); dates are local `YYYY-MM-DD`, months `YYYY-MM` (`src/lib/dates.ts`).
- `src/seed.ts`: starter categories and the examples (`example: true`, `updatedAt: 0`). **Never rename or reuse an id there**: devices match items by id.
- `src/state/store.ts`: state in localStorage `financePath.v1`, `useAppState()`, `update(fn)`, `replaceState()`. `src/state/actions.ts`: every change goes through here and stamps the item's `updatedAt`; deletes are soft (`deletedAt`) with an Undo toast; `live*()` helpers hide them. Editing an example drops its `example` flag (it's mine now); `removeExamples()` soft-deletes the untouched ones.
- Recurring items: `applyRecurring()` (on start, after edits) adds every due transaction up to today with the id `r_<recurring id>_<YYYY-MM>` (yearly: `_<YYYY>`), so two devices add the same ones and a deleted one stays deleted.
- Money (`src/lib/money.ts`): `fmt()` (₪12,345, compact ₪1.2M), `convert()` at `settings.usdIls`, `parseAmount()`. The rate refreshes from the ECB daily rate (`src/lib/fx.ts`, frankfurter.dev) every 12 h while `settings.rateAuto`; setting it by hand turns auto off.
- Styling: plain CSS in `src/styles.css`, tokens in `:root` (Workout Path / Feed Path system with a green accent `#0F7B5F` / dark `#5CD3A8`). Chart series use `--s1`…`--s8` (the dataviz skill's validated categorical palette, light and dark), `--s-other` past eight. A source keeps its colour slot (`Source.color`) for life.
- PWA: `public/manifest.webmanifest`, `public/icon.svg`, PNG icons in `public/icons/` (full-bleed, made from the SVG with `qlmanage` + `sips`), `public/sw.js` (production only; network first for the page, cache first for hashed assets; never touches other origins).

## Rules for changes

- Design mobile-first (iPhone ~390 px), tap targets at least 44 px, safe-area padding. Below 768 px: top bar + bottom tab bar (4 tabs); from 768 px a sidebar. Check both widths, light and dark.
- Colours only from the CSS tokens in `:root`; light and dark themes must both stay readable. Text never wears a series colour (use a swatch beside it).
- New state fields must be optional in `normalize()` so older copies still load.
- Run `npm run build` after edits; it must pass with no type errors.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main` (Pages source = GitHub Actions). Live at https://itzik-a.github.io/finance-path/.
