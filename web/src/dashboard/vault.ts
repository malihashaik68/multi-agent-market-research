// Private, on-device storage for the dashboard.
// Data is encrypted with a key derived from the owner's PIN (PBKDF2 + AES-GCM, Web Crypto) and saved only in this
// browser's localStorage. Nothing is ever sent to a server. If the PIN is forgotten, the data can't be recovered
// (keep a backup file).
import type { Entry } from "./analytics";

const KEY = "brew-borough-vault-v1";
export type Settings = { cafeName: string; monthlyCosts: number; daysOpen: number };
export type Vault = { entries: Entry[]; settings: Settings };
export const EMPTY: Vault = { entries: [], settings: { cafeName: "My café", monthlyCosts: 0, daysOpen: 30 } };

const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(u)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pin: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250_000, hash: "SHA-256" }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

function read(): { salt: string; iv: string; data: string } | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; }
}

export const hasVault = () => read() != null;

export async function save(pin: string, vault: Vault) {
  const existing = read();
  const salt = existing ? unb64(existing.salt) : crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(vault)));
  localStorage.setItem(KEY, JSON.stringify({ salt: b64(salt), iv: b64(iv), data: b64(data) }));
}

/** Returns the vault, or null if the PIN is wrong. */
export async function open(pin: string): Promise<Vault | null> {
  const v = read();
  if (!v) return null;
  try {
    const key = await deriveKey(pin, unb64(v.salt));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(v.iv) }, key, unb64(v.data));
    return { ...EMPTY, ...JSON.parse(dec.decode(plain)) };
  } catch {
    return null;
  }
}

export async function create(pin: string) {
  localStorage.removeItem(KEY);
  await save(pin, EMPTY);
}

export const destroy = () => localStorage.removeItem(KEY);

// ------------------------------------------------------------- backups
export function toCSV(entries: Entry[]) {
  const rows = [["date", "customers", "sales", "expenses", "note"], ...entries.map((e) =>
    [e.date, e.customers, e.sales, e.expenses ?? "", (e.note ?? "").replace(/[",\n]/g, " ")])];
  return rows.map((r) => r.join(",")).join("\n");
}

export function fromCSV(text: string): Entry[] {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.toLowerCase().split(",").map((c) => c.trim());
  const idx = (n: string) => cols.indexOf(n);
  if (idx("date") < 0 || idx("customers") < 0 || idx("sales") < 0) throw new Error("The file needs date, customers and sales columns.");
  return lines.filter(Boolean).map((l) => {
    const c = l.split(",");
    const exp = idx("expenses") >= 0 ? c[idx("expenses")] : "";
    return { date: c[idx("date")].trim(), customers: Number(c[idx("customers")]), sales: Number(c[idx("sales")]),
             expenses: exp ? Number(exp) : null, note: idx("note") >= 0 ? c[idx("note")]?.trim() || undefined : undefined };
  }).filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && Number.isFinite(e.customers) && Number.isFinite(e.sales));
}

export function download(name: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}
