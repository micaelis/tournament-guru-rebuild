"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, useToast } from "@/app/components/ui";
import type { SubmittedCsvRow } from "./queries";
import { sendPromoEmails, validateEmails } from "./send-actions";

type Preflight = {
  email: string;
  status: "eligible" | "wrong-user-type" | "blocked";
  reason?: string;
};

/**
 * Send Emails popup — spec's flow: shows the event card, the row
 * list, per-row exclude checkboxes, and a warning when the target
 * email is on file as a non-coach account. Excluded rows are dropped
 * before dispatch; the server side re-runs eligibility on submit so
 * a client tamper can't sneak in a blocked user.
 */
export function SendEmailsDialog({
  row,
  onClose,
  onSuccess,
}: {
  row: SubmittedCsvRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [preflight, setPreflight] = useState<Preflight[] | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await validateEmails(row.raw_emails);
      if (cancelled) return;
      setPreflight(rows);
      // Pre-exclude wrong-user-type + blocked — the spec says the
      // warning row can't be re-added by the admin.
      setExcluded(
        new Set(rows.filter((r) => r.status !== "eligible").map((r) => r.email)),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [row.raw_emails]);

  const eligible = useMemo(
    () => (preflight ?? []).filter((r) => !excluded.has(r.email)),
    [preflight, excluded],
  );

  const toggle = (email: string) => {
    const p = preflight?.find((r) => r.email === email);
    if (!p) return;
    if (p.status !== "eligible") return; // spec: cannot re-add blocked / wrong-type
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
          Send Promo Codes
        </h3>
        {row.event && (
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs">
            <p className="font-bold text-slate-900">{row.event.title}</p>
            {row.event.is_premium && (
              <span className="mt-1 inline-block rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                Premium
              </span>
            )}
          </div>
        )}
        <p className="mt-4 text-sm text-slate-600">
          A unique promo code will be sent by email to the recipients below.
          If the recipient is not a member of the platform, they will be sent
          a link to register as a Coach.
        </p>
        <div className="mt-4 flex items-center justify-between text-[12.5px] font-semibold text-slate-700">
          <span>
            Uploaded emails{" "}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
              {row.raw_emails.length}
            </span>
          </span>
          <span className="text-slate-500">
            {eligible.length} will receive an email
          </span>
        </div>

        <ul className="mt-3 max-h-[38vh] space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-white p-1">
          {(preflight ?? []).map((p, idx) => {
            const disabled = p.status !== "eligible";
            const dropped = excluded.has(p.email);
            return (
              <li
                key={p.email}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  dropped || disabled
                    ? "bg-slate-50 text-slate-400"
                    : "bg-white text-slate-800"
                }`}
              >
                <Checkbox
                  size="sm"
                  checked={!dropped}
                  onChange={() => toggle(p.email)}
                  disabled={disabled}
                  aria-label={`Include ${p.email}`}
                />
                <span className="w-10 text-right text-xs font-semibold text-slate-400">
                  {idx + 1}
                </span>
                <span className={disabled ? "line-through" : ""}>{p.email}</span>
                {p.status !== "eligible" && (
                  <span className="ml-auto text-[11px] font-semibold text-red-600">
                    {p.status === "wrong-user-type"
                      ? "Existing non-coach account · ignored"
                      : "Blocked account · ignored"}
                  </span>
                )}
              </li>
            );
          })}
          {preflight === null && (
            <li className="p-4 text-center text-sm text-slate-500">
              Running eligibility checks…
            </li>
          )}
        </ul>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            disabled={sending || eligible.length === 0 || preflight === null}
            onClick={async () => {
              setSending(true);
              const res = await sendPromoEmails({
                csvId: row.id,
                includeEmails: eligible.map((e) => e.email),
              });
              setSending(false);
              if (res.error) return push("error", res.error);
              push("success", res.info ?? "Emails queued.");
              onSuccess();
            }}
          >
            {sending ? "Sending…" : `Send ${eligible.length} emails`}
          </Button>
        </div>
      </div>
    </div>
  );
}
