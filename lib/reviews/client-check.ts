/**
 * Client-only banned-word matcher (mirror of the server helper in
 * banned-words.ts). Kept in a separate file so client components can
 * import the function without pulling `server-only`.
 */
export function findBannedWords(text: string, list: string[]): string[] {
  if (!text || list.length === 0) return [];
  const hits: string[] = [];
  const lower = text.toLowerCase();
  for (const word of list) {
    const escaped = escapeRegex(word.toLowerCase());
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "u");
    if (re.test(lower)) hits.push(word);
  }
  return Array.from(new Set(hits));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
