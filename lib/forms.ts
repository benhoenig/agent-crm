// FormData → typed values for server actions. Empty strings become null so
// optional columns stay null instead of collecting "".

export function str(fd: FormData, name: string): string | null {
  const v = fd.get(name);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

export function reqStr(fd: FormData, name: string): string {
  const v = str(fd, name);
  if (v === null) throw new Error(`Missing required field: ${name}`);
  return v;
}

/** Numeric columns are drizzle `numeric` → string | null. Strips ฿ and commas. */
export function numStr(fd: FormData, name: string): string | null {
  const v = str(fd, name);
  if (v === null) return null;
  const cleaned = v.replace(/[฿,\s]/g, "");
  if (cleaned === "" || Number.isNaN(Number(cleaned))) return null;
  return cleaned;
}

export function int(fd: FormData, name: string): number | null {
  const v = str(fd, name);
  if (v === null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

export function bool(fd: FormData, name: string): boolean {
  return fd.get(name) === "on" || fd.get(name) === "true";
}

/** <input type="date"> → "YYYY-MM-DD" | null. */
export function dateStr(fd: FormData, name: string): string | null {
  const v = str(fd, name);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/** Constrain a select value to a known enum list; anything else → null. */
export function enumStr<T extends string>(
  fd: FormData,
  name: string,
  allowed: readonly T[]
): T | null {
  const v = str(fd, name);
  return v !== null && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : null;
}
