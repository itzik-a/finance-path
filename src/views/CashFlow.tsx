/* Cash flow (#cashflow): a month's income, expenses and money invested; transactions by day or by category;
   the last 12 months; search across everything; recurring items and categories. */
import { useMemo, useState } from "react";
import { BarChart } from "../components/BarChart";
import { CategoriesSheet } from "../components/CategoriesSheet";
import { ExamplesNote } from "../components/ExamplesNote";
import { IconBack, IconClose, IconNext, IconPlus, IconRepeat, IconSearch } from "../components/Icons";
import { RecurringSheet } from "../components/RecurringSheet";
import { KIND_LABEL, TxnSheet } from "../components/TxnSheet";
import { Seg, useSessionState } from "../components/ui";
import { addMonths, dayLabel, monthLabel, thisMonth } from "../lib/dates";
import { byCategory, monthSum } from "../lib/finance";
import { convert, fmt } from "../lib/money";
import { liveRecurring, liveTxns } from "../state/actions";
import { useAppState, type AppState } from "../state/store";
import type { Txn, TxnKind } from "../types";

export const FLOW_COLOR: Record<TxnKind, string> = { income: "var(--s1)", expense: "var(--s2)", invest: "var(--s3)" };

export function CashFlow() {
  const s = useAppState();
  const now = thisMonth();
  const [month, setMonth] = useSessionState("financePath.month", now);
  const [tab, setTab] = useSessionState<"days" | "categories">("financePath.flowTab", "days");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Txn | "new" | null>(null);
  const [sheet, setSheet] = useState<"recurring" | "categories" | null>(null);
  // Forward as far as the last payment already scheduled (a purchase in payments), else up to this month.
  const lastMonth = liveTxns(s).reduce((m, t) => (t.date.slice(0, 7) > m ? t.date.slice(0, 7) : m), now);
  const ym = month > lastMonth ? lastMonth : month;
  const D = s.settings.display;
  const sum = monthSum(s, ym);
  const query = q.trim().toLowerCase();

  return (
    <>
      <header className="page-head row-head">
        <div><h1 className="display">Cash flow</h1></div>
        <button type="button" className="btn primary sm" onClick={() => setOpen("new")}><IconPlus /> Add</button>
      </header>
      <ExamplesNote />

      <div className="search">
        <IconSearch />
        <input type="search" placeholder="Search all transactions" aria-label="Search all transactions" value={q} onChange={(e) => setQ(e.target.value)} dir="auto" />
        {q && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQ("")}><IconClose /></button>}
      </div>

      {query ? <SearchResults s={s} query={query} onOpen={setOpen} /> : (
        <>
          <section className="card month-card" aria-labelledby="month-title">
            <div className="month-nav">
              <button type="button" className="icon-btn subtle" aria-label="Previous month" onClick={() => setMonth(addMonths(ym, -1))}><IconBack /></button>
              <h2 id="month-title">{monthLabel(ym)}</h2>
              <button type="button" className="icon-btn subtle" aria-label="Next month" disabled={ym >= lastMonth} onClick={() => setMonth(addMonths(ym, 1))}><IconNext /></button>
            </div>
            <dl className="sum-grid">
              <div><dt><i className="key-rect" style={{ background: FLOW_COLOR.income }} />Income</dt><dd>{fmt(sum.income, D)}</dd></div>
              <div><dt><i className="key-rect" style={{ background: FLOW_COLOR.expense }} />Expenses</dt><dd>{fmt(sum.expense, D)}</dd></div>
              <div><dt><i className="key-rect" style={{ background: FLOW_COLOR.invest }} />Invested</dt><dd>{fmt(sum.invest, D)}</dd></div>
              <div><dt>Left over</dt><dd className={sum.net >= 0 ? "pos" : "neg"}>{fmt(sum.net, D, { sign: true })}</dd></div>
            </dl>
            {sum.rate != null && (
              <p className="muted small">
                Saved <b className={sum.rate >= 0 ? "pos" : "neg"}>{Math.round(sum.rate * 100)}%</b> of income
                {sum.invest > 0 ? `, ${Math.round((sum.invest / sum.income) * 100)}% of it invested` : ""}.
              </p>
            )}
          </section>

          <Trend s={s} ym={ym} onPick={setMonth} />

          <div className="row-between">
            <Seg label="Show" value={tab} onChange={setTab} options={[{ id: "days", label: "By day" }, { id: "categories", label: "By category" }]} />
          </div>
          {tab === "days" ? <Days s={s} ym={ym} onOpen={setOpen} onAdd={() => setOpen("new")} /> : <Categories s={s} ym={ym} />}
        </>
      )}

      <div className="flow-links">
        <button type="button" className="btn ghost" onClick={() => setSheet("recurring")}><IconRepeat /> Recurring ({liveRecurring(s).length})</button>
        <button type="button" className="btn ghost" onClick={() => setSheet("categories")}>Categories</button>
      </div>

      {open && <TxnSheet txn={open === "new" ? undefined : open} onClose={() => setOpen(null)} />}
      {sheet === "recurring" && <RecurringSheet onClose={() => setSheet(null)} />}
      {sheet === "categories" && <CategoriesSheet onClose={() => setSheet(null)} />}
    </>
  );
}

