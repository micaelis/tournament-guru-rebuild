"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Alert } from "@/app/(auth)/parts";
import {
  Button,
  useToast,
} from "@/app/components/ui";
import { submitCsv, type CsvSubmitState } from "./actions";
import { emailsToCsv, MAX_CSV_ROWS, parseCsvEmails } from "@/lib/promo/csv";

const INITIAL: CsvSubmitState = {};

type EventOption = { id: string; title: string };

/**
 * ED CSV submit form. Client reads the CSV as text via
 * FileReader (small files only — 1000 rows max ≈ 30 KB), previews
 * the parsed row count, and passes the raw text to the server action
 * for authoritative validation + insert.
 */
export function SubmitCsvForm({ events }: { events: EventOption[] }) {
  const [state, formAction] = useActionState(submitCsv, INITIAL);
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const { push } = useToast();

  const readFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    const parsed = parseCsvEmails(text);
    setPreviewCount(parsed.rows.length);
    setPreviewErrors(parsed.errors);
  };

  const downloadDemo = () => {
    const csv = emailsToCsv(["coach1@example.com", "coach2@example.com"]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "tournament-guru-demo.csv";
    a.click();
    URL.revokeObjectURL(href);
  };

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h3 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
          Upload a premium event first
        </h3>
        <p className="mt-2 text-sm text-slate-700">
          Promo CSVs can only be submitted against a premium event.
          Upgrade an existing event or create a new premium one.
        </p>
        <div className="mt-4 flex gap-2">
          <Link href={"/dashboard/events" as Route}>
            <Button>Manage your events</Button>
          </Link>
        </div>
      </div>
    );
  }

  const previewOk =
    previewCount !== null && previewCount > 0 && previewCount <= MAX_CSV_ROWS;

  return (
    <>
      <form
        action={(fd) => {
          fd.set("event_id", eventId);
          fd.set("csv_text", csvText);
          fd.set("file_name", fileName || "coach-list.csv");
          startTransition(() => formAction(fd));
        }}
        onSubmit={(e) => {
          if (!previewOk) return;
          e.preventDefault();
          setShowConfirm(true);
        }}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6"
      >
        {state.error && <Alert kind="error">{state.error}</Alert>}
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
          Once submitted, your CSV file will be reviewed by the Admin. Please
          download the demo CSV to make sure the format follows our guidelines.
          <strong className="ml-1">Limit of {MAX_CSV_ROWS} rows per file.</strong>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" onClick={downloadDemo}>
            Download demo CSV
          </Button>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
            CSV file
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readFile(f);
            }}
            className="tg-control"
          />
          {previewCount !== null && (
            <p className="mt-1 text-xs text-slate-500">
              {previewCount} unique email{previewCount === 1 ? "" : "s"} parsed
              {previewErrors.length > 0 && ` · ${previewErrors.length} row(s) skipped`}
            </p>
          )}
          {state.fieldErrors?.csv_text && (
            <p className="mt-1 text-xs font-medium text-red-600">
              {state.fieldErrors.csv_text}
            </p>
          )}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
            Event
          </span>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="tg-control tg-select"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
          {state.fieldErrors?.event_id && (
            <p className="mt-1 text-xs font-medium text-red-600">
              {state.fieldErrors.event_id}
            </p>
          )}
        </label>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={!previewOk || pending}>
            {pending ? "Submitting…" : "Submit for review"}
          </Button>
        </div>
      </form>

      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowConfirm(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
              Submit CSV for admin review?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {previewCount} emails will queue for admin approval. You&apos;ll
              be able to cancel while status stays pending.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowConfirm(false)}>
                Back
              </Button>
              <Button
                onClick={() => {
                  const fd = new FormData();
                  fd.set("event_id", eventId);
                  fd.set("csv_text", csvText);
                  fd.set("file_name", fileName || "coach-list.csv");
                  setShowConfirm(false);
                  startTransition(async () => {
                    await formAction(fd);
                    push(
                      "success",
                      "Your file has been successfully submitted to the Admin and will be reviewed shortly.",
                    );
                    router.refresh();
                  });
                }}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
