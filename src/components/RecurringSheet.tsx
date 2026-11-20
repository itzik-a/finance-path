/* The recurring items: list, add, open one to edit. */
import { useState } from "react";
import { MONTHS, shortDate, todayStr } from "../lib/dates";
import { convert, fmt } from "../lib/money";
import { liveCategories, liveRecurring } from "../state/actions";
import { useAppState } from "../state/store";
import type { Recurring } from "../types";
import { IconPlus } from "./Icons";
import { KIND_LABEL, TxnSheet } from "./TxnSheet";
import { Sheet } from "./ui";

export function RecurringSheet({ onClose }: { onClose: () => void }) {
  const s = useAppState();
  const [open, setOpen] = useState<Recurring | "new" | null>(null);
  const items = liveRecurring(s);
  const cats = liveCategories(s);
  const today = todayStr();
  const active = items.filter((r) => !r.end || r.end >= today);
  const ended = items.filter((r) => r.end && r.end < today);
  const monthly = (r: Recurring) => convert(r.amount, r.currency, s.settings.display, s.settings) / (r.every === "year" ? 12 : 1);
  const net = active.reduce((a, r) => a + (r.kind === "income" ? 1 : -1) * monthly(r), 0);

  const row = (r: Recurring) => {
    const c = s.categories.find((x) => x.id === r.categoryId);
    return (
      <li key={r.id}>
        <button type="button" className="txn-row" onClick={() => setOpen(r)}>
          <span className="txn-emoji" aria-hidden="true">{c?.emoji ?? "•"}</span>
          <span className="txn-main">
            <span className="txn-title" dir="auto">{r.note || c?.name || KIND_LABEL[r.kind]}{r.example && <span className="tag">Example</span>}</span>
            <span className="muted small">
              {r.every === "month" ? `Every month on the ${r.day}${ordinal(r.day)}` : `Every year on ${r.day} ${MONTHS[(r.month ?? 1) - 1]}`}
              {r.end ? ` · until ${shortDate(r.end)}` : ""}
            </span>
          </span>
          <span className={`txn-amt ${r.kind}`}>{r.kind === "income" ? "+" : r.kind === "expense" ? "−" : ""}{fmt(r.amount, r.currency, { cents: r.amount % 1 !== 0 })}</span>
        </button>
      </li>
    );
  };

  return (
    <Sheet title="Recurring" onClose={onClose}>
      <p className="muted small">Salary, rent, subscriptions: each one adds itself on its day. {active.length > 0 && <>Together about <b className={net >= 0 ? "pos" : "neg"}>{fmt(net, s.settings.display, { sign: true })}</b> a month.</>}</p>
      <button type="button" className="btn primary" onClick={() => setOpen("new")} disabled={!cats.length}><IconPlus /> New recurring</button>
      {active.length > 0 && <ul className="txn-list">{active.map(row)}</ul>}
      {ended.length > 0 && (
        <>
          <h3 className="form-h">Ended</h3>
          <ul className="txn-list">{ended.map(row)}</ul>
        </>
      )}
      {open && <TxnSheet recurring={open === "new" ? undefined : open} newRecurring={open === "new"} onClose={() => setOpen(null)} />}
    </Sheet>
  );
}

const ordinal = (n: number) => (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