function Trend({ s, ym, onPick }: { s: AppState; ym: string; onPick: (ym: string) => void }) {
  const D = s.settings.display;
  const now = thisMonth();
  // 12 months ending at the picked month (or later, up to this month, so the picked one isn't always last).
  const cap = ym > now ? ym : now;
  const last = addMonths(ym, 3) > cap ? cap : addMonths(ym, 3);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(last, i - 11));
  const sums = months.map((m) => monthSum(s, m));
  if (!sums.some((x) => x.income || x.expense || x.invest)) return null;
  const kinds: TxnKind[] = ["income", "expense", "invest"];
  const shown = kinds.filter((k) => sums.some((x) => x[k] > 0));
  return (
    <section className="card" aria-labelledby="trend-title">
      <h2 id="trend-title">Last 12 months</h2>
      <BarChart
        title="Income, expenses and invested by month"
        labels={months.map((m) => monthLabel(m, true).slice(0, 3))}
        tipLabels={months.map((m) => monthLabel(m))}
        series={shown.map((k) => ({ id: k, label: KIND_LABEL[k] === "Expense" ? "Expenses" : KIND_LABEL[k], color: FLOW_COLOR[k], values: sums.map((x) => x[k]) }))}
        format={(v) => fmt(v, D)} tick={(v) => fmt(v, D, { compact: true })}
        current={months.indexOf(ym)} onPick={(i) => onPick(months[i])}
      />
    </section>
  );
}

function TxnRow({ s, t, onOpen, showDate }: { s: AppState; t: Txn; onOpen: (t: Txn) => void; showDate?: boolean }) {
  const c = s.categories.find((x) => x.id === t.categoryId);
  const into = t.sourceId ? s.sources.find((x) => x.id === t.sourceId) : undefined;
  return (
    <li>
      <button type="button" className="txn-row" onClick={() => onOpen(t)}>
        <span className="txn-emoji" aria-hidden="true">{c?.emoji ?? "•"}</span>
        <span className="txn-main">
          <span className="txn-title" dir="auto">{t.note || c?.name || KIND_LABEL[t.kind]}</span>
          <span className="muted small">
            {t.recurringId && <IconRepeat aria-label="Recurring" />}
            {showDate ? `${dayLabel(t.date)} · ` : ""}{t.plan ? `Payment ${t.plan.part}/${t.plan.parts} · ` : ""}{c?.name ?? "No category"}{into ? ` → ${into.name}` : ""}
          </span>
        </span>
        <span className={`txn-amt ${t.kind}`}>{t.kind === "income" ? "+" : t.kind === "expense" ? "−" : ""}{fmt(t.amount, t.currency, { cents: t.amount % 1 !== 0 })}</span>
      </button>
    </li>
  );
}

const byDateDesc = (a: Txn, b: Txn) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt - a.updatedAt);

