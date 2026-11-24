import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { refreshRate } from "./lib/fx";
import { applyRecurring } from "./state/actions";
import { startSync } from "./state/sync";
import "./lib/theme";
import "./styles.css";

applyRecurring();
startSync();
void refreshRate();
// Recurring items due today, when the app was left open overnight or comes back from the background.
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { applyRecurring(); void refreshRate(); } });

// Offline launch from the Home Screen. Production only, so dev reloads stay fresh.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
