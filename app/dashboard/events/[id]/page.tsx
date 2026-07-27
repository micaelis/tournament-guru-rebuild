import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import {
  Card,
  MetricStrip,
  SafeImg,
  StarRating,
  StatusPill,
  TextLink,
  eventStatusTone,
  type MetricTileData,
} from "@/app/components/ui";
import { Icon } from "@/app/dashboard/icons";
import { GeneralAdToggle } from "../GeneralAdToggle";
import {
  deriveEventStatus,
  getEventForEdit,
  listSeasons,
  type EventImageRow,
} from "../event-queries";
import {
  COMPETITION_LEVELS,
  EVENT_FEATURES,
  PREMIUM_IMAGE_LIMIT,
  SURFACES,
} from "@/lib/enums";
import { safeExternalUrl, safeImageSrc } from "@/lib/url";
import { derivePriceRange } from "@/lib/format-price";
import {
  KeyDatesTimeline,
  buildKeyDateRows,
} from "@/app/components/events/KeyDatesTimeline";
import { DetailsActionPanel } from "./details-actions";
import {
  ACCENT_LINK_CLASS,
  AgeGroupCard,
  ButtonLink,
  EventLogo,
  FactCell,
  InfoTip,
  ListingRecord,
  LocationCard,
  MediaAddTile,
  MediaVideoTile,
  MetaItem,
  SectionCard,
  SponsorTile,
  SummaryBand,
  Tag,
  capitalize,
  formatDateRange,
  startsInLabel,
  usDate,
} from "./details-parts";

type Params = { id: string };

/**
 * Internal event details — the management surface an ED / Admin lands
 * on after saving: hero (identity + action panel), the dark summary
 * band, then the About / Age groups / Media / Sponsors / Reviews
 * sections with a Location + Listing-record rail. Public event details
 * live at /events/[id].
 */
