/* Add or edit a loan (Shpitzer): fixed rate or prime + margin. Shows the monthly payment, the interest in all and the
   last payment as you type. A prime loan needs the prime rate; the first prime loan asks for it here, later changes
   are made on a loan's page (they apply to every prime loan). */
import { useRef, useState, type FormEvent } from "react";
import { addMonths, monthLabel, monthOf, thisMonth, todayStr } from "../lib/dates";
import { latestPrime, primeAt, schedule } from "../lib/loan";
import { fmt, pct } from "../lib/money";
import { addLoan, deleteLoanBalance, deletePrime, editLoan, liveCategories, setLoanBalance, setPrime, type LoanInput } from "../state/actions";
import { useAppState } from "../state/store";
import type { Currency, Loan, PrimeRate } from "../types";
import { AmountInput, Field, PercentInput, Seg, Select, Sheet, Switch, closeSheet } from "./ui";

export function LoanSheet({ loan, onClose, onSaved }: { loan?: Loan; onClose: () => void; onSaved?: (id: string) => void }) {
  const s = useAppState();
  const expenseCats = liveCategories(s).filter((c) => c.kind === "expense");
  const defaultCat = expenseCats.find((c) => c.id === "c-loan")?.id ?? expenseCats[0]?.id ?? "";
  const [f, setF] = useState(() => ({
    name: loan?.name ?? "",
    currency: loan?.currency ?? s.settings.display,
    principal: loan?.principal ?? NaN,
    first: loan?.first ?? `${addMonths(thisMonth(), 1)}-01`,
    months: loan?.months ?? 240,
    rate: loan?.rate ?? ("prime" as Loan["rate"]),
    ratePct: loan ? Math.abs(loan.ratePct) : NaN, // empty box for a new loan
    below: (loan?.ratePct ?? 0) < 0,
    categoryId: loan?.categoryId ?? defaultCat,
    addPast: loan ? loan.addFrom <= monthOf(loan.first) : false,
    note: loan?.note ?? "",
  }));
  const [monthsText, setMonthsText] = useState(String(f.months));
  const [primeNow, setPrimeNow] = useState(NaN);
  const [tried, setTried] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const knownPrime = s.settings.prime?.length ? s.settings.prime : undefined;
  const prime = knownPrime ?? (primeNow >= 0 ? [{ from: thisMonth(), pct: primeNow }] : undefined);
  const rateNum = Number.isNaN(f.ratePct) ? 0 : f.ratePct;
  const margin = f.below ? -rateNum : rateNum;
  const primeOk = f.rate === "fixed" || !!prime;
  const ok = f.principal > 0 && f.months >= 1 && !!f.first && primeOk;
  const rows = ok ? schedule({ principal: f.principal, first: f.first, months: f.months, rate: f.rate, ratePct: f.rate === "prime" ? margin : rateNum, balances: loan?.balances }, prime) : [];
  const nowPrime = primeAt(prime, thisMonth());
  const past = monthOf(f.first) < thisMonth();
  const money = (v: number) => fmt(v, f.currency, { cents: v % 1 !== 0 });

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!ok) return;
    // the first prime rate known covers the months before it too; date it from the loan's start when that's earlier
    if (f.rate === "prime" && !knownPrime) setPrime(monthOf(f.first) < thisMonth() ? monthOf(f.first) : thisMonth(), primeNow);
    const input: LoanInput = {
      name: f.name.trim() || "Loan", currency: f.currency, principal: f.principal, first: f.first, months: f.months,
      rate: f.rate, ratePct: f.rate === "prime" ? margin : rateNum, categoryId: f.categoryId,
      addFrom: f.addPast || !past ? monthOf(f.first) : thisMonth(), note: f.note.trim() || undefined,
    };
    let id = loan?.id;
    if (loan) editLoan(loan.id, (l) => { Object.assign(l, input); if (!input.note) delete l.note; });
    else id = addLoan(input);
    onSaved?.(id!);
    closeSheet(form.current);
  }

  const years = f.months / 12;
  return (
    <Sheet title={loan ? `Edit ${loan.name}` : "New loan"} onClose={onClose}>
      <form ref={form} className="form-grid" onSubmit={submit} noValidate>
        <Field label="Name" id="ln-name">
          <input id="ln-name" className="text-input" value={f.name} data-autofocus={!loan || undefined} placeholder="e.g. Mortgage, prime track" onChange={(e) => set("name", e.target.value)} dir="auto" />
        </Field>
        <div className="form-row amount-row">
          <Field label="Amount borrowed" id="ln-amount">
            <AmountInput id="ln-amount" currency={f.currency} value={f.principal} onChange={(v) => set("principal", v)} invalid={tried && !(f.principal > 0)} />
          </Field>
          <div className="field">
            <span className="field-label">Currency</span>
            <Seg<Currency> className="full" label="Currency" value={f.currency} onChange={(c) => set("currency", c)} options={[{ id: "ILS", label: "₪" }, { id: "USD", label: "$" }]} />
          </div>
        </div>

        <h3 className="form-h">Interest</h3>
        <Seg<Loan["rate"]> className="full" label="Rate" value={f.rate} onChange={(v) => set("rate", v)}
          options={[{ id: "prime", label: "Prime + margin" }, { id: "fixed", label: "Fixed" }]} />
        {f.rate === "fixed" ? (
          <Field label="Yearly rate" id="ln-rate">
            <PercentInput id="ln-rate" value={f.ratePct} onChange={(v) => set("ratePct", Math.abs(v))} />
          </Field>
        ) : (
          <>
            <div className="form-row">
              <div className="field">
                <span className="field-label">Prime</span>
                <Seg<"above" | "below"> className="full" label="Above or below prime" value={f.below ? "below" : "above"} onChange={(v) => set("below", v === "below")}
                  options={[{ id: "above", label: "+ above" }, { id: "below", label: "− below" }]} />
              </div>
              <Field label="Margin" id="ln-margin">
                <PercentInput id="ln-margin" value={f.ratePct} onChange={(v) => set("ratePct", Math.abs(v))} />
              </Field>
            </div>
            {knownPrime ? (
              <p className="muted small">Prime is {pct(nowPrime ?? 0, 2)} now, so this loan is at {pct((nowPrime ?? 0) + margin, 2)}. When prime changes, change it on a loan's page; every prime loan follows.</p>
            ) : (
              <Field label="Prime rate now" id="ln-prime" hint="From your bank or the Bank of Israel. Changes later are made on the loan's page.">
                <PercentInput id="ln-prime" value={primeNow} onChange={setPrimeNow} />
              </Field>
            )}
          </>
        )}

        <h3 className="form-h">Payments</h3>
        <div className="form-row">
          <Field label="Number of payments" id="ln-months" hint={f.months >= 12 ? `${Number.isInteger(years) ? years : years.toFixed(1)} years` : "months"}>
            <input id="ln-months" className="text-input parts-input" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={monthsText}
              onChange={(e) => {
                const n = Math.min(600, Number(e.target.value.replace(/\D/g, "").slice(0, 3)) || 0);
                setMonthsText(n ? String(n) : "");
                set("months", n);
              }} />
          </Field>
          <Field label="First payment" id="ln-first">
            <input id="ln-first" type="date" className="text-input" value={f.first} onChange={(e) => set("first", e.target.value)} />
          </Field>
        </div>
        {past && (
          <label className="switch-row">
            <Switch on={f.addPast} onChange={(on) => set("addPast", on)} label="Add earlier payments to Cash flow" />
            <span>Add the payments before {monthLabel(thisMonth())} to Cash flow</span>
          </label>
        )}
        <Field label="Category" id="ln-cat" hint="The payments are added to Cash flow on their day, as this kind of expense.">
          <Select id="ln-cat" value={f.categoryId} onChange={(v) => set("categoryId", v)} options={expenseCats.map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` }))} />
        </Field>

        {rows.length > 0 && (
          <div className="card note-card loan-preview" role="status">
            <div>
              <b>{money(rows.find((r) => r.date > todayStr())?.payment ?? rows[0].payment)}</b> a month
              <span className="muted small"> · {money(rows.reduce((a, r) => a + r.interest, 0))} interest in all · last payment {monthLabel(rows[rows.length - 1].month, true)}</span>
            </div>
            {f.rate === "prime" && <p className="muted small">Assuming prime stays at {pct(latestPrime(prime) ?? 0, 2)}.</p>}
          </div>
        )}

        <Field label="Note" id="ln-note">
          <textarea id="ln-note" className="text-input" rows={2} value={f.note} placeholder="Bank, track, anything" onChange={(e) => set("note", e.target.value)} dir="auto" />
        </Field>
        {tried && !ok && <p className="form-error" role="alert">{!(f.principal > 0) ? "Enter the amount borrowed." : !(f.months >= 1) ? "Enter the number of payments." : !primeOk ? "Enter the prime rate now." : "Pick the first payment's date."}</p>}
        <button type="submit" className="btn primary">{loan ? "Save" : "Add loan"}</button>
      </form>
    </Sheet>
  );
}

/** Prime changed: the new rate from a month on. Lists the known changes, each removable (the last one stays). */
export function PrimeSheet({ onClose }: { onClose: () => void }) {
  const s = useAppState();
  const history: PrimeRate[] = [...(s.settings.prime ?? [])].sort((a, b) => (a.from < b.from ? 1 : -1));
  const [rate, setRate] = useState(NaN);
  const [from, setFrom] = useState(thisMonth());
  const [tried, setTried] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const ok = rate >= 0 && !!from;
  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!ok) return;
    setPrime(from, rate);
    closeSheet(form.current);
  }
  return (
    <Sheet title="Prime rate" onClose={onClose}>
      <form ref={form} className="form-grid" onSubmit={submit} noValidate>
        <p className="muted small">When the Bank of Israel moves its rate, prime moves with it. Every prime loan's payment is worked out again from that month, from what's left and the payments still to go.</p>
        <div className="form-row">
          <Field label="New prime rate" id="pr-rate">
            <PercentInput id="pr-rate" value={rate} onChange={setRate} />
          </Field>
          <Field label="From" id="pr-from">
            <input id="pr-from" type="month" className="text-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
        </div>
        {tried && !ok && <p className="form-error" role="alert">Enter the new rate.</p>}
        <button type="submit" className="btn primary">Save</button>
        {history.length > 0 && (
          <>
            <h3 className="form-h">Changes</h3>
            <ul className="snap-list">
              {history.map((p, i) => (
                <li key={p.from} className="snap-row">
                  <span>From {monthLabel(p.from, true)}{i === history.length - 1 ? " (and before)" : ""}</span>
                  <span className="snap-amt">
                    <b>{pct(p.pct, 2)}</b>
                    {history.length > 1 && <button type="button" className="btn ghost sm danger" onClick={() => deletePrime(p.from)}>Remove</button>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </form>
    </Sheet>
  );
}

/** A balance from a statement: what was left after a month's payment; the schedule continues from it. */
export function LoanBalanceSheet({ loan, month: editing, onClose }: { loan: Loan; month?: string; onClose: () => void }) {
  const today = todayStr();
  const rows = schedule(loan, useAppState().settings.prime);
  const lastPaid = [...rows].reverse().find((r) => r.date <= today)?.month ?? monthOf(loan.first);
  const existing = editing ? loan.balances?.find((b) => b.month === editing) : undefined;
  const [month, setMonth] = useState(editing ?? lastPaid);
  const [balance, setBalance] = useState(existing?.balance ?? NaN);
  const [tried, setTried] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const inRange = month >= monthOf(loan.first) && month <= addMonths(monthOf(loan.first), loan.months - 1);
  const ok = balance >= 0 && inRange;
  const computed = rows.find((r) => r.month === month)?.balance;
  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!ok) return;
    if (editing && editing !== month) deleteLoanBalance(loan.id, editing);
    setLoanBalance(loan.id, month, balance);
    closeSheet(form.current);
  }
  return (
    <Sheet title={editing ? "Edit balance" : "Balance from a statement"} onClose={onClose}>
      <form ref={form} className="form-grid" onSubmit={submit} noValidate>
        <p className="muted small">What the bank says is left after a month's payment. The payments from then on are worked out from it, which keeps the forecast true when the real numbers drift (rounding, fees, an early repayment).</p>
        <div className="form-row">
          <Field label="After the payment of" id="lb-month">
            <input id="lb-month" type="month" className="text-input" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          <Field label="Balance left" id="lb-bal" hint={computed != null && !existing ? `Worked out: ${fmt(computed, loan.currency)}` : undefined}>
            <AmountInput id="lb-bal" currency={loan.currency} value={balance} onChange={setBalance} autoFocus />
          </Field>
        </div>
        {tried && !ok && <p className="form-error" role="alert">{!inRange ? "Pick a month with a payment of this loan." : "Enter the balance."}</p>}
        <button type="submit" className="btn primary">Save</button>
        {existing && <button type="button" className="btn ghost danger" onClick={() => { deleteLoanBalance(loan.id, existing.month); closeSheet(form.current); }}>Remove this balance</button>}
      </form>
    </Sheet>
  );
}
