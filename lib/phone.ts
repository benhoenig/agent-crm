/**
 * Canonical phone normalization — THE dedupe key for the contacts book.
 * The Phase 4 import and the app's owner/contact resolution must agree on
 * this format or phone-dedupe silently splits records; both call this.
 *
 * Canonical form: digits only, Thai local format with leading 0
 * ("0812345678"). Returns null for values that aren't phone numbers
 * (e.g. "line", "ใน Messenger" — sheet-era channel notes typed into the
 * phone column).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // first number wins when several are packed in one cell ("a / b", "a , b")
  const first = raw.split(/[\/,]| หรือ /)[0] ?? "";
  let digits = first.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("66") && digits.length >= 11) digits = "0" + digits.slice(2); // +66…
  if (!digits.startsWith("0") && [8, 9].includes(digits.length)) digits = "0" + digits; // dropped leading 0
  // Thai numbers: 9 digits (landline) or 10 (mobile); anything else isn't a phone
  if (digits.length < 9 || digits.length > 10) return null;
  return digits;
}

/** Additional numbers beyond the first, for preserving in a remark/note. */
export function extraPhones(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\/,]| หรือ /)
    .slice(1)
    .map((p) => normalizePhone(p))
    .filter((p): p is string => p !== null);
}
