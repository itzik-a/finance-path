/* "Data & settings": encrypted sync, backup, currency and projection settings, examples. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { exportBackup, importBackup, readBackup } from "../lib/backup";
import { ago } from "../lib/dates";
import { refreshRate } from "../lib/fx";
import { parseAmount } from "../lib/money";
import { hasExamples, removeExamples, setRate, setSettings } from "../state/actions";
import { getState, useAppState } from "../state/store";
import { TOKEN_URL, changePassphrase, disconnect, hasGist, probe, syncNow, unlock, useSyncStatus, type SyncStatus } from "../state/sync";
import type { Currency } from "../types";
import { IconExternal, IconLock } from "./Icons";
import { Seg, Sheet, Stepper, Switch } from "./ui";

const dotClass = (s: SyncStatus) => (s.kind === "ok" ? "ok" : s.kind === "busy" ? "busy" : s.kind === "pending" ? "pending" : s.kind === "error" || s.kind === "locked" ? "err" : "");

export function DataPill({ onOpen }: { onOpen: () => void }) {
  const s = useSyncStatus();
  return (
    <button type="button" className="sync" onClick={onOpen} aria-label={`Sync: ${s.text}. Open data and settings`}>
      <span className={`dot ${dotClass(s)}`} />
      <span role="status">{s.text}</span>
    </button>
  );
}

export function DataSheet({ onClose }: { onClose: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => { const iv = setInterval(() => tick((n) => n + 1), 10_000); return () => clearInterval(iv); }, []);
  return (
    <Sheet title="Data & settings" onClose={onClose}>
      <SyncSection />
      <SettingsSection />
      <BackupSection />
    </Sheet>
  );
}

function SyncSection() {
  const s = useSyncStatus();
  return (
    <section className="dlg-section" aria-labelledby="sync-title">
      <h3 id="sync-title">Sync between devices</h3>
      {s.kind === "off" ? <Connect /> : s.kind === "locked" ? <Unlock detail={s.detail} /> : <Connected />}
    </section>
  );
}

function Connect() {
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true); setErr("");
    try { await probe(token); setToken(""); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <>
      <p className="muted small">
        Everything is saved on this device. To have it on your other devices too, connect each one to a private gist on your
        GitHub account. The data is encrypted with a passphrase before it leaves the device, so the gist only holds ciphertext.
      </p>
      <ol className="steps">
        <li>
          <b>Create a token on GitHub</b>
          <span className="muted small">
            The link opens the form with only the <code>gist</code> permission ticked. Choose an expiration, press <i>Generate token</i>,
            and copy it. The token you use for Workout Path, Piano Path or Feed Path works too.
          </span>
          <a className="link" href={TOKEN_URL} target="_blank" rel="noopener">Open GitHub token page <IconExternal /></a>
        </li>
        <li>
          <b>Paste it here</b>
          <form className="token-form" onSubmit={submit}>
            <input type="password" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="ghp_…" aria-label="GitHub token"
              value={token} onChange={(e) => setToken(e.target.value)} />
            <button className="btn primary" type="submit" disabled={busy || !token.trim()}>{busy ? "Checking…" : "Next"}</button>
          </form>
          {err && <p className="form-error" role="alert">{err}</p>}
        </li>
      </ol>
      <p className="muted small">The token stays on this device and can do nothing except read and write your gists.</p>
    </>
  );
}

function Unlock({ detail }: { detail?: string }) {
  const found = hasGist();
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const tooShort = pass.length > 0 && pass.length < 10;
  const mismatch = !found && again.length > 0 && again !== pass;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pass || (!found && (pass.length < 10 || pass !== again))) return;
    setBusy(true); setErr("");
    try { await unlock(pass); setPass(""); setAgain(""); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="sync-state">
        <IconLock width={18} height={18} />
        <div>
          <b>{found ? "Found your encrypted data" : "Choose a passphrase"}</b>
          <span className="muted small">
            {found ? "Enter the passphrase you chose on your first device." : "It encrypts your data before it goes to GitHub. Use the same one on every device."}
          </span>
        </div>
      </div>
      {detail && <p className="small">{detail}</p>}
      <input type="password" className="text-input" autoComplete={found ? "current-password" : "new-password"} placeholder="Passphrase" aria-label="Passphrase"
        value={pass} onChange={(e) => setPass(e.target.value)} />
      {!found && (
        <>
          <input type="password" className="text-input" autoComplete="new-password" placeholder="Same passphrase again" aria-label="Passphrase again"
            value={again} onChange={(e) => setAgain(e.target.value)} aria-invalid={mismatch || undefined} />
          <p className={`small ${tooShort || mismatch ? "form-error" : "muted"}`}>
            {mismatch ? "The two don't match." : "At least 10 characters; a few unrelated words is easiest to remember. Write it down: if it's lost, the gist can't be read (your devices keep their own copy)."}
          </p>
        </>
      )}
      {err && <p className="form-error" role="alert">{err}</p>}
      <button className="btn primary" type="submit" disabled={busy || !pass || (!found && (pass.length < 10 || pass !== again))}>
        {busy ? (found ? "Unlocking…" : "Encrypting…") : found ? "Unlock" : "Encrypt and sync"}
      </button>
      <button type="button" className="btn ghost" onClick={() => disconnect()}>Cancel</button>
    </form>
  );
}

function Connected() {
  const s = useSyncStatus();
  const [changing, setChanging] = useState(false);
  return (
    <>
      <div className="sync-state">
        <span className={`dot ${dotClass(s)}`} />
        <div>
          <b>{s.text}</b>
          <span className="muted small">Last synced {s.last ? ago(s.last) : "not yet"} · <IconLock /> encrypted</span>
        </div>
      </div>
      {s.detail && (s.kind === "error" || s.kind === "offline") && <p className="small">{s.detail}</p>}
      <div className="dlg-actions">
        <button type="button" className="btn primary" disabled={s.kind === "busy"} onClick={() => void syncNow(true)}>Sync now</button>
        <button type="button" className="btn ghost" onClick={() => setChanging((x) => !x)}>Change passphrase</button>
        {changing && <ChangePass onDone={() => setChanging(false)} />}
        <button type="button" className="btn ghost danger" onClick={() => { if (window.confirm("Stop syncing on this device? Everything stays here and in the gist.")) disconnect(); }}>
          Disconnect this device
        </button>
      </div>
    </>
  );
}

function ChangePass({ onDone }: { onDone: () => void }) {
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = pass.length >= 10 && pass === again;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setBusy(true); setErr("");
    try { await changePassphrase(pass); onDone(); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <form className="form-grid sub-form" onSubmit={submit}>
      <input type="password" className="text-input" autoComplete="new-password" placeholder="New passphrase (10+ characters)" aria-label="New passphrase" value={pass} onChange={(e) => setPass(e.target.value)} />
      <input type="password" className="text-input" autoComplete="new-password" placeholder="Again" aria-label="New passphrase again" value={again} onChange={(e) => setAgain(e.target.value)} />
      <p className="muted small">Your other devices will ask for the new one on their next sync.</p>
      {err && <p className="form-error" role="alert">{err}</p>}
      <button type="submit" className="btn primary" disabled={!ok || busy}>{busy ? "Encrypting…" : "Change passphrase"}</button>
    </form>
  );
}

function SettingsSection() {
  const s = useAppState();
  const st = s.settings;
  const [rateText, setRateText] = useState(String(st.usdIls));
  const [rateErr, setRateErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setRateText(String(st.usdIls)); }, [st.usdIls]);

  return (
    <section className="dlg-section" aria-labelledby="set-title">
      <h3 id="set-title">Settings</h3>
      <div className="field">
        <span className="field-label">Show totals in</span>
        <Seg<Currency> label="Show totals in" value={st.display} onChange={(c) => setSettings((x) => { x.display = c; })}
          options={[{ id: "ILS", label: "₪ Shekels" }, { id: "USD", label: "$ Dollars" }]} />
      </div>
      <div className="field">
        <span className="field-label">Dollar rate</span>
        <div className="rate-row">
          <span className="muted">$1 =</span>
          <input className="text-input rate-input" inputMode="decimal" aria-label="Shekels per dollar" value={rateText}
            onChange={(e) => setRateText(e.target.value)}
            onBlur={() => { const n = parseAmount(rateText); if (n > 0 && n !== st.usdIls) setRate(n); else setRateText(String(st.usdIls)); }} />
          <span className="muted">₪</span>
        </div>
        <label className="switch-row">
          <Switch on={st.rateAuto} onChange={(on) => { setSettings((x) => { x.rateAuto = on; }); if (on) void refreshRate(true).catch(() => {}); }} label="Update the rate by itself" />
          <span>Update by itself <span className="muted small">{st.rateAuto && st.rateAt ? `· ${ago(st.rateAt)}` : ""}</span></span>
        </label>
        <span className="muted small">
          The European Central Bank's daily reference rate (via frankfurter.dev). Typing a rate turns this off.
          {" "}<button type="button" className="text-btn" disabled={busy} onClick={async () => { setBusy(true); setRateErr(""); try { await refreshRate(true); } catch (e) { setRateErr((e as Error).message); } finally { setBusy(false); } }}>{busy ? "Updating…" : "Update now"}</button>
        </span>
        {rateErr && <span className="form-error">{rateErr}</span>}
      </div>
      <div className="form-row">
        <Stepper label="Inflation" unit="%" value={st.inflationPct} min={0} max={10} step={0.5} onChange={(v) => setSettings((x) => { x.inflationPct = v; })} />
        <Stepper label="Range ±" unit="%" value={st.spreadPct} min={0.5} max={5} step={0.5} onChange={(v) => setSettings((x) => { x.spreadPct = v; })} />
      </div>
      <p className="muted small">Inflation turns future amounts into today's money in the projection. The range shows the projection with the expected returns lower and higher by this much.</p>
      {hasExamples(s) && <button type="button" className="btn ghost" onClick={removeExamples}>Remove the examples</button>}
    </section>
  );
}

function BackupSection() {
  const [note, setNote] = useState("");
  const file = useRef<HTMLInputElement>(null);
  async function onFile(f?: File) {
    if (!f) return;
    try {
      const b = await readBackup(f);
      const when = b.exportedAt ? new Date(b.exportedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "an unknown date";
      if (!window.confirm(`Merge the backup from ${when} into this device?\n\n${b.sources} investments, ${b.txns} transactions.\nNothing here is removed; for anything in both, the newer edit is kept.`)) return;
      const before = getState().txns.filter((t) => !t.deletedAt).length;
      importBackup(b);
      const after = getState().txns.filter((t) => !t.deletedAt).length;
      setNote(after > before ? `Backup merged: ${after - before} transactions added.` : "Backup merged.");
    } catch (x) {
      setNote((x as Error).message);
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  return (
    <section className="dlg-section" aria-labelledby="bk-title">
      <h3 id="bk-title">Backup</h3>
      <p className="muted small">A JSON file with everything, to keep in Files or iCloud Drive. It isn't encrypted, so keep it somewhere private.</p>
      <div className="dlg-actions row">
        <button type="button" className="btn" onClick={() => void exportBackup().then((r) => setNote(r === "downloaded" ? "Backup downloaded." : r === "shared" ? "Backup shared." : ""))}>Export backup</button>
        <button type="button" className="btn ghost" onClick={() => file.current?.click()}>Import backup</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      {note && <p className="small" role="status">{note}</p>}
    </section>
  );
}
