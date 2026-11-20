import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { DataPill, DataSheet } from "./components/DataSheet";
import { IconCashflow, IconInvest, IconOverview, IconProjection } from "./components/Icons";
import { Toast } from "./components/Toast";
import { CashFlow } from "./views/CashFlow";
import { Investments } from "./views/Investments";
import { Overview } from "./views/Overview";
import { Projection } from "./views/Projection";

export type View = "overview" | "cashflow" | "investments" | "projection";
const TABS: { id: View; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "overview", label: "Overview", Icon: IconOverview },
  { id: "cashflow", label: "Cash flow", Icon: IconCashflow },
  { id: "investments", label: "Investments", Icon: IconInvest },
  { id: "projection", label: "Projection", Icon: IconProjection },
];

/** "#investments/abc" → { view: "investments", sub: "abc" } */
interface Route { view: View; sub?: string }

const readHash = (): Route => {
  const [v, ...rest] = decodeURIComponent(location.hash.slice(1)).split("/");
  const view = TABS.some((t) => t.id === v) ? (v as View) : "overview";
  return { view, sub: rest.join("/") || undefined };
};

export function App() {
  const [route, setRoute] = useState<Route>(readHash);
  const [dataOpen, setDataOpen] = useState(false);

  useEffect(() => {
    const on = () => setRoute((prev) => {
      const next = readHash();
      if (next.view !== prev.view || next.sub !== prev.sub) window.scrollTo(0, 0);
      return next;
    });
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const { view, sub } = route;
  const openData = () => setDataOpen(true);

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Finance Path, overview">
          <img src="./icon.svg" alt="" width={30} height={30} />
          <span>Finance Path</span>
        </a>
        <nav className="side-nav" aria-label="Sections">
          {TABS.map(({ id, label, Icon }) => (
            <a key={id} href={`#${id}`} aria-current={view === id ? "page" : undefined}><Icon /><span>{label}</span></a>
          ))}
        </nav>
        <div className="side-foot"><DataPill onOpen={openData} /></div>
      </aside>

      <header className="topbar">
        <a className="brand" href="#overview" aria-label="Finance Path, overview">
          <img src="./icon.svg" alt="" width={28} height={28} />
          <span>Finance Path</span>
        </a>
        <DataPill onOpen={openData} />
      </header>

      <main className={`main view-${view}`} key={`${view}/${sub ?? ""}`}>
        {view === "overview" ? <Overview />
          : view === "cashflow" ? <CashFlow />
          : view === "investments" ? <Investments sub={sub} />
          : <Projection sub={sub} />}
      </main>

      <Toast />
      {dataOpen && <DataSheet onClose={() => setDataOpen(false)} />}

      <nav className="tabbar" aria-label="Sections">
        {TABS.map(({ id, label, Icon }) => (
          <a key={id} href={`#${id}`} aria-current={view === id ? "page" : undefined}><Icon /><span>{label}</span></a>
        ))}
      </nav>
    </div>
  );
}
