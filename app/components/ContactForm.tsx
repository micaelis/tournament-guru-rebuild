"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { submitContactRequest } from "./contact-action";
import {
  CONTACT_REQUIRED,
  type ContactField,
  type ContactSource,
  type ContactState,
} from "./contact-config";
import { TextInput, Field } from "@/app/components/ui/Field";
import { Button } from "@/app/components/ui/Button";
import { FormMessage } from "@/app/components/ui/FormMessage";

type TextField = {
  name: Exclude<ContactField, "additional_notes">;
  label: string;
  type: string;
  autoComplete: string;
  placeholder: string;
};

const TEXT_FIELDS: TextField[] = [
  { name: "full_name", label: "Full Name", type: "text", autoComplete: "name", placeholder: "Jane Doe" },
  { name: "email", label: "Email Address", type: "email", autoComplete: "email", placeholder: "you@email.com" },
  { name: "phone", label: "Phone Number", type: "tel", autoComplete: "tel", placeholder: "(555) 123-4567" },
  { name: "company_name", label: "Company Name", type: "text", autoComplete: "organization", placeholder: "Your company" },
  { name: "website", label: "Website", type: "url", autoComplete: "url", placeholder: "https://yoursite.com" },
];

const COPY: Record<
  ContactSource,
  { submit: string; notesPlaceholder: string; footer: string }
> = {
  general: {
    submit: "Send Message",
    notesPlaceholder: "How can we help? Share your question or feedback…",
    footer: "We'll only use your details to respond to your message.",
  },
};

export function ContactForm({ source }: { source: ContactSource }) {
  const [state, formAction, pending] = useActionState<ContactState, FormData>(
    submitContactRequest,
    {},
  );

  if (state.ok) return <SuccessCard />;

  const v = state.values ?? {};
  const fe = state.fieldErrors ?? {};
  const required = new Set<ContactField>(CONTACT_REQUIRED[source]);
  const copy = COPY[source];

  return (
    <form action={formAction} noValidate>
      <h2
        className="font-heading text-dark"
        style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: "-0.025em" }}
      >
        Send us a message
      </h2>
      <p
        style={{ marginTop: 6, marginBottom: 24, fontSize: 14, lineHeight: 1.55, color: "var(--color-text-secondary)" }}
      >
        Fill out the form and we&apos;ll be in touch soon.
      </p>
      <input type="hidden" name="source" value={source} />

      {state.error && (
        <div style={{ marginBottom: 18 }}>
          <FormMessage tone="error">{state.error}</FormMessage>
        </div>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {TEXT_FIELDS.map((f) => {
          const req = required.has(f.name);
          return (
            <TextInput
              key={f.name}
              label={f.label}
              name={f.name}
              type={f.type}
              autoComplete={f.autoComplete}
              placeholder={f.placeholder}
              defaultValue={v[f.name] ?? ""}
              error={fe[f.name]}
              required={req}
              optional={!req}
            />
          );
        })}

        <Field
          label="Additional Notes"
          htmlFor="additional_notes"
          error={fe.additional_notes}
          optional={!required.has("additional_notes")}
        >
          <textarea
            id="additional_notes"
            name="additional_notes"
            className="tg-control"
            rows={4}
            placeholder={copy.notesPlaceholder}
            defaultValue={v.additional_notes ?? ""}
            aria-invalid={fe.additional_notes ? true : undefined}
            required={required.has("additional_notes")}
            style={{ resize: "vertical", minHeight: 104 }}
          />
        </Field>

        <Button type="submit" loading={pending} className="mt-1">
          {pending ? "Sending…" : copy.submit}
        </Button>

        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            lineHeight: 1.5,
            color: "var(--color-text-muted)",
            textAlign: "center",
          }}
        >
          {copy.footer}
        </p>
      </div>
    </form>
  );
}

function SuccessCard() {
  const ref = useRef<HTMLDivElement>(null);

  // Submitting swaps the tall form for this short card; without an
  // explicit scroll the viewport stays parked where the submit button
  // was and the confirmation renders off-screen.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  return (
    <div ref={ref} className="tg-step-in" style={{ textAlign: "center", padding: "20px 8px" }} role="status">
      {/* Layered halo makes the confirmation read celebratory, not clinical. */}
      <span
        className="relative inline-flex items-center justify-center rounded-full"
        style={{
          width: 88,
          height: 88,
          background: "linear-gradient(135deg, #fef2f2, #fee2e2)",
          border: "1px solid #fecaca",
        }}
      >
        <span
          className="inline-flex items-center justify-center rounded-full"
          style={{
            width: 60,
            height: 60,
            background: "linear-gradient(135deg, #1e293b, #0f172a)",
            boxShadow: "0 12px 26px -10px rgba(15,23,42,.5)",
            color: "#fff",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 inline-flex items-center justify-center rounded-full text-white"
          style={{
            width: 28,
            height: 28,
            background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
            boxShadow: "0 6px 14px -5px rgba(220,38,38,.5)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </span>
      </span>

      <h3
        className="font-heading text-dark"
        style={{ marginTop: 20, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}
      >
        Message sent!
      </h3>
      <p
        className="mx-auto"
        style={{ marginTop: 10, marginBottom: 0, fontSize: 15, lineHeight: 1.6, color: "var(--color-text-secondary)", maxWidth: 380 }}
      >
        Thanks for reaching out — your note is on its way to the team.
      </p>

      <span
        className="mt-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-2"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
        <span className="text-[12.5px] font-semibold" style={{ color: "var(--color-text-secondary)" }}>
          We typically reply within 1–2 business days
        </span>
      </span>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/events"
          className="font-heading inline-flex items-center gap-1.5 rounded-xl no-underline transition-transform hover:-translate-y-0.5"
          style={{ padding: "11px 20px", fontSize: 14, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #1e293b, #0f172a)", borderRadius: 12 }}
        >
          Browse events while you wait
        </Link>
        <Link
          href="/"
          className="font-heading inline-flex items-center rounded-xl border bg-white no-underline transition-transform hover:-translate-y-0.5"
          style={{ padding: "11px 20px", fontSize: 14, fontWeight: 700, color: "var(--color-dark)", borderColor: "var(--color-border)", borderRadius: 12 }}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
