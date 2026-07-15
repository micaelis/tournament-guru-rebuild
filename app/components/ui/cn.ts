/**
 * Tiny className joiner. Filters out falsy values so callers can pass
 * conditional strings without wrapping in template literals.
 *   cn("foo", isActive && "active", err ? "err" : undefined)
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
