import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { Button } from "@/app/components/ui";

type Params = { token: string };

/**
 * Promo landing — the 3rd auth variant. Resolves the URL token,
 * bumps the promo lifecycle from 'sent' → 'active' (spec: "the
 * reviewer (coach) has followed the link in the email, landed on
 * this page"), logs the funnel `landed` event, then routes the
 * caller to either the review form (signed-in + onboarded), the
 * onboarding wizard (signed-in but incomplete), or signup (anon).
 *
 * Invalid / missing token → the spec's "simple placeholder on the
 * left side" so the page never gives away whether a token existed.
 */
export default async function PromoLandingPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;
  const supabase = await createServerAuthClient();
  const { data: promo } = await supabase
    .from("promo_codes")
    .select("id, event_id, email, status, user_id")
    .eq("url_token", token)
    .maybeSingle<{
      id: string;
      event_id: string;
      email: string;
      status: "staged" | "sent" | "active" | "applied" | "void";
      user_id: string | null;
    }>();

  if (!promo || promo.status === "void") {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          This link isn&apos;t active
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          The promo you tried to open isn&apos;t on file — it may have expired
          or been replaced. Reach out to the event director for a fresh link.
        </p>
        <div className="mt-6">
          <Link href={"/events" as never}>
            <Button>Browse events</Button>
          </Link>
        </div>
      </main>
    );
  }

  // Advance status once — the RPC-free "sent → active" flip. Applied +
  // active + staged pass through unchanged so a re-hit from the same
  // link doesn't over-write history.
  if (promo.status === "sent") {
    await supabase
      .from("promo_codes")
      .update({ status: "active" })
      .eq("id", promo.id);
  }
  // Funnel: log a `landed` event on every hit. Multiple lands over
  // time still count as separate funnel entries so the client's
  // "where do reviewers drop off" analysis stays intact.
  await supabase
    .from("promo_funnel_events")
    .insert({ promo_id: promo.id, step: "landed" });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Route through signup — the coach signup flow with the target
    // review as the post-auth destination + email pre-filled. Spec:
    // "If no account exists with such an email — create an account
    // with the provided details from step 1 and auto-populate the
    // field user type to Attendee and role to Coach." We use the
    // standard signup form pre-selected to attendee + coach.
    const next = `/events/${promo.event_id}/review?promo=${promo.id}`;
    redirect(
      `/signup?type=attendee&role=coach&email=${encodeURIComponent(promo.email)}&next=${encodeURIComponent(next)}`,
    );
  }

  // Signed in — link the promo to the current user (if not linked)
  // so the attendee dashboard promo tab can render it.
  if (!promo.user_id) {
    await supabase
      .from("promo_codes")
      .update({ user_id: user.id })
      .eq("id", promo.id);
  }

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
    // Event directors + admins can't publish reviews — they've hit a
    // wrong link. Route to the event page and let them read + share.
    redirect(`/events/${promo.event_id}`);
  }

  if (!profile.onboarding_completed) {
    const next = `/events/${promo.event_id}/review?promo=${promo.id}`;
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }

  redirect(`/events/${promo.event_id}/review?promo=${promo.id}`);
}
