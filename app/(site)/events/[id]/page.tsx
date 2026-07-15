import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { createAnonServerClient } from "@/lib/supabase/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import {
  StatusPill,
  StarRating,
  Button,
  eventStatusTone,
} from "@/app/components/ui";
import { deriveEventStatus } from "@/app/dashboard/events/event-shared";
import {
  getMyReviewForEvent,
  getUserHelpfulSet,
  listCommentsForReview,
  listReviewsForEvent,
} from "@/lib/reviews/queries";
import { fetchBannedWords } from "@/lib/reviews/banned-words";
import { safeExternalUrl, safeImageSrc as safeImageSrcSmall } from "@/lib/url";
import { formatRating } from "@/lib/reviews/shared";
import { ReviewCard } from "@/app/components/reviews/ReviewCard";
import { hasPendingClaim } from "@/lib/claims/queries";
import { ClaimEventCta } from "./ClaimEventCta";
import { recordRecentView } from "@/lib/user-events/actions";
import { FavoriteButton } from "@/app/components/reviews/FavoriteButton";

type Params = { id: string };

/**
 * Minimal public event page. Slice 5 delivers the full media grid,
 * sponsors, host-info sidebar, and premium extras — this page ships
 * enough of it to host the review write flow (S2.2) and the review
 * cards + comments (S2.3). The header, description, and reviews list
 * all live here already so the surface is walkable.
 */
