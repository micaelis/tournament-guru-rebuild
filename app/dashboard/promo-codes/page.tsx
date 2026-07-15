import { requireSessionAndProfile } from "@/lib/supabase/session";
import {
  listMyPremiumEvents,
  listPromoCodes,
  listSubmittedCsvs,
} from "./queries";
import { EdSubmittedList } from "./EdSubmittedList";
import { SubmitCsvForm } from "./SubmitCsvForm";
import { AdminSubmittedCsvs } from "./AdminSubmittedCsvs";
import { AttendeePromoList, CoachesList } from "./CoachesList";
import { createServerAuthClient } from "@/lib/supabase/server";

type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * Promo Codes hub — role-aware. Attendee sees their own promos; ED
 * gets three tabs (their submissions, coaches, submit new); Admin
 * gets two (all submissions, coaches). Tab state lives in the URL
 * so refreshes stick.
 */
export default async function PromoCodesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { profile, user } = await requireSessionAndProfile();
  const sp = await searchParams;

  if (profile.user_type === "attendee") {
    const rows = await listPromoCodes({ scope: "mine", userId: user.id });
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
            Promo Codes
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Every promo code sent to you. Use the &quot;Write review&quot; CTA to
            land on the verified review form with your code pre-applied.
          </p>
        </div>
        <AttendeePromoList rows={rows} />
      </div>
    );
  }

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
        <CoachesTabContent userId={user.id} isAdmin={isAdmin} />
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

async function CoachesTabContent({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) {
  const rows = await listPromoCodes({
    scope: isAdmin ? "all" : "own_ed",
    edId: userId,
  });
  const edIds = Array.from(
    new Set(
      rows
        .map((r) => r.submitted_csv?.ed_id)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const edNames = new Map<string, string>();
  if (isAdmin && edIds.length) {
    const supabase = await createServerAuthClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", edIds);
    for (const p of (data ?? []) as {
      id: string;
      first_name: string | null;
      last_name: string | null;
    }[]) {
      edNames.set(
        p.id,
        [p.first_name, p.last_name].filter(Boolean).join(" ") || p.id,
      );
    }
  }
  return <CoachesList rows={rows} isAdmin={isAdmin} edNames={edNames} />;
}
