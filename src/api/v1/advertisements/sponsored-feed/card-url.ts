/** Normalize card destinations; never fetch the supplied URL from the server. */
export function normalizeCardUrl(
  value: string | null | undefined
): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/\s|[\\\u0000-\u001f\u007f]/u.test(raw) || raw.startsWith("//")) {
    throw new Error("Enter a valid HTTP or HTTPS website URL.");
  }
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(candidate);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !url.hostname.includes(".") ||
    url.hostname.endsWith(".")
  ) {
    throw new Error("Enter a valid HTTP or HTTPS website URL.");
  }
  return url.href;
}
export function resolveCardUrl(
  element: string | null | undefined,
  fallback: string | null | undefined,
  clickable: boolean
): string | null {
  return clickable
    ? (normalizeCardUrl(element) ?? normalizeCardUrl(fallback))
    : null;
}