export default async function PublicEventPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const supabaseAnon = createAnonServerClient();
  const { data: event } = await supabaseAnon
    .from("events")
    .select(
      "id, tournament_id, owner_id, title, description, host_club, start_date, end_date, location_formatted, website_url, logo_url, region, lifecycle, is_premium, is_sponsored, cancel_reason, general_rating, review_count, avg_fields, avg_facilities, avg_management, avg_competition, avg_diversity, avg_cost_value, would_return_pct",
    )
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const eventRow = event as {
    tournament_id?: string;
    owner_id?: string | null;
  } & Record<string, unknown>;
  const status = deriveEventStatus(
    event as { lifecycle: "draft" | "active" | "canceled"; start_date: string | null; end_date: string | null },
  );

  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [reviews, myReview, bannedWords, sponsors, milestones, owner, images] =
    await Promise.all([
      listReviewsForEvent(id),
      user ? getMyReviewForEvent(user.id, id) : Promise.resolve(null),
      fetchBannedWords(),
      supabaseAnon
        .from("sponsors")
        .select("id, name, link, logo_url")
        .eq("event_id", id),
      supabaseAnon
        .from("event_milestones")
        .select("id, title, description, milestone_date, sort_order")
        .eq("event_id", id)
        .order("sort_order"),
      eventRow.owner_id
        ? supabaseAnon
            .from("profiles")
            .select("id, first_name, last_name, organization_title, org_description, org_logo_url")
            .eq("id", eventRow.owner_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAnon
        .from("event_images")
        .select("id, url, sort_order")
        .eq("event_id", id)
        .order("sort_order"),
    ]);
  const sponsorRows = (sponsors.data ?? []) as {
    id: string;
    name: string;
    link: string;
    logo_url: string;
  }[];
  const milestoneRows = (milestones.data ?? []) as {
    id: string;
    title: string;
    description: string | null;
    milestone_date: string | null;
  }[];
  const imageRows = (images.data ?? []) as { id: string; url: string }[];
  const ownerProfile = (owner.data ?? null) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    organization_title: string | null;
    org_description: string | null;
    org_logo_url: string | null;
  } | null;

  if (user) {
    // Fire-and-forget: log the view (upsert bumps viewed_at). No
    // await into a Promise.all so page render stays snappy.
    void recordRecentView(id);
  }
  const favoritedResult = user
    ? await supabase
        .from("favorites")
        .select("event_id")
        .eq("user_id", user.id)
        .eq("event_id", id)
        .maybeSingle()
    : { data: null };
  const favorited = Boolean(favoritedResult.data);

  const claimCtaState: "anon" | "requestable" | "requested" | "claimed" =
    eventRow.owner_id
      ? "claimed"
      : !user
        ? "anon"
        : (await (async () => {
            const { data: p } = await supabase
              .from("profiles")
              .select("user_type")
              .eq("id", user.id)
              .maybeSingle<{ user_type: string }>();
            if (p?.user_type !== "event_director") return "claimed" as const;
            const has = eventRow.tournament_id
              ? await hasPendingClaim(user.id, eventRow.tournament_id)
              : false;
            return has ? ("requested" as const) : ("requestable" as const);
          })());

  const [commentsByReview, helpfulSet, isAdmin] = await Promise.all([
    Promise.all(
      reviews.map(async (r) => ({ id: r.id, comments: await listCommentsForReview(r.id) })),
    ),
    user
      ? getUserHelpfulSet(user.id, reviews.map((r) => r.id))
      : Promise.resolve(new Set<string>()),
    (async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle<{ user_type: "attendee" | "event_director" | "admin" }>();
      return data?.user_type === "admin";
    })(),
  ]);
  const commentsMap = new Map(commentsByReview.map((r) => [r.id, r.comments]));

  const website = safeExternalUrl((event as { website_url: string | null }).website_url);
  const ev = event as {
    title: string;
    description: string | null;
    host_club: string | null;
    start_date: string | null;
    end_date: string | null;
    location_formatted: string | null;
    website_url: string | null;
    lifecycle: "draft" | "active" | "canceled";
    is_premium: boolean;
    is_sponsored: boolean;
    cancel_reason: string | null;
    general_rating: number | null;
    review_count: number;
    would_return_pct: number | null;
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={eventStatusTone(status)}>{status}</StatusPill>
        {ev.is_premium && <StatusPill tone="warning">Premium</StatusPill>}
      </div>
      <h1 className="mt-4 font-[var(--font-heading)] text-4xl font-extrabold text-slate-900 md:text-5xl">
        {ev.title}
      </h1>
      <p className="mt-3 text-sm text-slate-500">
        {ev.host_club && <>Hosted by {ev.host_club} · </>}
        {formatDateRange(ev.start_date, ev.end_date)}
        {ev.location_formatted ? ` · ${ev.location_formatted}` : ""}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {ev.review_count > 0 ? (
          <StarRating
            value={ev.general_rating ?? 0}
            count={ev.review_count}
          />
        ) : (
          <p className="text-sm text-slate-500">
            No reviews yet — be the first to write one.
          </p>
        )}
        {ev.would_return_pct !== null && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">
            {formatRating(ev.would_return_pct)}% would return
          </span>
        )}
        <ClaimEventCta eventId={id} state={claimCtaState} />
        <FavoriteButton
          eventId={id}
          initialFavorited={favorited}
          disabled={!user}
        />
      </div>

      {ev.lifecycle === "canceled" && ev.cancel_reason && (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-800">
            Event canceled
          </p>
          <p className="mt-2 text-sm text-red-800">{ev.cancel_reason}</p>
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          {imageRows.length > 0 && <MediaGrid images={imageRows} />}
          {ev.description && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
                About this event
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm text-slate-700">
                {ev.description}
              </p>
              {website && (
                <p className="mt-4">
                  <a
                    href={website}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="text-sm font-semibold text-red-600 underline"
                  >
                    {ev.website_url}
                  </a>
                </p>
              )}
            </div>
          )}
          {milestoneRows.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
                Key dates
              </h2>
              <ul className="mt-3 space-y-3">
                {milestoneRows.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-none last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {m.title}
                      </p>
                      {m.description && (
                        <p className="text-xs text-slate-500">{m.description}</p>
                      )}
                    </div>
                    {m.milestone_date && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {formatDate(m.milestone_date)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sponsorRows.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
                Sponsors
              </h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {sponsorRows.map((s) => {
                  const link = safeExternalUrl(s.link);
                  const logo = safeImageSrcSmall(s.logo_url);
                  return (
                    <a
                      key={s.id}
                      href={link ?? "#"}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400"
                    >
                      {logo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logo}
                          alt=""
                          className="h-6 w-6 rounded object-cover"
                        />
                      )}
                      {s.name}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <aside className="space-y-6">
          {ownerProfile && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Hosted by
              </p>
              <div className="mt-2 flex items-center gap-3">
                {ownerProfile.org_logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={safeImageSrcSmall(ownerProfile.org_logo_url) ?? ""}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-500">
                    {ownerProfile.organization_title?.[0] ?? "?"}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {ownerProfile.organization_title ??
                      [ownerProfile.first_name, ownerProfile.last_name]
                        .filter(Boolean)
                        .join(" ")}
                  </p>
                  <Link
                    href={`/directors/${ownerProfile.id}` as Route}
                    className="text-xs text-red-600 underline"
                  >
                    View profile
                  </Link>
                </div>
              </div>
              {ownerProfile.org_description && (
                <p className="mt-3 text-xs text-slate-600">
                  {ownerProfile.org_description}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>

      <section className="mt-12">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
            Reviews {ev.review_count > 0 && <span className="text-slate-400">({ev.review_count})</span>}
          </h2>
          <div className="flex gap-2">
            {myReview ? (
              <Link href={`/events/${id}/review` as Route}>
                <Button variant="ghost">Edit your review</Button>
              </Link>
            ) : (
              <Link href={`/events/${id}/review` as Route}>
                <Button>Write a review</Button>
              </Link>
            )}
          </div>
        </header>

        {reviews.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No reviews yet. Share what you experienced at this event.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {reviews.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                comments={commentsMap.get(r.id) ?? []}
                currentUserId={user?.id ?? null}
                isAdmin={isAdmin}
                helpful={helpfulSet.has(r.id)}
                bannedWords={bannedWords}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function MediaGrid({
  images,
}: {
  images: { id: string; url: string }[];
}) {
  const safe = images
    .map((i) => ({ id: i.id, url: safeImageSrcSmall(i.url) }))
    .filter((i): i is { id: string; url: string } => Boolean(i.url));
  if (safe.length === 0) return null;
  const [first, ...rest] = safe;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={first.url}
        alt=""
        className="col-span-full h-64 w-full rounded-2xl object-cover md:col-span-1 md:h-72"
      />
      <div className="grid grid-cols-2 gap-3">
        {rest.slice(0, 4).map((img) => (
          <img
            key={img.id}
            src={img.url}
            alt=""
            className="h-36 w-full rounded-xl object-cover"
          />
        ))}
      </div>
    </div>
  );
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  if (start && end && start === end) return formatDate(start);
  return [start ? formatDate(start) : "?", end ? formatDate(end) : "?"].join(
    " – ",
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