export default async function EventDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { profile, user } = await requireSessionAndProfile();
  if (profile.user_type === "attendee") redirect("/events");
  const { id } = await params;
  const [payload, seasons] = await Promise.all([
    getEventForEdit(id),
    listSeasons(),
  ]);
  if (!payload) notFound();

  const { event, ageGroups, sponsors, images } = payload;
  const status = deriveEventStatus(event);
  const seasonLabel =
    seasons.find((s) => s.id === event.season_id)?.label ?? null;
  const website = safeExternalUrl(event.website_url);
  const isAdmin = profile.user_type === "admin";
  const canManage =
    isAdmin ||
    (profile.user_type === "event_director" && event.owner_id === user.id);

  const editHref = `/dashboard/events/${event.id}/edit`;
  const publicHref = `/events/${event.id}`;
  const priceRange = derivePriceRange(ageGroups);
  const dateRange = formatDateRange(event.start_date, event.end_date);
  const startsIn = status === "Upcoming" ? startsInLabel(event.start_date) : null;

  const levelLabels = payload.competitionLevels.map(
    (l) => COMPETITION_LEVELS.find((c) => c.value === l)?.label ?? l,
  );
  const surfaceLabels = payload.surfaces.map(
    (s) => SURFACES.find((sv) => sv.value === s)?.label ?? s,
  );
  const featureLabels = payload.features.map(
    (f) => EVENT_FEATURES.find((fv) => fv.value === f)?.label ?? f,
  );
  // Same rows as the public page's premium timeline; [] when the ED
  // entered no milestones (the derived kick-off alone doesn't warrant
  // the section).
  const keyDateRows = event.is_premium
    ? buildKeyDateRows(payload.milestones, event.start_date)
    : [];

  const editAction = (label: string) => (
    <ButtonLink href={editHref}>
      <Icon name="edit" className="h-3.5 w-3.5 text-slate-500" />
      {label}
    </ButtonLink>
  );

  return (
    <div className="space-y-5">
      <div>
        <TextLink href={"/dashboard/events" as Route} className="text-[13px]">
          ← Back to events
        </TextLink>
      </div>

      {/* ── hero ── */}
      <Card className="relative overflow-hidden p-6">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-red-600 via-red-400 to-amber-400"
        />
        <div className="flex flex-wrap gap-x-7 gap-y-6 lg:flex-nowrap">
          <div className="flex min-w-0 flex-1 items-start gap-5">
            <EventLogo
              src={safeImageSrc(event.logo_url)}
              title={event.title || "Untitled event"}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {event.host_club && (
                  <span className="text-[13.5px] font-medium text-slate-500">
                    Hosted by{" "}
                    <span className="font-[var(--font-heading)] text-[14.5px] font-extrabold tracking-tight text-slate-900">
                      {event.host_club}
                    </span>
                  </span>
                )}
                <StatusPill tone={eventStatusTone(status)}>{status}</StatusPill>
                {event.is_premium && (
                  <StatusPill tone="premium">Premium</StatusPill>
                )}
                {event.is_general_ad && (
                  <StatusPill tone="spotlight">Spotlight</StatusPill>
                )}
                {isAdmin && (
                  <GeneralAdToggle
                    eventId={event.id}
                    enabled={event.is_general_ad}
                  />
                )}
              </div>

              <h1
                className="mt-2.5 font-[var(--font-heading)] text-[clamp(25px,2.6vw,33px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-slate-900"
                style={{ textWrap: "balance" }}
              >
                {event.title || "Untitled event"}
              </h1>

              <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[13.5px] font-medium text-slate-600">
                <MetaItem icon="calendar">
                  {dateRange ?? "No dates set yet"}
                  {startsIn && (
                    <>
                      {" "}
                      · <span className="font-semibold text-slate-800">{startsIn}</span>
                    </>
                  )}
                </MetaItem>
                {event.location_formatted && (
                  <MetaItem icon="pin">{event.location_formatted}</MetaItem>
                )}
                {seasonLabel && (
                  <MetaItem icon="tag">{seasonLabel} season</MetaItem>
                )}
                {event.registration_deadline && (
                  <MetaItem icon="clock">
                    Registration closes {usDate(event.registration_deadline)}
                  </MetaItem>
                )}
              </div>

              <div className="mt-4">
                <Link
                  href={publicHref as Route}
                  target="_blank"
                  className={ACCENT_LINK_CLASS}
                >
                  <Icon name="external" className="h-4 w-4" />
                  View public page
                </Link>
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 lg:w-[252px] lg:border-l lg:border-slate-100 lg:pl-6">
            <DetailsActionPanel
              eventId={event.id}
              eventTitle={event.title || "Untitled event"}
              lifecycle={event.lifecycle}
              isPremium={event.is_premium}
              canManage={canManage}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </Card>

      {event.lifecycle === "canceled" && event.cancel_reason && (
        <Card className="border-red-200 bg-red-50">
          <div className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-800">
              Event canceled
            </p>
            <p className="mt-2 text-sm text-red-800">{event.cancel_reason}</p>
          </div>
        </Card>
      )}

      {/* ── summary band ── */}
      <SummaryBand
        eventId={event.id}
        reviewCount={event.review_count}
        generalRating={numOrNull(event.general_rating)}
        coachRating={numOrNull(event.coach_rating)}
        attendeeRating={numOrNull(event.attendee_rating)}
        wouldReturnPct={numOrNull(event.would_return_pct)}
        priceRange={priceRange}
        divisionCount={ageGroups.length}
        teams={event.num_teams_this_year}
      />

      {/* ── main grid ── */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_324px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* About & key info */}
          <SectionCard
            icon="info"
            iconClass="bg-indigo-50 text-indigo-600"
            title="About this event"
            action={editAction("Edit details")}
          >
            <p className="mt-3 max-w-[62ch] text-[14px] leading-[1.7] text-slate-600">
              {event.description || (
                <span className="text-slate-400">No description yet.</span>
              )}
            </p>

            <div className="my-5 h-px bg-slate-100" />

            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <FactCell label="Season">
                {seasonLabel ?? "—"}
              </FactCell>
              <FactCell label="Region">
                {event.region ? `Region ${event.region}` : "—"}
              </FactCell>
              <FactCell label="Website">
                {website ? (
                  <TextLink
                    href={website}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="break-all text-[13.5px]"
                  >
                    {event.website_url}
                  </TextLink>
                ) : (
                  "—"
                )}
              </FactCell>
              <FactCell label="Registration deadline">
                {event.registration_deadline
                  ? usDate(event.registration_deadline)
                  : "—"}
              </FactCell>
              <FactCell label="Competition levels">
                {levelLabels.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {levelLabels.map((l) => (
                      <Tag key={l}>{l}</Tag>
                    ))}
                  </span>
                ) : (
                  "—"
                )}
              </FactCell>
              <FactCell label="Surfaces">
                {surfaceLabels.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {surfaceLabels.map((s) => (
                      <Tag key={s}>{s}</Tag>
                    ))}
                  </span>
                ) : (
                  "—"
                )}
              </FactCell>
              {event.is_premium && (
                <FactCell label="Premium features" span2>
                  {featureLabels.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {featureLabels.map((f) => (
                        <Tag key={f}>{f}</Tag>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )}
                </FactCell>
              )}
            </div>
          </SectionCard>

          {/* Age groups & pricing */}
          {ageGroups.length > 0 && (
            <SectionCard
              icon="tag"
              iconClass="bg-pink-50 text-pink-600"
              title="Age groups & pricing"
              sub={
                <>
                  {ageGroups.length} division
                  {ageGroups.length === 1 ? "" : "s"}
                  {priceRange && <> · {priceRange} per team</>}
                  <InfoTip label="About these prices">
                    Prices are per team, exactly as shown on your public page.
                  </InfoTip>
                </>
              }
              action={editAction("Edit divisions")}
            >
              <div
                className="mt-4 grid gap-3"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(232px, 1fr))",
                }}
              >
                {ageGroups.map((g, i) => (
                  <AgeGroupCard
                    key={g.id}
                    age={g.age}
                    label={`${capitalize(g.team_gender)} · ${g.field_size}`}
                    price={g.price}
                    index={i}
                  />
                ))}
              </div>
            </SectionCard>
          )}

          {/* Key dates & deadlines (premium; needs ≥1 ED milestone) */}
          {keyDateRows.length > 0 && (
            <SectionCard
              icon="calendar"
              iconClass="bg-red-50 text-red-600"
              title="Key dates & deadlines"
              sub={
                <>
                  {payload.milestones.length} milestone
                  {payload.milestones.length === 1 ? "" : "s"} + the kick-off ·{" "}
                  <span className="font-medium text-slate-400">
                    shown on your public page
                  </span>
                </>
              }
              action={editAction("Edit dates")}
            >
              <div className="mt-5">
                <KeyDatesTimeline rows={keyDateRows} />
              </div>
            </SectionCard>
          )}

          {/* Media (premium: video + photo gallery) */}
          {event.is_premium && (
            <MediaSection
              videoHref={safeExternalUrl(event.video_url)}
              images={images}
              editHref={editHref}
              canManage={canManage}
            />
          )}

          {/* Sponsors */}
          {sponsors.length > 0 && (
            <SectionCard
              icon="award"
              iconClass="bg-sky-50 text-sky-600"
              title="Sponsors"
              sub={`${sponsors.length} sponsor${sponsors.length === 1 ? "" : "s"} on the public page`}
              action={editAction("Edit sponsors")}
            >
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {sponsors.map((s) => (
                  <SponsorTile
                    key={s.id}
                    name={s.name}
                    href={safeExternalUrl(s.link)}
                    logoSrc={safeImageSrc(s.logo_url)}
                  />
                ))}
              </div>
            </SectionCard>
          )}

          {/* Reviews — the category strip stays as-is for now.
              TODO: the shared public-page reviews component lands here
              once it's reworked to fold in the internal-page elements
              (director reply, role filter) — see
              design/ed-event-details-redesign.html. */}
          {event.review_count > 0 && (
            <SectionCard
              icon="star"
              iconClass="bg-amber-50 text-amber-500"
              title="Reviews"
              action={
                <ButtonLink href={`${publicHref}#reviews`}>
                  Show all on your public page
                  <Icon name="external" className="h-3.5 w-3.5 text-slate-500" />
                </ButtonLink>
              }
            >
              <div className="mt-3 flex items-center gap-3.5">
                <span className="font-[var(--font-heading)] text-[40px] font-extrabold leading-none tracking-tight text-slate-900">
                  {(numOrNull(event.general_rating) ?? 0).toFixed(2)}
                </span>
                <div>
                  <StarRating
                    value={numOrNull(event.general_rating) ?? 0}
                    size={20}
                    showNumber={false}
                  />
                  <p className="mt-1 text-[12.5px] font-semibold text-slate-500">
                    Overall rating ·{" "}
                    <span className="font-bold text-slate-700">
                      {event.review_count} verified review
                      {event.review_count === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <MetricStrip title="Ratings" tiles={buildEventTiles(event)} />
              </div>
            </SectionCard>
          )}
        </div>

        {/* ── right rail ── */}
        <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-24">
          <LocationCard
            location={event.location_formatted}
            editHref={editHref}
            canEdit={canManage}
          />
          <ListingRecord
            lifecycle={event.lifecycle}
            createdAt={event.created_at}
            updatedAt={event.updated_at}
            eventId={event.id}
          />
        </aside>
      </div>
    </div>
  );
}

