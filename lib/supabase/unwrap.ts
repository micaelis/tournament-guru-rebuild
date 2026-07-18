import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Checked unwrap for Supabase query results.
 *
 * A failed query and an empty result are different outcomes: empty
 * `data` is a legitimate "nothing matched" and should render the normal
 * empty state, while a non-null `error` means the query itself broke
 * (RLS change, renamed column, network) and must surface instead of
 * masquerading as "no results". Destructuring `data` while ignoring
 * `error` collapses the two — that pattern shipped a page that looked
 * intentionally empty for weeks. Route query results through here.
 */
export function unwrap<R extends { error: PostgrestError | null }>(
  result: R,
  context: string,
): Omit<R, "error"> {
  if (result.error) {
    throw new Error(
      `${context}: [${result.error.code || "unknown"}] ${result.error.message}`,
    );
  }
  return result;
}

/** `unwrap` for list queries — also coalesces null rows to `[]`. */
export function unwrapRows<T>(
  result: { data: T[] | null; error: PostgrestError | null },
  context: string,
): T[] {
  return unwrap(result, context).data ?? [];
}

/**
 * First failure across a batch of writes, as a message the calling
 * Server Action can hand back in its state — the write-side sibling of
 * `unwrap`. Actions report failures through their return value rather
 * than throwing, so this yields a string instead of rejecting.
 *
 * Replace-all child collections fan out through `Promise.all`, whose
 * resolved value is an array of results nobody reads. Dropping those
 * errors is worse than dropping a read's: the delete half of a
 * replace-all can succeed while the insert half fails, so the rows are
 * gone AND the action reports success. Route write batches through here.
 */
export function firstWriteError(
  results: readonly { error: PostgrestError | null }[],
  context: string,
): string | null {
  for (const result of results) {
    if (result.error) {
      console.error(
        `${context}: [${result.error.code || "unknown"}] ${result.error.message}`,
      );
      return result.error.message;
    }
  }
  return null;
}

/**
 * Log-and-degrade variant for surfaces with a DESIGNED fallback —
 * marketing chrome (landing strips, popular-search chips) where an
 * empty render is an accepted degradation and a throw would take the
 * whole page down. The failure is still logged loudly so it can never
 * pass as "nothing to show". Content pages use `unwrapRows` (throw).
 */
export function unwrapRowsLogged<T>(
  result: { data: T[] | null; error: PostgrestError | null },
  context: string,
): T[] {
  if (result.error) {
    console.error(
      `${context}: [${result.error.code || "unknown"}] ${result.error.message}`,
    );
    return [];
  }
  return result.data ?? [];
}
