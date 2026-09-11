// Shared searchParams helpers — list pages share these so filter params
// survive pagination.

export type Search = { [key: string]: string | string[] | undefined };

export function param(sp: Search, key: string): string {
  const v = sp[key];
  return typeof v === "string" ? v : "";
}

/** Page-link builder: keeps every string-valued filter param, swaps "page". */
export function pageHref(basePath: string, sp: Search): (page: number) => string {
  return (page: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp))
      if (typeof v === "string" && v && k !== "page") qs.set(k, v);
    qs.set("page", String(page));
    return `${basePath}?${qs.toString()}`;
  };
}

/**
 * Same-page link with one param set (or removed when `value` is null), keeping
 * every other filter. Drops `page` — changing a view or a tab should land on
 * page 1 rather than page 7 of a list that no longer has one.
 */
export function withParam(
  basePath: string,
  sp: Search,
  key: string,
  value: string | null
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp))
    if (typeof v === "string" && v && k !== "page" && k !== key) qs.set(k, v);
  if (value) qs.set(key, value);
  const q = qs.toString();
  return q ? `${basePath}?${q}` : basePath;
}
