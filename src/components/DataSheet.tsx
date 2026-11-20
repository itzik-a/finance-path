/* "Data & settings": sync, backup, currency and projection settings. (Sync arrives in milestone 6.) */
import { Sheet } from "./ui";

export function DataPill({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="sync" onClick={onOpen} aria-label="On this device. Open data and settings">
      <span className="dot" />
      <span role="status">On this device</span>
    </button>
  );
}

export function DataSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Data & settings" onClose={onClose}>
      <p className="muted small">Everything is saved on this device. Encrypted sync between devices comes next.</p>
    </Sheet>
  );
}
