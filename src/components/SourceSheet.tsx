/* Add or edit an investment source. */
import { useRef, useState, type FormEvent } from "react";
import { KINDS } from "../lib/finance";
import { SYMBOL } from "../lib/money";
import { addSource, editSource, type SourceInput } from "../state/actions";
import type { Currency, Source, SourceKind } from "../types";
import { AmountInput, Field, PercentInput, Seg, Select, Sheet, closeSheet } from "./ui";

const blank = (): SourceInput => ({
  name: "", kind: "brokerage", currency: "ILS", returnPct: 7, feeBalancePct: 0, feeDepositPct: 0, monthly: 0, raisePct: 0,
});

export function SourceSheet({ source, onClose, onSaved }: { source?: Source; onClose: () => void; onSaved?: (id: string) => void }) {
  const [f, setF] = useState<SourceInput>(() => (source ? { ...source } : blank()));
  const [balance, setBalance] = useState<number>(NaN);
  const [returnTouched, setReturnTouched] = useState(!!source);
  const [tried, setTried] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const set = <K extends keyof SourceInput>(k: K, v: SourceInput[K]) => setF((x) => ({ ...x, [k]: v }));

  const nameOk = f.name.trim().length > 0;
  const monthlyOk = !Number.isNaN(f.monthly) && f.monthly >= 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!nameOk || !monthlyOk) return;
    const clean: SourceInput = { ...f, name: f.name.trim(), note: f.note?.trim() || undefined, contribUntil: f.contribUntil || undefined };
    let id = source?.id;
    if (source) editSource(source.id, (s) => Object.assign(s, clean, { contribUntil: clean.contribUntil, note: clean.note }));
    else id = addSource(clean, Number.isNaN(balance) ? undefined : balance);
    onSaved?.(id!);
    closeSheet(form.current);
  }

  function setKind(k: SourceKind) {
    setF((x) => ({ ...x, kind: k, ...(returnTouched ? {} : { returnPct: KINDS.find((d) => d.id === k)!.returnPct }) }));
  }

  return (
    <Sheet title={source ? `Edit ${source.name}` : "New investment"} onClose={onClose}>
      <form ref={form} className="form-grid" onSubmit={submit} noValidate>
        <Field label="Name" id="src-name">
          <input id="src-name" className="text-input" value={f.name} autoFocus={!source} placeholder="e.g. Pension fund (Migdal)"
            aria-invalid={tried && !nameOk || undefined} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <div className="form-row">
          <Field label="Kind" id="src-kind">
            <Select id="src-kind" value={f.kind} onChange={setKind} options={KINDS.map((k) => ({ id: k.id, label: k.label }))} />
          </Field>
          <div className="field">
            <span className="field-label">Currency</span>
            <Seg<Currency> className="full" label="Currency" value={f.currency} onChange={(c) => set("currency", c)} options={[{ id: "ILS", label: "₪ ILS" }, { id: "USD", label: "$ USD" }]} />
          </div>
        </div>
        {!source && (
          <Field label="Balance today" id="src-balance" hint="Optional. You can add balances from statements later, with their dates.">
            <AmountInput id="src-balance" currency={f.currency} value={balance} onChange={setBalance} />
          </Field>
        )}

        <h3 className="form-h">Growth</h3>
        <div className="form-row">
          <Field label="Expected return / year" id="src-ret" hint="Before fees.">
            <PercentInput id="src-ret" value={f.returnPct} onChange={(v) => { setReturnTouched(true); set("returnPct", v); }} />
          </Field>
          <Field label="Fee on balance / year" id="src-feeb" hint="דמי ניהול מצבירה">
            <PercentInput id="src-feeb" value={f.feeBalancePct} onChange={(v) => set("feeBalancePct", v)} />
          </Field>
        </div>

        <h3 className="form-h">Contributions</h3>
        <div className="form-row">
          <Field label="Monthly" id="src-monthly">
            <AmountInput id="src-monthly" currency={f.currency} value={f.monthly} invalid={tried && !monthlyOk} onChange={(v) => set("monthly", Number.isNaN(v) ? 0 : v)} />
          </Field>
          <Field label="Fee on deposits" id="src-feed" hint="דמי ניהול מהפקדה">
            <PercentInput id="src-feed" value={f.feeDepositPct} onChange={(v) => set("feeDepositPct", v)} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Yearly raise" id="src-raise" hint="How much the monthly amount grows each year.">
            <PercentInput id="src-raise" value={f.raisePct} onChange={(v) => set("raisePct", v)} />
          </Field>
          <Field label="Last month" id="src-until" hint="Optional, e.g. retirement.">
            <input id="src-until" type="month" className="text-input" value={f.contribUntil ?? ""} onChange={(e) => set("contribUntil", e.target.value || undefined)} />
          </Field>
        </div>
        <Field label="Note" id="src-note">
          <textarea id="src-note" className="text-input" rows={2} value={f.note ?? ""} placeholder="Account number, track, anything" onChange={(e) => set("note", e.target.value)} />
        </Field>
        {tried && !nameOk && <p className="form-error" role="alert">Give it a name.</p>}
        <button type="submit" className="btn primary">{source ? "Save" : `Add ${f.currency === "USD" ? SYMBOL.USD : SYMBOL.ILS} investment`}</button>
      </form>
    </Sheet>
  );
}
