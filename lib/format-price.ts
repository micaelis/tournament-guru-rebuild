/**
 * Price display helpers shared by the public event page and the ED
 * event-details page. Age-group prices arrive as Postgres numerics that
 * may deserialize as strings, so the range helper coerces defensively.
 */

export function formatPrice(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** "$495" for a flat price, "$495–$545" for a spread, null when no priced rows. */
export function derivePriceRange(
  rows: ReadonlyArray<{ price: number | string | null }>,
): string | null {
  const prices = rows
    .map((r) => (r.price == null ? null : Number(r.price)))
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0);
  if (prices.length === 0) return null;
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi
    ? `$${formatPrice(lo)}`
    : `$${formatPrice(lo)}–$${formatPrice(hi)}`;
}
