import { emailsToCsv } from "@/lib/promo/csv";
import { getCsvSignedUrl } from "./actions";
import type { SubmittedCsvRow } from "./queries";

export function csvFileName(row: SubmittedCsvRow): string {
  if (row.file_path) {
    const bits = row.file_path.split("/");
    return bits[bits.length - 1] || "coach-list.csv";
  }
  return "coach-list.csv";
}

/** Regenerate the CSV from the inline email list and trigger a download. */
function downloadInMemory(row: SubmittedCsvRow): void {
  const csv = emailsToCsv(row.raw_emails);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = csvFileName(row);
  a.click();
  URL.revokeObjectURL(href);
}

/**
 * Download a submission's CSV. Prefers the ORIGINAL uploaded file via a
 * short-lived signed URL from the private promo-csv bucket (S10.4) — the
 * auditable artifact — and falls back to regenerating from the inline
 * `raw_emails` for legacy rows that predate the bucket or when signing
 * fails. `onError` surfaces a soft message; the fallback still runs.
 */
export async function downloadCsvRow(
  row: SubmittedCsvRow,
  onError?: (message: string) => void,
): Promise<void> {
  const { url, error } = await getCsvSignedUrl(row.id);
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  // No stored file (or a signing error) — regenerate from raw_emails.
  if (error && !/no uploaded file/i.test(error)) onError?.(error);
  downloadInMemory(row);
}