function Days({ s, ym, onOpen, onAdd }: { s: AppState; ym: string; onOpen: (t: Txn) => void; onAdd: () => void }) {
  const txns = useMemo(() => liveTxns(s).filter((t) => t.date.startsWith(ym)).sort(byDateDesc), [s, ym]);
  if (!txns.length) {
    return (
      <section className="card empty">
        <p className="muted">Nothing in {monthLabel(ym)} yet.</p>
        <button type="button" className="btn primary" onClick={onAdd}><IconPlus /> Add a transaction</button>
      </section>
    );
  }
  const days: { date: string; items: Txn[] }[] = [];
  for (const t of txns) {
    if (days[days.length - 1]?.date !== t.date) days.push({ date: t.date, items: [] });
    days[days.length - 1].items.push(t);
  }
  return (
    <div className="days">
      {days.map((d) => (
        <section key={d.date} className="day" aria-label={dayLabel(d.date)}>
          <h3 className="day-head">{dayLabel(d.date)}</h3>
          <ul className="card txn-list">{d.items.map((t) => <TxnRow key={t.id} s={s} t={t} onOpen={onOpen} />)}</ul>
        </section>
      ))}
    </div>
  );
}

function Categories({ s, ym }: { s: AppState; ym: string }) {
  const D = s.settings.display;
  const groups: { kind: TxnKind; title: string }[] = [{ kind: "expense", title: "Expenses" }, { kind: "income", title: "Income" }, { kind: "invest", title: "Invested" }];
  const any = groups.some((g) => byCategory(s, ym, g.kind).length);
  if (!any) return <section className="card empty"><p className="muted">Nothing in {monthLabel(ym)} yet.</p></section>;
  return (
    <>
      {groups.map(({ kind, title }) => {
        const rows = byCategory(s, ym, kind);
        if (!rows.length) return null;
        const total = rows.reduce((a, r) => a + r.total, 0);
        const max = rows[0].total;
        return (
          <section key={kind} className="card" aria-labelledby={`cat-${kind}`}>
            <div className="card-head"><h2 id={`cat-${kind}`}>{title}</h2><b className="small">{fmt(total, D)}</b></div>
            <ul className="cat-bars">
              {rows.map((r) => {
                const c = s.categories.find((x) => x.id === r.categoryId);
                return (
                  <li key={r.categoryId}>
                    <div className="cat-bar-head">
                      <span><span aria-hidden="true">{c?.emoji ?? "•"}</span> {c?.name ?? "No category"} <span className="muted small">· {r.count}</span></span>
                      <span><b>{fmt(r.total, D)}</b> <span className="muted small">{Math.round((r.total / total) * 100)}%</span></span>
                    </div>
                    <div className="cat-bar-track"><div className="cat-bar" style={{ width: `${Math.max(1.5, (r.total / max) * 100)}%`, background: FLOW_COLOR[kind] }} /></div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function SearchResults({ s, query, onOpen }: { s: AppState; query: string; onOpen: (t: Txn) => void }) {
  const D = s.settings.display;
  const hits = useMemo(() => liveTxns(s).filter((t) => {
    const c = s.categories.find((x) => x.id === t.categoryId);
    return `${t.note ?? ""} ${c?.name ?? ""} ${t.amount}`.toLowerCase().includes(query);
  }).sort(byDateDesc), [s, query]);
  const tot = (k: TxnKind) => hits.filter((t) => t.kind === k).reduce((a, t) => a + convert(t.amount, t.currency, D, s.settings), 0);
  if (!hits.length) return <section className="card empty"><p className="muted">No transactions match “{query}”.</p></section>;
  return (
    <section className="card" aria-label="Search results">
      <p className="muted small">
        {hits.length} {hits.length === 1 ? "match" : "matches"}
        {tot("expense") ? ` · ${fmt(tot("expense"), D)} spent` : ""}{tot("income") ? ` · ${fmt(tot("income"), D)} in` : ""}{tot("invest") ? ` · ${fmt(tot("invest"), D)} invested` : ""}
      </p>
      <ul className="txn-list">{hits.slice(0, 300).map((t) => <TxnRow key={t.id} s={s} t={t} onOpen={onOpen} showDate />)}</ul>
    </section>
  );
}
