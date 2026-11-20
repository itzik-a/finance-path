/* Categories: rename, change the emoji, add, remove (items keep showing a removed category's name). */
import { useState, type FormEvent } from "react";
import { addCategory, deleteCategory, editCategory, liveCategories } from "../state/actions";
import { useAppState } from "../state/store";
import type { Category, TxnKind } from "../types";
import { IconPlus } from "./Icons";
import { Seg, Sheet } from "./ui";

const GROUPS: { kind: TxnKind; label: string }[] = [
  { kind: "expense", label: "Expenses" }, { kind: "income", label: "Income" }, { kind: "invest", label: "Invested" },
];

export function CategoriesSheet({ onClose }: { onClose: () => void }) {
  const s = useAppState();
  const cats = liveCategories(s);
  const [kind, setKind] = useState<TxnKind>("expense");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");

  function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addCategory({ kind, name, emoji: firstGrapheme(emoji) || "•" });
    setName(""); setEmoji("");
  }

  return (
    <Sheet title="Categories" onClose={onClose}>
      <Seg<TxnKind> className="full" label="Kind" value={kind} onChange={setKind} options={GROUPS.map((g) => ({ id: g.kind, label: g.label }))} />
      <ul className="cat-list">
        {cats.filter((c) => c.kind === kind).map((c) => <CatRow key={c.id} c={c} />)}
      </ul>
      <form className="cat-add" onSubmit={add}>
        <input className="text-input emoji-input" aria-label="Emoji" placeholder="🙂" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
        <input className="text-input" aria-label="New category name" placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
        <button type="submit" className="icon-btn" aria-label="Add category" disabled={!name.trim()}><IconPlus /></button>
      </form>
    </Sheet>
  );
}

function CatRow({ c }: { c: Category }) {
  const [name, setName] = useState(c.name);
  const [emoji, setEmoji] = useState(c.emoji);
  const save = () => {
    const e = firstGrapheme(emoji) || c.emoji;
    if (name.trim() && (name.trim() !== c.name || e !== c.emoji)) editCategory(c.id, (x) => { x.name = name.trim(); x.emoji = e; });
    else { setName(c.name); setEmoji(c.emoji); }
  };
  return (
    <li className="cat-row">
      <input className="text-input emoji-input" aria-label={`Emoji for ${c.name}`} value={emoji} onChange={(e) => setEmoji(e.target.value)} onBlur={save} />
      <input className="text-input" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} dir="auto" />
      <button type="button" className="btn ghost sm danger" onClick={() => deleteCategory(c.id)}>Remove</button>
    </li>
  );
}

/** The first visible character (an emoji can be several code points). */
function firstGrapheme(s: string): string {
  const t = s.trim();
  if (!t) return "";
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (x: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) for (const g of new Seg(undefined, { granularity: "grapheme" }).segment(t)) return g.segment;
  return Array.from(t)[0];
}
