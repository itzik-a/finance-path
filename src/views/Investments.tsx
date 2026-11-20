export function Investments({ sub }: { sub?: string }) {
  return (
    <header className="page-head"><h1 className="display">Investments</h1><p className="muted">Coming soon.{sub ? "" : ""}</p></header>
  );
}
