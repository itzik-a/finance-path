# Finance Path: plan

A personal app for my income, expenses and investments, with growth projections for each investment source and for all of them together. Installable on the iPhone Home Screen and usable in the browser on the MacBook. It works offline, and syncs between devices through an encrypted private gist.

## 1. Concepts

| Thing | What it is | Example |
|---|---|---|
| **Source** | One place money is invested: kind, currency (₪ / $), expected yearly return, fees (on the balance and on deposits), monthly contribution, its yearly raise, an optional last month of contributions | Pension fund, Keren hishtalmut, S&P 500 index fund ($), savings deposit |
| **Balance** (snapshot) | A source's actual value on a date, copied from a statement. Gives real history, net worth over time, and the projection's starting point | Pension: ₪412,300 on 2026-10-31 |
| **Transaction** | Income, an expense, or money moved into an investment ("Invested": counted as saved, not spent) | Salary +₪24,000 · Groceries −₪688 · S&P 500 buy $500 |
| **Category** | Groups transactions; starter set, editable | Housing, Groceries, Salary, Investing |
| **Recurring** | A transaction that repeats monthly or yearly and adds itself when due | Rent on the 1st, salary on the 10th |
| **Scenario** | Low / base / high return: base ± a spread (default 2 points) | 3.5% / 5.5% / 7.5% |

## 2. Projection

Month by month, per source, in the source's own currency:

```
balance ← balance × (1 + r)                 r = (1 + yearly return)^(1/12) − 1
balance ← balance × (1 − yearly fee / 12)    fee on the balance
balance ← balance + contribution × (1 − deposit fee)
the contribution rises by the yearly raise every 12 months and stops after its last month
```

- **Period**: 1, 5, 10, 20, 30 years, or any number of years (1–60).
- **With and without contributions**: both lines on one chart; the breakdown shows what I put in, what it grew by, and what fees took.
- **One source, several, or all**: the total is the sum of the sources; "By source" stacks them so I can see what each adds.
- **Nominal or today's money**: deflated by the inflation setting (default 2.5%).
- **Range**: low–high band around the base line.
- **Actual vs projected**: past balances are drawn to the left of today.
- $ sources are projected in $ and shown at today's rate (the rate is assumed to stay).

## 3. Screens

Tabs: **Overview · Cash flow · Investments · Projection**

- **Overview**: net worth now and over time (stacked by source), this month's income / expenses / invested / savings rate, top spending categories, a 10-year projection teaser.
- **Cash flow**: month switcher, the month's summary, transactions by day (search across all months), spending by category, 12-month income vs expenses chart, recurring items, categories.
- **Investments**: the sources with balance, as-of date, return and contribution; total. A source's page: balance history chart, add a balance, its settings, its own projection.
- **Projection**: source chips, period, with / without / both, nominal / today's money, range, total / by source, breakdown tiles, year-by-year table.
- **Data & settings** (pill in the top bar / sidebar): encrypted sync, encrypted backup, display currency, $→₪ rate (auto from the ECB's daily rate, or set by hand), inflation, scenario spread, remove the examples.

## 4. Milestones

1. **Scaffold**: plan, CLAUDE.md, PWA, Pages deploy, state + seed examples.
2. **Investments**: sources and balances (add, edit, remove), history chart.
3. **Projection**: engine + screen.
4. **Cash flow**: transactions, categories, recurring, month summary, charts.
5. **Overview**: net worth over time, this month, projection teaser.
6. **Sync & settings**: encrypted gist sync, backup export / import, settings.

Status 2026-11-20: 1–6 built, pushed and checked (phone and desktop widths, light and dark; projection math against hand calculations; two-device encrypted sync against a fake gist API: wrong passphrase, merge, passphrase change locking the other device).

## 5. Follow-ups

- CSV import from bank and credit-card exports (with duplicate detection).
- Auto-categorize transactions (rules first, maybe Claude later).
- Goals: a target amount or a FIRE number, and whether I'm on track.
- Budgets per category with a monthly bar.
- Actual return per source from its balances and contributions (money-weighted).
- Tax on gains (25% capital gains on brokerage, the hishtalmut exemption) in the projection.

## 6. Decisions (2026-11-20)

- **Name**: finance-path.
- **Currencies**: ₪ and $. Each source and transaction has its own; totals are shown in the display currency (₪ by default) at the $→₪ rate, which comes from the ECB daily reference rate (frankfurter.dev, no key) unless set by hand.
- **Expenses**: typed in the app (no bank import yet).
- **Sync**: encrypted. A secret gist isn't private (anyone with its URL can read it), so the file in the gist is AES-GCM ciphertext; the key comes from a passphrase (PBKDF2-SHA256, 600,000 rounds) entered once per device. The passphrase is never stored or sent; this device keeps the derived key. Lose the passphrase and the gist can't be read (each device's own copy is unaffected).
- **Backup**: encrypted too (2026-11-23; until then it was plain JSON). Same envelope as the gist: sealed with the sync key on a synced device (opens with the sync passphrase of that day), or with a passphrase chosen for the backup on a device that doesn't sync. There's no plain export any more; old plain backups still import. The copy in the browser's own storage stays unencrypted, as the device keeps the key beside it anyway.
- **Examples**: a few made-up sources, balances, transactions and recurring items, tagged "Example", removable in one go. Editing one makes it mine.
- **Charts**: hand-made SVG (no chart library), colours from the validated categorical palette, one per source in a fixed slot.
