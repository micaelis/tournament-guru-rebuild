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
