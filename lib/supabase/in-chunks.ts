/**
 * PostgREST `.in()` filters ride the GET query string, and the HTTP
 * client caps request URIs at ~8 KB — around 200 UUIDs the request
 * dies with "URI too long" before it ever leaves the process (found
 * live: the admin Events dashboard crashed at 247 tournaments). Any
 * id list that is not bounded by a page-size constant must batch
 * through these helpers.
 */

export const IN_CHUNK_SIZE = 150;

export function chunkIds<T>(ids: T[], size = IN_CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

/**
 * Run `fetchChunk` per batch and concatenate. Row order across batches
 * is NOT the single-query order — re-sort at the call site when the
 * caller depends on it.
 */
export async function fetchInChunks<Id, Row>(
  ids: Id[],
  fetchChunk: (chunk: Id[]) => Promise<Row[]>,
): Promise<Row[]> {
  const out: Row[] = [];
  for (const chunk of chunkIds(ids)) {
    out.push(...(await fetchChunk(chunk)));
  }
  return out;
}
