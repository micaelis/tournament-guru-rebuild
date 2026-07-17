"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerAuthClient } from "@/lib/supabase/server";
import { parseGeoFields } from "@/lib/geo";
import { safeExternalUrl, safeImageSrc } from "@/lib/url";
import {
  AGE_BRACKETS,
  CANCEL_REASON_MAX,
  COMPETITION_LEVELS,
  EVENT_FEATURES,
  EVENT_REGIONS,
  FIELD_SIZES,
  FREE_IMAGE_LIMIT,
  PREMIUM_IMAGE_LIMIT,
  SURFACES,
  TEAM_GENDERS,
} from "@/lib/enums";

export type EventFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  createdId?: string;
};

export type AgeGroupInput = {
  team_gender: string;
  age: string;
  price: number;
  field_size: string;
};

export type SponsorInput = {
  name: string;
  link: string;
  logo_url: string;
};

/**
 * Save an event as draft OR publish it. Draft mode only requires the
 * title (spec: "only the event title is mandatory"); publish enforces
 * every mandatory field + end_date >= start_date.
 *
 * The action is a single mutation: it upserts the base event, then
 * replaces every child collection (age groups / sponsors / competition
 * levels / surfaces / features / images). Replace-all lets the form
 * treat child rows as pure state — the client sends the whole set every
 * time and the server never has to reconcile per-row diffs.
 */
