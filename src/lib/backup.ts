/* Backup to a JSON file and back. Import merges (src/lib/merge.ts): nothing on this device is removed.
   The file is NOT encrypted (it's for keeping in your own Files / iCloud Drive). */
import { getState, normalize, replaceState, type AppState } from "../state/store";
import { todayStr } from "./dates";
import { merge, serialize } from "./merge";

export const backupName = () => `finance-path-backup-${todayStr()}.json`;

/** Save the backup: the share sheet on a touch device (Save to Files), a download elsewhere. */
export async function exportBackup(): Promise<"shared" | "downloaded" | "cancelled"> {
  const text = serialize({ app: "finance-path", exportedAt: new Date().toISOString(), ...getState() });
  const file = new File([text], backupName(), { type: "application/json" });
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return "shared"; }
    catch (e) { if ((e as Error).name === "AbortError") return "cancelled"; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

export interface BackupInfo { state: AppState; exportedAt?: string; sources: number; txns: number }

export async function readBackup(file: File): Promise<BackupInfo> {
  let raw: unknown;
  try { raw = JSON.parse(await file.text()); } catch { throw new Error("That file isn't a Finance Path backup (it isn't JSON)."); }
  const x = raw as Record<string, unknown> | null;
  if (!x || typeof x !== "object" || x.app !== "finance-path" || !Array.isArray(x.sources) || !Array.isArray(x.txns)) {
    throw new Error("That file isn't a Finance Path backup.");
  }
  const state = normalize(x);
  return {
    state,
    exportedAt: typeof x.exportedAt === "string" ? x.exportedAt : undefined,
    sources: state.sources.filter((s) => !s.deletedAt).length,
    txns: state.txns.filter((t) => !t.deletedAt).length,
  };
}

/** Merge a backup into this device; it syncs out like any local change. */
export function importBackup(b: BackupInfo) {
  replaceState(merge(getState(), b.state), { local: true });
}
