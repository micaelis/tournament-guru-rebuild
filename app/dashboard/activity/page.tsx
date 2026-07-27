import Link from "next/link";
import type { Route } from "next";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { createServerAuthClient } from "@/lib/supabase/server";
import { unwrapRows, unwrapRowsLogged } from "@/lib/supabase/unwrap";
import { safeImageSrc } from "@/lib/url";
import { SafeImg } from "@/app/components/ui/SafeImg";
import { TextLink } from "@/app/components/ui";
import { FavoriteButton } from "@/app/components/reviews/FavoriteButton";
import { HeaderPill } from "@/app/components/HeaderPill";
import { Icon } from "@/app/dashboard/icons";
import {
  type Bucket,
  bucketOf,
  datesChip,
  demographicChips,
  deSuffixTitle,
  exactLabel,
  fmtDay,
  mobileLabel,
  relativeLabel,
} from "./format";

/**
 * Attendee recent activity — the 50 most-recently-viewed events
 * (cap enforced by the trim_recently_viewed trigger), rendered as a
 * vertical timeline: day checkpoints (Today / Yesterday / Earlier),
 * the newest entry marked with the accent node.
 */

type ActivityRow = {
  event_id: string;
  viewed_at: string;
  event: {
    id: string;
    title: string;
    host_club: string | null;
    location_formatted: string | null;
    start_date: string | null;
    end_date: string | null;
    logo_url: string | null;
    event_age_groups: { age: string | null; team_gender: string | null }[] | null;
  } | null;
};

/* ── page ───────────────────────────────────────────────────────────── */

