import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerAuthClient, createAnonServerClient } from "@/lib/supabase/server";
import { Button } from "@/app/components/ui";
import AuthShell from "@/app/(auth)/AuthShell";

type Params = { token: string };

/**
 * Promo landing — the 3rd auth variant, powered by SECURITY DEFINER
 * RPCs.
 *
 * Anon caller:
 *   `promo_landing_info(token)` (anon-callable) resolves the token to
 *   an event_id + the email the promo was addressed to. We redirect
 *   to /signup with type=attendee + role=coach + email pre-filled +
 *   ?next set to this same URL so the coach lands right back here
 *   post-signup.
 *
 * Signed-in caller:
 *   `claim_promo(token)` (authenticated-only) verifies the caller's
 *   auth.users.email matches promo.email. On success it flips
 *   status='active', links user_id, logs a 'landed' funnel event,
 *   and returns the target event_id. We then route to
 *   /events/[event]/review?promo=<promo_id>.
 *
 * Every error path lands on the "this link isn't active" placeholder
 * so we never leak which piece of the check failed (spec: "If the
 * page doesn't have a promo value in the URL or if such a promo
 * object doesn't exist - they should see a simple placeholder").
 */
export default async function PromoLandingPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;

  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Anon lookup — safe: returns only what a valid token owner
    // already knows (their event + the target email).
    const anon = createAnonServerClient();
    const { data } = await anon.rpc("promo_landing_info", { p_token: token });
    const info = pickFirst<{ event_id: string; email: string }>(data);
    if (!info) return placeholder();
    const next = `/promo/${token}`;
    redirect(
      `/signup?type=attendee&role=coach&email=${encodeURIComponent(info.email)}&next=${encodeURIComponent(next)}`,
    );
  }

  // Signed-in: attempt to claim. Definer RPC rejects (raises) when
  // the caller's auth email doesn't match the promo's target — we
  // treat every failure the same as a missing promo per the spec's
  // anti-enumeration copy on this landing.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, user_type")
    .eq("id", user.id)
    .maybeSingle<{
      onboarding_completed: boolean;
      user_type: "attendee" | "event_director" | "admin";
    }>();
  if (!profile) redirect("/login");
  if (profile.user_type !== "attendee") {
    // The link belongs to a different account type — send them to
    // the event page instead of trying to claim.
    const anon = createAnonServerClient();
    const { data } = await anon.rpc("promo_landing_info", { p_token: token });
    const info = pickFirst<{ event_id: string; email: string }>(data);
    if (!info) return placeholder();
    redirect(`/events/${info.event_id}`);
  }
  if (!profile.onboarding_completed) {
    const next = `/promo/${token}`;
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }

  const { data: claim } = await supabase.rpc("claim_promo", { p_token: token });
  const claimRow = pickFirst<{ promo_id: string; event_id: string }>(claim);
  if (!claimRow) return placeholder();
  redirect(
    `/events/${claimRow.event_id}/review?promo=${claimRow.promo_id}`,
  );
}

function placeholder() {
  return (
    <AuthShell>
      <div className="max-w-md">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          This link isn&apos;t active
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          The promo you tried to open isn&apos;t on file — it may have expired,
          been reissued, or been sent to a different address. Reach out to the
          event director for a fresh link.
        </p>
        <div className="mt-6">
          <Link href={"/events" as never}>
            <Button>Browse events</Button>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

/** RPC helpers return `data` as either a single row or an array
 * depending on the return type. Normalize to `T | null`. */
function pickFirst<T>(data: unknown): T | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    return (data[0] as T | undefined) ?? null;
  }
  return data as T;
}