export async function saveEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const intent = String(formData.get("intent") ?? "draft") as
    | "draft"
    | "publish"
    | "update";
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const eventId = String(formData.get("event_id") ?? "");

  const isNew = !eventId;
  if (isNew && !tournamentId) {
    return { error: "Missing tournament — reopen this form from the tournament card." };
  }

  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Hidden Places payload ("place" prefix — the visible state input owns
  // the location_state_abbr name, so its geo twin is dropped here).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { location_state_abbr, ...geo } = parseGeoFields(
    formData,
    "place",
  );

  // Base fields — parsed once, validated below.
  const base = {
    tournament_id: tournamentId || undefined,
    title: str(formData, "title"),
    logo_url: safeImageSrc(str(formData, "logo_url")) ?? null,
    website_url: safeExternalUrl(str(formData, "website_url")) ?? null,
    host_club: str(formData, "host_club") || null,
    start_date: str(formData, "start_date") || null,
    end_date: str(formData, "end_date") || null,
    registration_deadline: str(formData, "registration_deadline") || null,
    description: str(formData, "description") || null,
    location_formatted: str(formData, "location_formatted") || null,
    location_state_abbr: str(formData, "location_state_abbr").slice(0, 2) || null,
    ...geo,
    num_teams_this_year: numOrNull(formData, "num_teams_this_year"),
    region: (str(formData, "region") || null) as
      | "I"
      | "II"
      | "III"
      | "IV"
      | null,
    season_id: str(formData, "season_id") || null,
    // Premium fields — safe to write on non-premium events too since
    // they stay hidden from the public until is_premium flips. On save,
    // the DB column simply carries the value.
    video_url: safeExternalUrl(str(formData, "video_url")) ?? null,
    teams_this_year_url:
      safeExternalUrl(str(formData, "teams_this_year_url")) ?? null,
    teams_prev_year_url:
      safeExternalUrl(str(formData, "teams_prev_year_url")) ?? null,
    registration_url:
      safeExternalUrl(str(formData, "registration_url")) ?? null,
    teams_attended_prev_year: numOrNull(formData, "teams_attended_prev_year"),
  };

  // Child collections come across as JSON blobs.
  const ageGroups = parseJson<AgeGroupInput[]>(formData.get("age_groups")) ?? [];
  const sponsors = parseJson<SponsorInput[]>(formData.get("sponsors")) ?? [];
  const levels = parseJson<string[]>(formData.get("competition_levels")) ?? [];
  const surfaces = parseJson<string[]>(formData.get("surfaces")) ?? [];
  const features = parseJson<string[]>(formData.get("features")) ?? [];
  const images = parseJson<string[]>(formData.get("images")) ?? [];

  const fieldErrors: Record<string, string> = {};

  // Draft requires only a title. Publish enforces everything.
  if (!base.title) fieldErrors.title = "Title is required.";

  if (intent === "publish") {
    if (!base.logo_url) fieldErrors.logo_url = "Add a logo to publish.";
    if (!base.website_url) fieldErrors.website_url = "Event website is required.";
    if (!base.host_club) fieldErrors.host_club = "Host club is required.";
    if (!base.start_date) fieldErrors.start_date = "Starting date is required.";
    if (!base.end_date) fieldErrors.end_date = "Ending date is required.";
    if (base.start_date && base.end_date && base.end_date < base.start_date) {
      fieldErrors.end_date = "End date must be on or after the start date.";
    }
    if (!base.description) fieldErrors.description = "Description is required.";
    if (!base.location_formatted)
      fieldErrors.location_formatted = "Location is required.";
    if (!base.region) fieldErrors.region = "Region is required.";
    if (!base.season_id) fieldErrors.season_id = "Season is required.";
    if (levels.length === 0) fieldErrors.competition_levels =
      "Select at least one competition level.";
    if (surfaces.length === 0) fieldErrors.surfaces = "Pick at least one surface.";
  }

  // Cross-validate child rows even for drafts — invalid values are a bug
  // regardless of publish status, and the DB check-constraints would
  // reject them anyway.
  const levelSet = new Set(COMPETITION_LEVELS.map((c) => c.value));
  for (const l of levels) {
    if (!levelSet.has(l as (typeof COMPETITION_LEVELS)[number]["value"])) {
      fieldErrors.competition_levels = "Invalid competition level.";
    }
  }
  const surfaceSet = new Set(SURFACES.map((s) => s.value));
  for (const s of surfaces) {
    if (!surfaceSet.has(s as (typeof SURFACES)[number]["value"])) {
      fieldErrors.surfaces = "Invalid surface.";
    }
  }
  const featureSet = new Set(EVENT_FEATURES.map((f) => f.value));
  for (const f of features) {
    if (!featureSet.has(f as (typeof EVENT_FEATURES)[number]["value"])) {
      fieldErrors.features = "Invalid feature.";
    }
  }
  const regionSet = new Set(EVENT_REGIONS.map((r) => r.value));
  if (base.region && !regionSet.has(base.region)) {
    fieldErrors.region = "Invalid region.";
  }

  for (const g of ageGroups) {
    if (!TEAM_GENDERS.some((t) => t.value === g.team_gender)) {
      fieldErrors.age_groups = "One of your age groups has an invalid gender.";
    }
    if (
      !(AGE_BRACKETS as readonly string[]).includes(g.age)
    ) {
      fieldErrors.age_groups = "One of your age groups has an invalid age.";
    }
    if (!Number.isFinite(g.price) || g.price < 0 || g.price > 100000) {
      fieldErrors.age_groups = "Age-group prices must be positive whole numbers.";
    }
    if (!(FIELD_SIZES as readonly string[]).includes(g.field_size)) {
      fieldErrors.age_groups = "One of your age groups has an invalid field size.";
    }
  }

  for (const s of sponsors) {
    if (!s.name || !s.link || !s.logo_url) {
      fieldErrors.sponsors = "Each sponsor needs a name, link, and logo URL.";
    }
    if (safeExternalUrl(s.link) === null) {
      fieldErrors.sponsors = "One of your sponsor links is invalid.";
    }
    if (safeImageSrc(s.logo_url) === null) {
      fieldErrors.sponsors = "One of your sponsor logos is invalid.";
    }
  }

  // Image cap depends on premium state — we peek at the row for edit,
  // or fall back to the non-premium cap for new events.
  let currentPremium = false;
  if (!isNew) {
    const { data: existing } = await supabase
      .from("events")
      .select("is_premium")
      .eq("id", eventId)
      .maybeSingle<{ is_premium: boolean }>();
    currentPremium = existing?.is_premium ?? false;
  }
  const imageCap = currentPremium ? PREMIUM_IMAGE_LIMIT : FREE_IMAGE_LIMIT;
  if (images.length > imageCap) {
    fieldErrors.images = `Free events can carry up to ${FREE_IMAGE_LIMIT} images. Upgrade to add more.`;
  }
  const safeImages = images
    .map((u) => safeImageSrc(u))
    .filter((u): u is string => u !== null);

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const lifecycle: "draft" | "active" =
    intent === "publish" ? "active" : "draft";

  // Look up caller role once — admins that create events do so on
  // behalf of an ED and leave owner_id null so the event is claimable
  // (spec: "the option to edit the tournament/add an event is possible
  // for the admin only if the tournament/event was added by the admin
  // and has not yet been claimed by an ED").
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle<{ user_type: "attendee" | "event_director" | "admin" }>();

  const newRowOwnership =
    callerProfile?.user_type === "admin"
      ? { owner_id: null, created_by: user.id, claimed: false }
      : { owner_id: user.id, created_by: user.id, claimed: true };

  const upsertRow = {
    ...(isNew ? {} : { id: eventId }),
    tournament_id:
      base.tournament_id ?? (await getExistingTournamentId(eventId, supabase)),
    logo_url: base.logo_url,
    title: base.title,
    website_url: base.website_url,
    host_club: base.host_club,
    start_date: base.start_date,
    end_date: base.end_date,
    registration_deadline: base.registration_deadline,
    description: base.description,
    location_formatted: base.location_formatted,
    location_state_abbr: base.location_state_abbr,
    location_lat: base.location_lat,
    location_lng: base.location_lng,
    location_place_id: base.location_place_id,
    location_city: base.location_city,
    location_state_full: base.location_state_full,
    location_zip: base.location_zip,
    num_teams_this_year: base.num_teams_this_year,
    region: base.region,
    season_id: base.season_id,
    video_url: base.video_url,
    teams_this_year_url: base.teams_this_year_url,
    teams_prev_year_url: base.teams_prev_year_url,
    registration_url: base.registration_url,
    teams_attended_prev_year: base.teams_attended_prev_year,
    ...(isNew ? newRowOwnership : {}),
    ...(intent === "update" ? {} : { lifecycle }),
  };

  const eventInsert = await supabase
    .from("events")
    .upsert(upsertRow)
    .select("id")
    .single();
  if (eventInsert.error) return { error: eventInsert.error.message };
  const savedId = eventInsert.data.id as string;

  // Replace-all children.
  await Promise.all([
    supabase.from("event_age_groups").delete().eq("event_id", savedId),
    supabase.from("sponsors").delete().eq("event_id", savedId),
    supabase.from("event_competition_levels").delete().eq("event_id", savedId),
    supabase.from("event_surfaces").delete().eq("event_id", savedId),
    supabase.from("event_features").delete().eq("event_id", savedId),
    supabase.from("event_images").delete().eq("event_id", savedId),
  ]);

  const childInserts: Array<PromiseLike<{ error: unknown }>> = [];
  if (ageGroups.length) {
    childInserts.push(
      supabase.from("event_age_groups").insert(
        ageGroups.map((g) => ({ ...g, event_id: savedId })),
      ),
    );
  }
  if (sponsors.length) {
    childInserts.push(
      supabase.from("sponsors").insert(
        sponsors.map((s) => ({ ...s, event_id: savedId })),
      ),
    );
  }
  if (levels.length) {
    childInserts.push(
      supabase
        .from("event_competition_levels")
        .insert(levels.map((level) => ({ event_id: savedId, level }))),
    );
  }
  if (surfaces.length) {
    childInserts.push(
      supabase
        .from("event_surfaces")
        .insert(surfaces.map((surface) => ({ event_id: savedId, surface }))),
    );
  }
  if (features.length) {
    childInserts.push(
      supabase
        .from("event_features")
        .insert(features.map((feature) => ({ event_id: savedId, feature }))),
    );
  }
  if (safeImages.length) {
    childInserts.push(
      supabase.from("event_images").insert(
        safeImages.map((url, i) => ({
          event_id: savedId,
          url,
          sort_order: i,
        })),
      ),
    );
  }

  await Promise.all(childInserts);

  revalidatePath("/dashboard/events");
  revalidatePath(`/dashboard/events/${savedId}`);

  if (isNew) {
    redirect(`/dashboard/events/${savedId}`);
  }
  return { createdId: savedId };
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function numOrNull(fd: FormData, key: string): number | null {
  const raw = str(fd, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseJson<T>(v: FormDataEntryValue | null): T | null {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

async function getExistingTournamentId(
  eventId: string,
  supabase: Awaited<ReturnType<typeof createServerAuthClient>>,
): Promise<string | undefined> {
  if (!eventId) return undefined;
  const { data } = await supabase
    .from("events")
    .select("tournament_id")
    .eq("id", eventId)
    .maybeSingle<{ tournament_id: string }>();
  return data?.tournament_id;
}

/**
 * Flip an event's is_premium flag to true. The stamp_premium_at
 * trigger stamps the premium_at timestamp on the false → true
 * transition (see migration 20260716000005). Spec: no Stripe this
 * sprint — the client will manage premium on-behalf while the app
 * launches, so this is a pure flag flip.
 */
export async function upgradeEvent(
  eventId: string,
): Promise<EventFormState> {
  const supabase = await createServerAuthClient();
  const { error } = await supabase.rpc("admin_set_premium", {
    target_event: eventId,
    val: true,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/dashboard/events/${eventId}/edit`);
  revalidatePath("/dashboard/events");
  return {};
}

/**
 * Toggle the is_general_ad flag (admin-only). The "General Ads" tier
 * is managed by an admin toggle while the paywall is off.
 */
export async function toggleGeneralAd(
  eventId: string,
  value: boolean,
): Promise<EventFormState> {
  const supabase = await createServerAuthClient();
  const { error } = await supabase.rpc("admin_set_general_ad", {
    target_event: eventId,
    val: value,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath("/dashboard/events");
  return {};
}

/**
 * Cancel a published event. Spec: reason is mandatory, capped, and
 * displayed publicly on the event page. Draft events don't get
 * canceled — they just get deleted.
 */
export async function cancelEvent(
  eventId: string,
  reason: string,
): Promise<EventFormState> {
  const trimmed = reason.trim().slice(0, CANCEL_REASON_MAX);
  if (!trimmed) {
    return { fieldErrors: { cancel_reason: "Reason is required." } };
  }
  const supabase = await createServerAuthClient();
  const { error } = await supabase
    .from("events")
    .update({ lifecycle: "canceled", cancel_reason: trimmed })
    .eq("id", eventId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/events");
  revalidatePath(`/dashboard/events/${eventId}`);
  return {};
}

/**
 * Delete an event via the SECURITY DEFINER `delete_event` RPC. The
 * RPC detaches attached reviews with snapshot fields so their
 * comments and content survive the delete, then removes the event
 * row (which cascades child tables — age groups, sponsors, images,
 * competition levels, surfaces, features, milestones).
 */
export async function deleteEvent(eventId: string): Promise<EventFormState> {
  const supabase = await createServerAuthClient();
  const { error } = await supabase.rpc("delete_event", {
    target_event: eventId,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/events");
  return {};
}

/**
 * Duplicate an event and its child rows (age groups, sponsors,
 * images, competition levels, surfaces). Reviews and premium are
 * intentionally NOT copied (spec: "the duplicated event should only
 * copy the data that was added during add/edit event flow… If the
 * original event was premium, the duplicated event must not carry
 * that over"). Redirects to the new event's edit page so the ED can
 * tweak details before publishing.
 */
export async function duplicateEvent(
  eventId: string,
): Promise<EventFormState> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: source, error: srcError } = await supabase
    .from("events")
    .select(
      "tournament_id, owner_id, logo_url, title, website_url, host_club, description, location_formatted, location_state_abbr, location_city, location_state_full, location_zip, num_teams_this_year, region, season_id",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (srcError) return { error: srcError.message };
  if (!source) return { error: "Event not found." };

  const src = source as unknown as Record<string, unknown>;

  const insertRow = {
    tournament_id: src.tournament_id as string,
    owner_id: src.owner_id as string | null,
    created_by: user.id,
    claimed: src.owner_id !== null,
    logo_url: src.logo_url,
    title: `${src.title as string} (copy)`,
    website_url: src.website_url,
    host_club: src.host_club,
    description: src.description,
    location_formatted: src.location_formatted,
    location_state_abbr: src.location_state_abbr,
    location_city: src.location_city,
    location_state_full: src.location_state_full,
    location_zip: src.location_zip,
    num_teams_this_year: src.num_teams_this_year,
    region: src.region,
    season_id: src.season_id,
    lifecycle: "draft" as const,
  };

  const { data: created, error: insertError } = await supabase
    .from("events")
    .insert(insertRow)
    .select("id")
    .single();
  if (insertError) return { error: insertError.message };
  const newId = created.id as string;

  // Copy the child collections that spec allows.
  const [ageGroupsRes, sponsorsRes, levelsRes, surfacesRes, imagesRes] =
    await Promise.all([
      supabase.from("event_age_groups").select("team_gender, age, price, field_size").eq("event_id", eventId),
      supabase.from("sponsors").select("name, link, logo_url").eq("event_id", eventId),
      supabase.from("event_competition_levels").select("level").eq("event_id", eventId),
      supabase.from("event_surfaces").select("surface").eq("event_id", eventId),
      supabase.from("event_images").select("url, sort_order").eq("event_id", eventId).order("sort_order"),
    ]);

  const inserts: Array<PromiseLike<{ error: unknown }>> = [];
  const ageGroups = (ageGroupsRes.data ?? []) as {
    team_gender: string;
    age: string;
    price: number;
    field_size: string;
  }[];
  if (ageGroups.length) {
    inserts.push(
      supabase
        .from("event_age_groups")
        .insert(ageGroups.map((g) => ({ ...g, event_id: newId }))),
    );
  }
  const sponsorsRows = (sponsorsRes.data ?? []) as {
    name: string;
    link: string;
    logo_url: string;
  }[];
  if (sponsorsRows.length) {
    inserts.push(
      supabase
        .from("sponsors")
        .insert(sponsorsRows.map((s) => ({ ...s, event_id: newId }))),
    );
  }
  const levels = ((levelsRes.data ?? []) as { level: string }[]).map(
    (r) => r.level,
  );
  if (levels.length) {
    inserts.push(
      supabase
        .from("event_competition_levels")
        .insert(levels.map((level) => ({ event_id: newId, level }))),
    );
  }
  const surfaces = ((surfacesRes.data ?? []) as { surface: string }[]).map(
    (r) => r.surface,
  );
  if (surfaces.length) {
    inserts.push(
      supabase
        .from("event_surfaces")
        .insert(surfaces.map((surface) => ({ event_id: newId, surface }))),
    );
  }
  const imagesRows = (imagesRes.data ?? []) as {
    url: string;
    sort_order: number;
  }[];
  if (imagesRows.length) {
    inserts.push(
      supabase
        .from("event_images")
        .insert(
          imagesRows.map((img) => ({
            event_id: newId,
            url: img.url,
            sort_order: img.sort_order,
          })),
        ),
    );
  }

  await Promise.all(inserts);
  revalidatePath("/dashboard/events");
  redirect(`/dashboard/events/${newId}/edit`);
}
