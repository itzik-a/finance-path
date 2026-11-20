/* A source's own projection on its page (milestone 3). */
import type { AppState } from "../state/store";
import type { Source } from "../types";

export function SourceProjection(_: { s: AppState; source: Source }) {
  return null;
}