function MediaSection({
  videoHref,
  images,
  editHref,
  canManage,
}: {
  videoHref: string | null;
  images: EventImageRow[];
  editHref: string;
  canManage: boolean;
}) {
  const photos = images
    .map((img) => ({ id: img.id, src: safeImageSrc(img.url) }))
    .filter((p): p is { id: string; src: string } => p.src != null);
  const slotsOpen = Math.max(0, PREMIUM_IMAGE_LIMIT - photos.length);
  return (
    <SectionCard
      icon="image"
      iconClass="bg-violet-50 text-violet-600"
      title="Media"
      sub={
        <>
          {videoHref ? "1 video · " : ""}
          {photos.length} of {PREMIUM_IMAGE_LIMIT} photos ·{" "}
          <span className="font-medium text-slate-400">
            shown on your public page
          </span>
        </>
      }
      action={
        <ButtonLink href={editHref}>
          <Icon name="edit" className="h-3.5 w-3.5 text-slate-500" />
          Edit media
        </ButtonLink>
      }
    >
      {videoHref && <MediaVideoTile href={videoHref} />}
      {(photos.length > 0 || canManage) && (
        <div
          className={`${videoHref ? "mt-2.5" : "mt-4"} grid grid-cols-2 gap-2.5 sm:grid-cols-4`}
        >
          {photos.map((p) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-[10px] border border-slate-200 bg-slate-100"
            >
              <SafeImg
                src={p.src}
                alt="Event photo"
                className="aspect-[10/7] w-full object-cover"
                fallback={
                  <span className="grid aspect-[10/7] w-full place-items-center text-slate-300">
                    <Icon name="image" className="h-6 w-6" />
                  </span>
                }
              />
            </div>
          ))}
          {canManage && slotsOpen > 0 && (
            <MediaAddTile
              editHref={editHref}
              slotsOpen={slotsOpen}
              first={photos.length === 0}
            />
          )}
        </div>
      )}
    </SectionCard>
  );
}

function buildEventTiles(event: {
  review_count: number;
  avg_fields: number | null;
  avg_facilities: number | null;
  avg_management: number | null;
  avg_competition: number | null;
  avg_diversity: number | null;
  avg_cost_value: number | null;
}): MetricTileData[] {
  return [
    { label: "Fields", value: event.avg_fields, count: event.review_count },
    { label: "Facilities", value: event.avg_facilities, count: event.review_count },
    { label: "Management", value: event.avg_management, count: event.review_count },
    { label: "Competition", value: event.avg_competition, count: event.review_count },
    { label: "Diversity", value: event.avg_diversity, count: event.review_count },
    {
      label: "Cost / value",
      value: event.avg_cost_value,
      count: event.review_count,
    },
  ];
}

/** Postgres numerics can deserialize as strings — coerce for display. */
function numOrNull(v: number | string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
