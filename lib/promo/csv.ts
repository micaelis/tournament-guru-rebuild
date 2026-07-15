/**
 * CSV parsing helpers for the ED submit flow. Only the `email` column
 * matters — every other column is ignored. Kept as a pure module (no
 * server-only + no client-only) so it can run in either bundle.
 */

export type ParsedRow = { rowIndex: number; email: string };
export type ParseResult = {
  rows: ParsedRow[];
  errors: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse a CSV string into a normalized email list. Header row is
 * required and must contain a case-insensitive "email" column
 * (matches Bubble semantics per spec). Duplicate + malformed rows
 * are dropped from `rows` and surfaced in `errors`.
 */
export function parseCsvEmails(text: string): ParseResult {
  const errors: string[] = [];
  const rows: ParsedRow[] = [];
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { rows: [], errors: ["The file is empty."] };
  }
  const header = splitCsvLine(lines[0]);
  const emailIdx = header.findIndex(
    (h) => h.toLowerCase().replace(/[^a-z]/g, "") === "email",
  );
  if (emailIdx === -1) {
    return {
      rows: [],
      errors: [
        'Missing an "email" column. Check the demo file for the expected format.',
      ],
    };
  }
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const raw = cells[emailIdx]?.trim();
    if (!raw) {
      errors.push(`Row ${i}: empty email.`);
      continue;
    }
    const email = raw.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      errors.push(`Row ${i}: "${raw}" isn't a valid email.`);
      continue;
    }
    if (seen.has(email)) {
      continue; // silent dedupe
    }
    seen.add(email);
    rows.push({ rowIndex: i, email });
  }
  return { rows, errors };
}

/**
 * Naive CSV cell splitter that tolerates simple quoted values. Good
 * enough for the coach-email upload path — real users will paste
 * either plain-comma or Excel export CSVs; both round-trip cleanly.
 */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (c === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  cells.push(cur);
  return cells.map((s) => s.trim());
}

/** Serialize an email list back to the demo CSV shape. */
export function emailsToCsv(emails: string[]): string {
  return ["email", ...emails].join("\n");
}

/** Max rows per CSV upload — spec: 1000. */
export const MAX_CSV_ROWS = 1000;
