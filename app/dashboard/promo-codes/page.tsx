import { requireSessionAndProfile } from "@/lib/supabase/session";
import { redirect } from "next/navigation";
import { listMyPremiumEvents, listSubmittedCsvs } from "./queries";
import { EdSubmittedList } from "./EdSubmittedList";
import { SubmitCsvForm } from "./SubmitCsvForm";
import { AdminSubmittedCsvs } from "./AdminSubmittedCsvs";
import { EmptyState } from "@/app/components/ui";

type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * Promo Codes hub. ED sees 3 tabs (their submissions, coaches with
 * promo codes, submit new); Admin sees 2 (all submissions, coaches
 * with promo codes). Tab state lives in the URL so refreshes stick.
 */
export default async function PromoCodesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { profile, user } = await requireSessionAndProfile();
  if (profile.user_type === "attendee") {
    // Attendee promo codes surface is a separate page.
    redirect("/dashboard/account");
  }
  const sp = await searchParams;
  const isAdmin = profile.user_type === "admin";
  const rawTab = typeof sp.tab === "string" ? sp.tab : "";
  const defaultTab = isAdmin ? "submissions" : "submit";
  const tab =
    ["submissions", "coaches", "submit"].includes(rawTab)
      ? rawTab
      : defaultTab;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          Promo Codes
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {isAdmin
            ? "Review submitted CSVs and manage sent promo codes."
            : "Submit coach CSVs for admin approval and track the promo codes generated for your events."}
        </p>
      </div>

      <Tabs tab={tab} isAdmin={isAdmin} />

      {tab === "submit" && !isAdmin && (
        <SubmitTabContent userId={user.id} />
      )}

      {tab === "submissions" && (
        <SubmissionsTabContent
          userId={user.id}
          isAdmin={isAdmin}
        />
      )}

      {tab === "coaches" && (
        <EmptyState
          title="Coaches with promo codes"
          body="This list lands in S3.5 — the coach view of each promo (Registered vs Invited) with status + See Review."
        />
      )}
    </div>
  );
}

function Tabs({ tab, isAdmin }: { tab: string; isAdmin: boolean }) {
  const items = isAdmin
    ? [
        { key: "submissions", label: "Submitted CSVs" },
        { key: "coaches", label: "Coaches with promo codes" },
      ]
    : [
        { key: "submissions", label: "My submitted CSVs" },
        { key: "coaches", label: "Coaches with promo codes" },
        { key: "submit", label: "Submit CSV file" },
      ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => {
        const active = tab === i.key;
        return (
          <a
            key={i.key}
            href={`?tab=${i.key}`}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            {i.label}
          </a>
        );
      })}
    </div>
  );
}

async function SubmitTabContent({ userId }: { userId: string }) {
  const events = await listMyPremiumEvents(userId);
  return <SubmitCsvForm events={events} />;
}

async function SubmissionsTabContent({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) {
  const rows = await listSubmittedCsvs({
    userId,
    scope: isAdmin ? "all" : "own",
  });
  if (isAdmin) return <AdminSubmittedCsvs rows={rows} />;
  return <EdSubmittedList rows={rows} />;
}
