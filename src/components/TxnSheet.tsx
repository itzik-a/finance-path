/* Add or edit a transaction, or a recurring item (same fields plus when it repeats). */
import { useRef, useState, type FormEvent } from "react";
import { MONTHS, todayStr } from "../lib/dates";
import { addRecurring, addTxn, deleteRecurring, deleteTxn, editRecurring, editTxn, liveCategories, liveSources } from "../state/actions";
import { useAppState } from "../state/store";
import type { Currency, Recurring, Txn, TxnKind } from "../types";
import { IconRepeat } from "./Icons";
import { AmountInput, Field, Seg, Select, Sheet, Switch, closeSheet } from "./ui";

export const KIND_LABEL: Record<TxnKind, string> = { expense: "Expense", income: "Income", invest: "Invested" };

interface Draft {
  kind: TxnKind;
  amount: number;
  currency: Currency;
  categoryId: string;
  sourceId?: string;
  note: string;
  date: string;
  repeat: boolean;
  every: "month" | "year";
  end: string;
}

export function TxnSheet({ txn, recurring, newRecurring, defaultKind = "expense", onClose }: {
  txn?: Txn; recurring?: Recurring; newRecurring?: boolean; defaultKind?: TxnKind; onClose: () => void;
}) {
  const s = useAppState();
  const cats = liveCategories(s);
  const sources = liveSources(s);
  const isRec = !!recurring || !!newRecurring;
  const firstCat = (k: TxnKind) => cats.find((c) => c.kind === k)?.id ?? "";
  const [d, setD] = useState<Draft>(() => {
    const src = txn ?? recurring;
    const kind = src?.kind ?? defaultKind;
    return {
      kind, amount: src?.amount ?? NaN, currency: src?.currency ?? s.settings.display, categoryId: src?.categoryId ?? firstCat(kind),
      sourceId: src?.sourceId, note: src?.note ?? "",
      date: txn?.date ?? recurring?.start ?? todayStr(),
      repeat: isRec, every: recurring?.every ?? "month", end: recurring?.end ?? "",
    };
  });
  const [tried, setTried] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const amountOk = d.amount > 0;
  const catsOfKind = cats.filter((c) => c.kind === d.kind);
  // A deleted category still shows on the items that use it.
  const current = s.categories.find((c) => c.id === d.categoryId);
  if (current?.deletedAt && current.kind === d.kind) catsOfKind.push(current);
  const fromRecurring = txn?.recurringId ? s.recurring.find((r) => r.id === txn.recurringId && !r.deletedAt) : undefined;

  function setKind(k: TxnKind) {
    setD((x) => ({ ...x, kind: k, categoryId: cats.find((c) => c.id === x.categoryId)?.kind === k ? x.categoryId : firstCat(k), sourceId: k === "invest" ? x.sourceId : undefined }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!amountOk || !d.date) return;
    const base = { kind: d.kind, amount: d.amount, currency: d.currency, categoryId: d.categoryId, sourceId: d.kind === "invest" ? d.sourceId || undefined : undefined, note: d.note.trim() || undefined };
    const day = Number(d.date.slice(8, 10));
    const when = { every: d.every, day: Math.min(28, day), month: d.every === "year" ? Number(d.date.slice(5, 7)) : undefined, start: d.date, end: d.end || undefined };
    if (recurring) editRecurring(recurring.id, (r) => { Object.assign(r, base, when); if (!base.sourceId) delete r.sourceId; if (!when.end) delete r.end; if (!base.note) delete r.note; });
    else if (txn) editTxn(txn.id, (t) => { Object.assign(t, base, { date: d.date }); if (!base.sourceId) delete t.sourceId; if (!base.note) delete t.note; });
    else if (d.repeat) addRecurring({ ...base, ...when });
    else addTxn({ ...base, date: d.date });
    closeSheet(form.current);
  }

  const title = recurring ? "Edit recurring" : newRecurring ? "New recurring" : txn ? `Edit ${KIND_LABEL[d.kind].toLowerCase()}` : "Add";
  const dayNote = Number(d.date.slice(8, 10)) > 28 ? " (on the 28th, so every month has it)" : "";

  return (
    <Sheet title={title} onClose={onClose}>
      <form ref={form} className="form-grid" onSubmit={submit} noValidate>
        <Seg<TxnKind> className="full" label="Kind" value={d.kind} onChange={setKind}
          options={[{ id: "expense", label: "Expense" }, { id: "income", label: "Income" }, { id: "invest", label: "Invested" }]} />
        <div className="form-row amount-row">
          <Field label="Amount" id="tx-amount">
            <AmountInput id="tx-amount" currency={d.currency} value={d.amount} onChange={(v) => set("amount", v)} autoFocus={!txn && !recurring} invalid={tried && !amountOk} />
          </Field>
          <div className="field">
            <span className="field-label">Currency</span>
            <Seg<Currency> className="full" label="Currency" value={d.currency} onChange={(c) => set("currency", c)} options={[{ id: "ILS", label: "₪" }, { id: "USD", label: "$" }]} />
          </div>
        </div>

        <div className="field">
          <span className="field-label">Category</span>
          <div className="chips cat-chips" role="group" aria-label="Category">
            {catsOfKind.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={d.categoryId === c.id} onClick={() => set("categoryId", c.id)}>
                <span aria-hidden="true">{c.emoji}</span> {c.name}
              </button>
            ))}
          </div>
        </div>

        {d.kind === "invest" && sources.length > 0 && (
          <Field label="Into" id="tx-src" hint="Which investment the money went to. Optional; add the new balance on its page.">
            <Select id="tx-src" value={d.sourceId ?? ""} onChange={(v) => set("sourceId", v || undefined)}
              options={[{ id: "", label: "Not linked" }, ...sources.map((x) => ({ id: x.id, label: x.name }))]} />
          </Field>
        )}

        <Field label="Note" id="tx-note">
          <input id="tx-note" className="text-input" value={d.note} placeholder={d.kind === "income" ? "e.g. Salary" : "e.g. Supermarket"} onChange={(e) => set("note", e.target.value)} dir="auto" />
        </Field>

        <Field label={d.repeat ? "Starting" : "Date"} id="tx-date">
          <input id="tx-date" type="date" className="text-input" value={d.date} onChange={(e) => set("date", e.target.value)} />
        </Field>

        {!txn && !isRec && (
          <label className="switch-row">
            <Switch on={d.repeat} onChange={(on) => set("repeat", on)} label="Repeats" />
            <span>Repeats</span>
          </label>
        )}
        {d.repeat && (
          <>
            <Seg<"month" | "year"> className="full" label="How often" value={d.every} onChange={(v) => set("every", v)}
              options={[{ id: "month", label: "Every month" }, { id: "year", label: "Every year" }]} />
            <p className="muted small">
              {d.every === "month"
                ? `On day ${Math.min(28, Number(d.date.slice(8, 10)) || 1)} of every month${dayNote}.`
                : `Every ${Math.min(28, Number(d.date.slice(8, 10)) || 1)} ${MONTHS[Number(d.date.slice(5, 7)) - 1] ?? ""}.`}
              {" "}Each one is added on its day, from the start date on.
            </p>
            <Field label="Until" id="tx-end" hint="Optional.">
              <input id="tx-end" type="date" className="text-input" value={d.end} min={d.date} onChange={(e) => set("end", e.target.value)} />
            </Field>
          </>
        )}

        {tried && !amountOk && <p className="form-error" role="alert">Enter an amount above zero.</p>}
        <button type="submit" className="btn primary">{txn || recurring ? "Save" : d.repeat ? "Add recurring" : `Add ${KIND_LABEL[d.kind].toLowerCase()}`}</button>
        {fromRecurring && (
          <p className="muted small rec-note"><IconRepeat /> Added by a recurring item. Changes here apply to this one only; change the recurring item in Cash flow → Recurring.</p>
        )}
        {recurring && <p className="muted small">Changes apply from the next one on; ones already added stay as they are.</p>}
        {(txn || recurring) && (
          <button type="button" className="btn ghost danger" onClick={() => { if (txn) deleteTxn(txn.id); else deleteRecurring(recurring!.id); closeSheet(form.current); }}>
            {txn ? "Remove" : "Stop and remove (keeps ones already added)"}
          </button>
        )}
      </form>
    </Sheet>
  );
}
