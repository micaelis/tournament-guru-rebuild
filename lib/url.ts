/**
 * Safe URL helper for values that came from the database.
 *
 * Anywhere a DB-sourced string ends up in an `<a href>`, `<img src>`,
 * `window.open`, or `fetch(url)` — put it through `safeExternalUrl` first.
 * The helper returns `null` for any URL whose scheme isn't in an
 * explicit allow-list, so a hostile `javascript:` / `data:` / `vbscript:`
 * value can't turn into a stored XSS.
 */

const ALLOWED_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Normalize an untrusted external URL. Returns the input string when it
 * parses to an allowed scheme; returns null otherwise (including for
 * malformed URLs and empty strings).
 *
 * For values without an explicit scheme we accept two shapes:
 *   • starts with `//`  → treat as https (protocol-relative)
 *   • starts with `www.` or a bare domain-looking token → prefix `https://`
 * Everything else with no scheme is rejected.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Protocol-relative → treat as https.
  if (trimmed.startsWith("//")) return `https:${trimmed}`;

  // If it looks like a domain-first URL, add https://
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    if (/^(?:www\.|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return null;
  }

  try {
    // We use a dummy base only so URL() will parse absolute-scheme inputs
    // consistently across environments; parse succeeds only for real URLs.
    const parsed = new URL(trimmed);
    return ALLOWED_SCHEMES.has(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Return the input as an `<img src>`-safe URL, or null. Restricted to
 * http/https — no `data:` (would allow SVG with embedded script), no
 * `blob:`, no `javascript:`.
 */
export function safeImageSrc(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.startsWith("//")) return `https:${trimmed}`;

  // Bare-domain paths — assume https.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    // Allow same-origin paths starting with `/`.
    if (trimmed.startsWith("/")) return trimmed;
    if (/^(?:www\.|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}
