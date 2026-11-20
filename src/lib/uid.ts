/** A short random id. (crypto.randomUUID is missing on the plain-http LAN dev server.) */
export function uid(): string {
  const b = new Uint8Array(9);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(36).padStart(2, "0")).join("").slice(0, 14);
}
