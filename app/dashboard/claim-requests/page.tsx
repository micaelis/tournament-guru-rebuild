import { requireSessionAndProfile } from "@/lib/supabase/session";
import { redirect } from "next/navigation";
import {
  listAllClaimRequests,
  listMyClaimRequests,
} from "@/lib/claims/queries";
import { ClaimRequestsTable } from "./ClaimRequestsTable";
import { EmptyState } from "@/app/components/ui";

/**
 * Claim Requests dashboard. Same table shape for ED (own) + Admin
 * (all). Admin gets Approve / Decline actions; ED sees status only
 * (spec: ED's version hides the User column).
 */
export default async function ClaimRequestsDashboardPage() {
  const { profile, user } = await requireSessionAndProfile();
  if (profile.user_type === "attendee") redirect("/dashboard/reviews");

  const isAdmin = profile.user_type === "admin";
  const rows = isAdmin
    ? await listAllClaimRequests()
    : await listMyClaimRequests(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
          Claim Requests
        </h1>
        <p className="mt-1.5 text-[13.5px] text-slate-500">
          {isAdmin
            ? "Approve or decline event director claim requests. Approving transfers ownership across the whole tournament in one atomic step."
            : "Track the events you've asked the admin to hand over to your account."}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={isAdmin ? "No claim requests yet" : "No claims submitted"}
          body={
            isAdmin
              ? "When event directors ask to take over an admin-created listing, their requests land here."
              : "Head to a public event page you'd like to manage and hit the Claim CTA to send a request."
          }
        />
      ) : (
        <ClaimRequestsTable rows={rows} isAdmin={isAdmin} />
      )}
    </div>
  );
}
