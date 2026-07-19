"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerAuthClient } from "@/lib/supabase/server";
import { firstWriteError } from "@/lib/supabase/unwrap";
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

export type MilestoneInput = {
  title: string;
  milestone_date: string;
  description: string;
};

/**
 * Save an event as draft OR publish it. Draft mode only requires the
 * title (spec: "only the event title is mandatory"); publish enforces
 * every mandatory field + end_date >= start_date.
 *
 * The action validates, then hands the whole graph to the
 * `save_event_graph` SECURITY DEFINER RPC, which writes the base event
 * and replaces every child collection (age groups / sponsors /
 * competition levels / surfaces / features / images / milestones) in ONE
 * transaction — a late child failure rolls everything back, so the ED's
 * existing data survives (S9.3 rework). Replace-all lets the form treat
 * child rows as pure state — the client sends the whole set every time
 * and the server never has to reconcile per-row diffs.
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
  const milestones = parseJson<MilestoneInput[]>(formData.get("milestones")) ?? [];

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
    const { data: existing, error: premiumError } = await supabase
      .from("events")
      .select("is_premium")
      .eq("id", eventId)
      .maybeSingle<{ is_premium: boolean }>();
    // A failed read is not "not premium" — degrading silently rejects
    // images a premium ED is entitled to.
    if (premiumError) return { error: premiumError.message };
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

  // null = keep the current lifecycle (the "update" intent).
  const lifecycle: "draft" | "active" | null =
    intent === "update" ? null : intent === "publish" ? "active" : "draft";

  const validMilestones = milestones.filter((m) => m.title.trim());

  // The save_event_graph RPC writes the base row + every child
  // replace-all in one transaction: a late child failure rolls back the
  // whole graph, so the ED's existing collections survive. Authz (event
  // host + owner/admin + parent tournament, mirroring p_events_write)
  // and new-row ownership (admin → unclaimed claimable row, S1.1) are
  // computed inside the RPC — the payload carries no ownership fields,
  // and a null tournament_id on edit means "keep the current parent".
  const { data: saved, error: saveError } = await supabase.rpc(
    "save_event_graph",
    {
      p_event: {
        id: eventId || null,
        tournament_id: base.tournament_id ?? null,
        lifecycle,
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
        age_groups: ageGroups,
        sponsors,
        competition_levels: levels,
        surfaces,
        features,
        images: safeImages,
        milestones: validMilestones.map((m) => ({
          title: m.title.trim(),
          milestone_date: m.milestone_date || null,
          description: m.description.trim() || null,
        })),
      },
    },
  );
  if (saveError) return { error: saveError.message };
  const savedId = saved as string;

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

  // Copy the child collections that spec allows. A failed read here is
  // indistinguishable from an empty collection, so it would hand back a
  // duplicate quietly missing whole sections of the original.
  const childReads = await Promise.all([
    supabase.from("event_age_groups").select("team_gender, age, price, field_size").eq("event_id", eventId),
    supabase.from("sponsors").select("name, link, logo_url").eq("event_id", eventId),
    supabase.from("event_competition_levels").select("level").eq("event_id", eventId),
    supabase.from("event_surfaces").select("surface").eq("event_id", eventId),
    supabase.from("event_images").select("url, sort_order").eq("event_id", eventId).order("sort_order"),
  ]);
  const readError = firstWriteError(childReads, "duplicateEvent child reads");
  if (readError) return { error: readError };
  const [ageGroupsRes, sponsorsRes, levelsRes, surfacesRes, imagesRes] =
    childReads;

  // Same atomic RPC as saveEvent — the copy lands whole or not at all.
  // Ownership is computed by the RPC from the caller's role (ED → own
  // claimed copy; admin → unclaimed claimable copy, S1.1); features and
  // milestones are deliberately not copied, matching the previous
  // behavior, and premium/tier flags never carry over.
  const { data: created, error: createError } = await supabase.rpc(
    "save_event_graph",
    {
      p_event: {
        id: null,
        tournament_id: source.tournament_id,
        lifecycle: "draft",
        logo_url: source.logo_url,
        title: `${source.title} (copy)`,
        website_url: source.website_url,
        host_club: source.host_club,
        description: source.description,
        location_formatted: source.location_formatted,
        location_state_abbr: source.location_state_abbr,
        location_city: source.location_city,
        location_state_full: source.location_state_full,
        location_zip: source.location_zip,
        num_teams_this_year: source.num_teams_this_year,
        region: source.region,
        season_id: source.season_id,
        age_groups: ageGroupsRes.data ?? [],
        sponsors: sponsorsRes.data ?? [],
        competition_levels: (levelsRes.data ?? []).map((r) => r.level),
        surfaces: (surfacesRes.data ?? []).map((r) => r.surface),
        images: (imagesRes.data ?? []).map((i) => i.url),
      },
    },
  );
  if (createError) return { error: createError.message };
  const newId = created;

  revalidatePath("/dashboard/events");
  redirect(`/dashboard/events/${newId}/edit`);
}
