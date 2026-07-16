import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import {
  Button,
  Card,
  MetricStrip,
  StarRating,
  StatusPill,
  eventStatusTone,
  type MetricTileData,
} from "@/app/components/ui";
import { EventActions } from "../EventActions";
import {
  deriveEventStatus,
  getEventForEdit,
  listSeasons,
} from "../event-queries";
import {
  COMPETITION_LEVELS,
  EVENT_FEATURES,
  SURFACES,
} from "@/lib/enums";
import { safeExternalUrl } from "@/lib/url";

type Params = { id: string };

/**
 * Internal event details — the read-only surface an ED / Admin lands
 * on after saving. Every event field visible, plus created/modified
 * stamps and the action bar (Edit / Duplicate / Copy Link / Cancel /
 * Delete). Public event details live at /events/[id] (Slice 5).
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

  const { event } = payload;
  const status = deriveEventStatus(event);
  const seasonLabel = seasons.find((s) => s.id === event.season_id)?.label ?? "—";
  const website = safeExternalUrl(event.website_url);
  const canManage =
    profile.user_type === "admin" ||
    (profile.user_type === "event_director" && event.owner_id === user.id);

  const levelLabels = payload.competitionLevels.map(
    (l) => COMPETITION_LEVELS.find((c) => c.value === l)?.label ?? l,
  );
  const surfaceLabels = payload.surfaces.map(
    (s) => SURFACES.find((sv) => sv.value === s)?.label ?? s,
  );
  const featureLabels = payload.features.map(
    (f) => EVENT_FEATURES.find((fv) => fv.value === f)?.label ?? f,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={eventStatusTone(status)}>{status}</StatusPill>
            {event.is_premium && <StatusPill tone="warning">Premium</StatusPill>}
          </div>
          <h1 className="mt-3 font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
            {event.title || "Untitled event"}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-slate-500">
            {event.host_club && <>Hosted by {event.host_club} · </>}
            {seasonLabel} season · {formatDateRange(event.start_date, event.end_date)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {event.review_count > 0 ? (
            <StarRating
              value={event.general_rating ?? 0}
              count={event.review_count}
            />
          ) : (
            <span className="text-xs text-slate-400">No reviews yet</span>
          )}
          <EventActions
            eventId={event.id}
            eventTitle={event.title || "Untitled event"}
            lifecycle={event.lifecycle}
            isPremium={event.is_premium}
            canManage={canManage}
          />
        </div>
      </div>

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

      {event.review_count > 0 && (
        <Card>
          <div className="p-5">
            <MetricStrip title="Ratings" tiles={buildEventTiles(event)} />
          </div>
        </Card>
      )}

      <Card>
        <div className="grid gap-6 p-6 md:grid-cols-2">
          <ReadOnlyField label="Description" value={event.description ?? "—"} />
          <ReadOnlyField
            label="Website"
            value={
              website ? (
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer nofollow"
                  className="font-semibold text-red-600 underline"
                >
                  {event.website_url}
                </a>
              ) : (
                "—"
              )
            }
          />
          <ReadOnlyField label="Region" value={event.region ?? "—"} />
          <ReadOnlyField label="Season" value={seasonLabel} />
          <ReadOnlyField
            label="Location"
            value={event.location_formatted ?? "—"}
          />
          <ReadOnlyField
            label="Teams (this year)"
            value={event.num_teams_this_year ?? "—"}
          />
          <ReadOnlyField
            label="Registration deadline"
            value={event.registration_deadline ?? "—"}
          />
          <ReadOnlyField
            label="Competition levels"
            value={levelLabels.length ? levelLabels.join(", ") : "—"}
          />
          <ReadOnlyField
            label="Surfaces"
            value={surfaceLabels.length ? surfaceLabels.join(", ") : "—"}
          />
          {event.is_premium && (
            <ReadOnlyField
              label="Premium features"
              value={featureLabels.length ? featureLabels.join(", ") : "—"}
            />
          )}
        </div>
      </Card>

      {payload.ageGroups.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
              Age groups
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {payload.ageGroups.map((g) => (
                <div
                  key={g.id}
                  className="rounded-xl border border-slate-200 p-3 text-sm"
                >
                  <p className="font-bold text-slate-900">
                    {capitalize(g.team_gender)} · {g.age} · {g.field_size}
                  </p>
                  <p className="text-slate-500">${g.price}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {payload.sponsors.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
              Sponsors
            </h3>
            <div className="mt-4 flex flex-wrap gap-3">
              {payload.sponsors.map((s) => (
                <a
                  key={s.id}
                  href={safeExternalUrl(s.link) ?? "#"}
                  target="_blank"
                  rel="noreferrer nofollow"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400"
                >
                  {s.name}
                </a>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-xs text-slate-500">
          <span>Created {formatTimestamp(event.created_at)}</span>
          <span>Last modified {formatTimestamp(event.updated_at)}</span>
        </div>
      </Card>

      <div className="flex justify-between">
        <Link href={"/dashboard/events" as Route}>
          <Button variant="ghost">← Back to events</Button>
        </Link>
        <Link href={`/dashboard/events/${event.id}/edit` as Route}>
          <Button>Edit event</Button>
        </Link>
      </div>
    </div>
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

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm text-slate-800">{value}</div>
    </div>
  );
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "no dates set";
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

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