export default async function ActivityPage() {
  const { user } = await requireSessionAndProfile();
  const supabase = await createServerAuthClient();
  // unwrap: a failed query must not render as "no recent activity".
  const rows = unwrapRows(
    await supabase
      .from("recently_viewed")
      .select(
        "event_id, viewed_at, event:events!recently_viewed_event_id_fkey(id, title, host_club, location_formatted, start_date, end_date, logo_url, event_age_groups(age, team_gender))",
      )
      .eq("user_id", user.id)
      .order("viewed_at", { ascending: false })
      .limit(50),
    "ActivityPage recently viewed",
  ) as unknown as ActivityRow[];

  // Favorite state for the hearts — chrome, so degrade (logged) rather
  // than take the timeline down. Ids are bounded by the 50-row cap.
  const eventIds = rows.flatMap((r) => (r.event ? [r.event.id] : []));
  let favoritedIds = new Set<string>();
  if (eventIds.length > 0) {
    const favs = unwrapRowsLogged<{ event_id: string }>(
      await supabase
        .from("favorites")
        .select("event_id")
        .eq("user_id", user.id)
        .in("event_id", eventIds),
      "ActivityPage favorites",
    );
    favoritedIds = new Set(favs.map((f) => f.event_id));
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000);
  const bucketLabels: Record<Bucket, string> = {
    today: `Today · ${fmtDay(now)}`,
    yesterday: `Yesterday · ${fmtDay(yesterday)}`,
    earlier: "Earlier",
  };

  // Rows arrive newest-first, so groups fall out in checkpoint order.
  const groups: { bucket: Bucket; rows: ActivityRow[] }[] = [];
  for (const row of rows) {
    const bucket = bucketOf(new Date(row.viewed_at), now);
    const tail = groups[groups.length - 1];
    if (tail && tail.bucket === bucket) tail.rows.push(row);
    else groups.push({ bucket, rows: [row] });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-[var(--font-heading)] text-2xl font-extrabold tracking-tight text-slate-900">
            Activity
          </h1>
          <p className="mt-1 text-[13.5px] text-slate-600">
            A trail of the events you&apos;ve viewed lately — newest first.
          </p>
        </div>
        <HeaderPill
          href="/events"
          size="sm"
          icon={<Icon name="search" className="h-4 w-4 opacity-90" />}
        >
          Browse events
        </HeaderPill>
      </div>

      {rows.length === 0 ? (
        <section className="mt-8" aria-label="No activity yet">
          <div
            className={`${CARD_CLASS} flex flex-col items-center px-6 py-16 text-center`}
          >
            <div className="relative">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                <Icon name="activity" className="h-7 w-7" />
              </span>
              <span className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-red-600 text-white shadow-[0_6px_14px_-4px_rgba(220,38,38,.55)]">
                <Icon name="search" className="h-3 w-3" />
              </span>
            </div>
            <h2 className="mt-5 font-[var(--font-heading)] text-[17px] font-bold text-slate-900">
              Nothing here yet
            </h2>
            <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-600">
              Events you view will land on this timeline, so you can always
              find your way back to one.
            </p>
            <div className="mt-6">
              <HeaderPill href="/events" size="sm">
                Browse events
              </HeaderPill>
            </div>
            <TextLink
              href="/dashboard/favorites"
              className="mt-3.5 text-[12.5px]"
            >
              or see your Favorites
            </TextLink>
          </div>
        </section>
      ) : (
        <section className="mt-8" aria-label="Recently viewed events">
          {groups.map((group, gi) => (
            <div key={group.bucket}>
              <Checkpoint label={bucketLabels[group.bucket]} first={gi === 0} />
              {group.rows.map((row, ri) => {
                const lastOverall =
                  gi === groups.length - 1 && ri === group.rows.length - 1;
                return (
                  <Entry
                    key={row.event_id}
                    row={row}
                    now={now}
                    bucket={group.bucket}
                    newest={gi === 0 && ri === 0}
                    railFades={lastOverall}
                    padBottom={
                      lastOverall
                        ? "pb-2"
                        : ri === group.rows.length - 1
                          ? "pb-6"
                          : "pb-4"
                    }
                    favorited={
                      row.event ? favoritedIds.has(row.event.id) : false
                    }
                  />
                );
              })}
            </div>
          ))}

          <div className="flex">
            <div className="hidden w-28 flex-none sm:block" />
            <div className="w-10 flex-none" />
            <p className="flex-1 pt-2 text-[11.5px] font-medium text-slate-500">
              Your last 50 viewed events are kept here.
            </p>
          </div>
        </section>
      )}

      {/* Newest node's ping halo — motion-gated. */}
      <style>{`
        @keyframes tg-node-ping {
          0% { transform: scale(.55); opacity: 1; }
          70%, 100% { transform: scale(1.25); opacity: 0; }
        }
        .tg-node-now::after {
          content: "";
          position: absolute;
          inset: -6px;
          border-radius: 9999px;
          border: 2px solid rgba(220,38,38,.35);
          animation: tg-node-ping 2.4s cubic-bezier(0,0,.2,1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .tg-node-now::after { animation: none; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ── timeline pieces ────────────────────────────────────────────────── */

const CARD_CLASS =
  "rounded-2xl border border-slate-200 bg-white " +
  "shadow-[0_1px_2px_rgba(15,23,42,.05),0_14px_34px_-22px_rgba(15,23,42,.18)] " +
  "transition-[border-color,box-shadow] duration-150 ease-out";

const CARD_HOVER_CLASS =
  "hover:border-slate-300 hover:shadow-[0_2px_4px_rgba(15,23,42,.06),0_18px_38px_-20px_rgba(15,23,42,.24)]";

function Checkpoint({ label, first }: { label: string; first: boolean }) {
  return (
    <div className="flex">
      <div className="hidden w-28 flex-none sm:block" />
      <div className="relative w-10 flex-none">
        <span
          aria-hidden="true"
          className={`absolute left-1/2 w-px -translate-x-1/2 bg-slate-200 ${
            first ? "bottom-0 top-1/2" : "inset-y-0"
          }`}
        />
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-300 bg-white"
        />
      </div>
      <div className="flex h-10 flex-1 items-center">
        <p className="whitespace-nowrap font-[var(--font-heading)] text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
      </div>
    </div>
  );
}

function Entry({
  row,
  now,
  bucket,
  newest,
  railFades,
  padBottom,
  favorited,
}: {
  row: ActivityRow;
  now: Date;
  bucket: Bucket;
  newest: boolean;
  railFades: boolean;
  padBottom: string;
  favorited: boolean;
}) {
  const viewed = new Date(row.viewed_at);
  const chips = row.event ? demographicChips(row.event.event_age_groups) : [];
  const dates = row.event
    ? datesChip(row.event.start_date, row.event.end_date, now)
    : null;

  return (
    <div className="flex">
      <div className="hidden w-28 flex-none pt-[31px] pr-1 text-right sm:block md:pt-[35px]">
        <p
          className={`text-[12px] font-bold leading-4 ${
            newest ? "text-red-600" : "text-slate-700"
          }`}
        >
          {relativeLabel(viewed, now, bucket)}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-slate-500">
          {exactLabel(viewed, bucket)}
        </p>
      </div>

      <div className="relative w-10 flex-none">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-200"
          style={
            railFades
              ? {
                  background:
                    "linear-gradient(to bottom,#e2e8f0 0%,#e2e8f0 45%,transparent 92%)",
                }
              : undefined
          }
        />
        {newest ? (
          <span
            aria-hidden="true"
            className="tg-node-now absolute left-1/2 top-[33px] h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-red-600 shadow-[0_0_0_4px_rgba(220,38,38,.14)] md:top-[37px]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-[34px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-slate-300 bg-white md:top-[38px]"
          />
        )}
      </div>

      <div className={`min-w-0 flex-1 ${padBottom}`}>
        {row.event ? (
          <article
            className={`${CARD_CLASS} ${CARD_HOVER_CLASS} group relative flex items-center gap-4 p-4 md:p-5`}
          >
            <EventLogo url={row.event.logo_url} title={row.event.title} />
            <div className="min-w-0 flex-1">
              <Link
                href={`/events/${row.event.id}` as Route}
                title={row.event.title}
                className="font-[var(--font-heading)] text-[15px] font-bold leading-snug text-slate-900 transition-colors after:absolute after:inset-0 hover:text-red-600"
              >
                {deSuffixTitle(row.event.title)}
              </Link>
              <p className="mt-0.5 truncate text-[12.5px] text-slate-600">
                {row.event.host_club && <>{row.event.host_club} · </>}
                {row.event.location_formatted ?? "—"}
              </p>
              {chips.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {chips.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-[9px] py-[2.5px] text-[11px] font-bold text-slate-600"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1 text-[11px] font-medium text-slate-500 sm:hidden">
                {mobileLabel(viewed, now, bucket)}
              </p>
            </div>
            {dates && (
              <span
                className={`hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-[11px] py-1 text-[12px] font-semibold md:inline-flex ${
                  dates.ended ? "text-slate-500" : "text-slate-700"
                }`}
              >
                <Icon name="calendar" className="h-3.5 w-3.5 text-slate-500" />
                {dates.label}
              </span>
            )}
            <span className="relative z-10">
              <FavoriteButton
                variant="icon"
                eventId={row.event.id}
                initialFavorited={favorited}
              />
            </span>
            <Icon
              name="chevron-right"
              className="h-4 w-4 flex-none text-slate-400 transition-colors group-hover:text-red-600"
            />
          </article>
        ) : (
          <div className={`${CARD_CLASS} p-4 md:p-5`}>
            <p className="text-sm text-slate-400">Event removed.</p>
            <p className="mt-1 text-[11px] font-medium text-slate-500 sm:hidden">
              {mobileLabel(viewed, now, bucket)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function EventLogo({ url, title }: { url: string | null; title: string }) {
  const safe = safeImageSrc(url);
  return (
    <span className="grid h-12 w-12 flex-none place-items-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
      <SafeImg
        src={safe ?? undefined}
        alt=""
        className="h-full w-full object-cover"
        fallback={
          <span className="font-[var(--font-heading)] text-sm font-extrabold text-slate-500">
            {title[0]?.toUpperCase() ?? "T"}
          </span>
        }
      />
    </span>
  );
}
