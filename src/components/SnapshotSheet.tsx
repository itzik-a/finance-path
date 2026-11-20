/* Add or edit a source's balance on a date. */
import { useRef, useState, type FormEvent } from "react";
import { todayStr } from "../lib/dates";
import { addSnapshot, deleteSnapshot, editSnapshot } from "../state/actions";
import type { Snapshot, Source } from "../types";
import { AmountInput, Field, Sheet, closeSheet } from "./ui";

export function SnapshotSheet({ source, snapshot, onClose }: { source: Source; snapshot?: Snapshot; onClose: () => void }) {
  const [date, setDate] = useState(snapshot?.date ?? todayStr());
  const [balance, setBalance] = useState<number>(snapshot?.balance ?? NaN);
  const [tried, setTried] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const ok = !Number.isNaN(balance) && balance >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!ok) return;
    if (snapshot) editSnapshot(snapshot.id, (s) => { s.date = date; s.balance = balance; });
    else addSnapshot(source.id, date, balance);
    closeSheet(form.current);
  }

  return (
    <Sheet title={snapshot ? "Edit balance" : `Balance of ${source.name}`} onClose={onClose}>
      <form ref={form} className="form-grid" onSubmit={submit} noValidate>
        <Field label="Balance" id="snap-bal" hint="As shown on the statement or in the app.">
          <AmountInput id="snap-bal" currency={source.currency} value={balance} onChange={setBalance} autoFocus invalid={tried && !ok} />
        </Field>
        <Field label="On" id="snap-date">
          <input id="snap-date" type="date" className="text-input" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {tried && !ok && <p className="form-error" role="alert">Enter the balance as a number.</p>}
        <button type="submit" className="btn primary">{snapshot ? "Save" : "Add balance"}</button>
        {snapshot && (
          <button type="button" className="btn ghost danger" onClick={() => { deleteSnapshot(snapshot.id); closeSheet(form.current); }}>Remove this balance</button>
        )}
      </form>
    </Sheet>
  );
}
