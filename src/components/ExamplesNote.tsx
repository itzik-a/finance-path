/* A note while the starter examples are still there, with a button to remove them all. */
import { hasExamples, removeExamples } from "../state/actions";
import { useAppState } from "../state/store";

export function ExamplesNote() {
  const s = useAppState();
  if (!hasExamples(s)) return null;
  return (
    <aside className="card note-card" aria-label="About the examples">
      <p className="small">
        <b>These are examples</b>, made up so you can see how it works. Edit one and it becomes yours; remove the rest when you've added your own.
      </p>
      <button type="button" className="btn ghost sm" onClick={removeExamples}>Remove examples</button>
    </aside>
  );
}
