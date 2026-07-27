"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "../icons";
import { Alert, Field } from "../../(auth)/parts";
import { LocationAutocomplete } from "@/app/components/LocationAutocomplete";
import {
  CheckGlyph,
  FeatureTiles,
  IconInput,
  LabeledField,
  MultiSelectPills,
} from "./event-form-parts";
import {
  AGE_BRACKETS,
  COMPETITION_LEVELS,
  EVENT_FEATURES,
  EVENT_REGIONS,
  FIELD_SIZES,
  FREE_IMAGE_LIMIT,
  PREMIUM_IMAGE_LIMIT,
  SURFACES,
  TEAM_GENDERS,
} from "@/lib/enums";
import {
  Button,
  FormButton,
  ImageUploadField,
  RemoveIconButton,
  useToast,
} from "@/app/components/ui";
import { SafeImg } from "@/app/components/ui/SafeImg";
import { cn } from "@/app/components/ui/cn";
import { USDateText, usFromIso } from "@/app/components/ui/USDateInput";
import { useLiveValidation } from "@/app/components/ui/useLiveValidation";
import { useSubmittedValues } from "@/app/components/ui/useSubmittedValues";
import { safeExternalUrl, safeImageSrc } from "@/lib/url";
import {
  saveEvent,
  upgradeEvent,
  type AgeGroupInput,
  type EventFormState,
  type MilestoneInput,
  type SponsorInput,
} from "./event-actions";
import { ConfirmDialog } from "@/app/components/ui";

const INITIAL: EventFormState = {};

export type EventFormDefaults = {
  eventId?: string;
  tournamentId: string;
  tournamentTitle: string;
  base: {
    title: string;
    logo_url: string;
    website_url: string;
    host_club: string;
    start_date: string;
    end_date: string;
    registration_deadline: string;
    description: string;
    location_formatted: string;
    location_state_abbr: string;
    location_lat: string;
    location_lng: string;
    location_place_id: string;
    location_city: string;
    location_state_full: string;
    location_zip: string;
    num_teams_this_year: string;
    region: string;
    season_id: string;
    // Premium base fields — carried whether or not is_premium is true;
    // the DB stores them either way and the public surface hides them
    // until premium flips.
    video_url: string;
    teams_this_year_url: string;
    teams_prev_year_url: string;
    registration_url: string;
    teams_attended_prev_year: string;
  };
  ageGroups: AgeGroupInput[];
  sponsors: SponsorInput[];
  milestones: MilestoneInput[];
  competitionLevels: string[];
  surfaces: string[];
  features: string[];
  images: string[];
  lifecycle: "draft" | "active" | "canceled";
  isPremium: boolean;
  seasons: { id: string; label: string }[];
};

/**
 * Add / Edit Event form. Every field lives in local client state so
 * the child collections (age groups, sponsors, images) stay coherent
 * while the user edits. On submit the collections are serialized as
 * JSON hidden fields and the server action does the DB work in one
 * pass — see saveEvent in event-actions.ts.
 */
export function EventForm({
  defaults,
  isAdmin = false,
}: {
  defaults: EventFormDefaults;
  isAdmin?: boolean;
}) {
  const isEdit = Boolean(defaults.eventId);
  const [state, formAction] = useActionState(saveEvent, INITIAL);
  const { values, capture } = useSubmittedValues();
  const { shownError: websiteUrlError, revalidate: revalidateWebsiteUrl } =
    useLiveValidation(state.fieldErrors?.website_url, (v) =>
      safeExternalUrl(v) ? null : "Event website is required.",
    );
  const { shownError: descriptionError, revalidate: revalidateDescription } =
    useLiveValidation(state.fieldErrors?.description, (v) =>
      v.trim() ? null : "Description is required.",
    );
  const { shownError: regionError, revalidate: revalidateRegion } =
    useLiveValidation(state.fieldErrors?.region, (v) =>
      v ? null : "Region is required.",
    );
  const { shownError: startDateError, revalidate: revalidateStartDate } =
    useLiveValidation(state.fieldErrors?.start_date, (v) =>
      v ? null : "Starting date is required.",
    );
  const { shownError: endDateError, revalidate: revalidateEndDate } =
    useLiveValidation(state.fieldErrors?.end_date, (v) => {
      if (!v) return "Ending date is required.";
      const start = document.querySelector<HTMLInputElement>(
        'input[name="start_date"]',
      );
      return start?.value && v < start.value
        ? "End date must be on or after the start date."
        : null;
    });
  const { shownError: seasonError, revalidate: revalidateSeason } =
    useLiveValidation(state.fieldErrors?.season_id, (v) =>
      v ? null : "Season is required.",
    );
  const [ageGroups, setAgeGroups] = useState<AgeGroupInput[]>(defaults.ageGroups);
  const [sponsors, setSponsors] = useState<SponsorInput[]>(defaults.sponsors);
  const [milestones, setMilestones] = useState<MilestoneInput[]>(defaults.milestones);
  const [levels, setLevels] = useState<string[]>(defaults.competitionLevels);
  const [surfaces, setSurfaces] = useState<string[]>(defaults.surfaces);
  const [features, setFeatures] = useState<string[]>(defaults.features);
  const [images, setImages] = useState<string[]>(defaults.images);
  const [liveTitle, setLiveTitle] = useState(defaults.base.title);
  // Live start date feeds the derived "Tournament Kicks Off" anchor in
  // the premium Key dates section — display-only, never a stored row.
  const [liveStartIso, setLiveStartIso] = useState(
    values.start_date ?? defaults.base.start_date,
  );
  const [logoUrl, setLogoUrl] = useState(
    values.logo_url ?? defaults.base.logo_url,
  );
  const [isPremium, setIsPremium] = useState(defaults.isPremium);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const errorAnchorRef = useRef<HTMLDivElement | null>(null);
  const premiumSectionRef = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const { push } = useToast();

  useEffect(() => {
    if (state.fieldErrors && Object.keys(state.fieldErrors).length > 0) {
      errorAnchorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [state.fieldErrors]);

  const canPublish = useMemo(() => {
    return (
      liveTitle.trim().length > 0 &&
      (state.fieldErrors ?? {}).title === undefined
    );
  }, [liveTitle, state.fieldErrors]);

  return (
    <form
      action={(fd) => {
        capture(fd);
        formAction(fd);
      }}
      className="space-y-5"
    >
      <input type="hidden" name="tournament_id" value={defaults.tournamentId} />
      {defaults.eventId && (
        <input type="hidden" name="event_id" value={defaults.eventId} />
      )}
      {/* Serialized child collections — names + payloads are the server
          contract; the editors below only restyle how they're edited. */}
      <input type="hidden" name="age_groups" value={JSON.stringify(ageGroups)} />
      <input type="hidden" name="sponsors" value={JSON.stringify(sponsors)} />
      <input type="hidden" name="milestones" value={JSON.stringify(milestones)} />
      <input
        type="hidden"
        name="competition_levels"
        value={JSON.stringify(levels)}
      />
      <input type="hidden" name="surfaces" value={JSON.stringify(surfaces)} />
      <input type="hidden" name="features" value={JSON.stringify(features)} />
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      <div ref={errorAnchorRef}>
        {state.error && <Alert kind="error">{state.error}</Alert>}
      </div>

      {/* Upgrade prompt lives in the form header — the red-tinted band
          with the white spark disc, never the old amber slab buried
          under the images list. */}
      {!isPremium && defaults.eventId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/60 p-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-red-600 ring-1 ring-red-100">
              <Icon name="spark" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[14.5px] font-extrabold text-slate-900">
                Unlock premium features
              </p>
              <p className="mt-0.5 text-[12.5px] text-slate-600">
                Video, up to 13 images, team roster links, key dates &amp;
                deadlines, and the full features list.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="accent"
            onClick={() =>
              isAdmin
                ? setUpgradeOpen(true)
                : router.push(
                    `/dashboard/events/${defaults.eventId}/add-ons` as Route,
                  )
            }
          >
            <Icon name="spark" className="h-4 w-4" />
            Upgrade this event
          </Button>
        </div>
      )}

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <SectionHeader
          icon="info"
          title="The basics"
          subtitle="Show attendees what this event is and where to find it."
        />
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="flex-none">
            <ImageUploadField
              label="Event logo"
              name="logo_url"
              required
              bucket="event-images"
              layout="tile"
              value={logoUrl}
              onChange={setLogoUrl}
              error={state.fieldErrors?.logo_url}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <Field
              label="Event title"
              name="title"
              required
              defaultValue={values.title ?? defaults.base.title}
              validate={(v) => (v.trim() ? null : "Title is required.")}
              error={state.fieldErrors?.title}
              onInput={(e: React.FormEvent<HTMLInputElement>) =>
                setLiveTitle(e.currentTarget.value)
              }
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <LabeledField
                label="Event website"
                required
                htmlFor="website_url"
                error={websiteUrlError}
              >
                <IconInput
                  id="website_url"
                  name="website_url"
                  type="url"
                  placeholder="https://…"
                  defaultValue={values.website_url ?? defaults.base.website_url}
                  onInput={(e) => revalidateWebsiteUrl(e.currentTarget)}
                  icon={<LinkGlyph />}
                />
              </LabeledField>
              <Field
                label="Host club"
                name="host_club"
                required
                defaultValue={values.host_club ?? defaults.base.host_club}
                validate={(v) => (v.trim() ? null : "Host club is required.")}
                error={state.fieldErrors?.host_club}
              />
            </div>
          </div>
        </div>
        <LabeledField
          label="Description"
          required
          htmlFor="description"
          error={descriptionError}
        >
          <textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={values.description ?? defaults.base.description}
            onInput={(e) => revalidateDescription(e.currentTarget)}
            className="tg-control resize-none"
          />
        </LabeledField>
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <SectionHeader
          icon="calendar"
          title="Dates & registration"
          subtitle="When your event runs, and the last day teams can sign up."
        />
        {/* Masked mm/dd/yyyy text inputs (USDateText) — native
            type="date" renders the BROWSER locale's order, which
            shows dd/mm/yyyy abroad. Convention: dates are always US
            mm/dd/yyyy (see CLAUDE.md); the form still posts ISO. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <LabeledField
            label="Start date"
            required
            htmlFor="start_date"
            error={startDateError}
          >
            <USDateText
              id="start_date"
              name="start_date"
              calendar
              className="tg-control"
              defaultIso={values.start_date ?? defaults.base.start_date}
              aria-invalid={startDateError ? true : undefined}
              onIsoChange={(iso) => {
                setLiveStartIso(iso);
                revalidateStartDate({ value: iso, checkValidity: () => iso !== "" });
              }}
            />
          </LabeledField>
          <LabeledField
            label="End date"
            required
            htmlFor="end_date"
            error={endDateError}
          >
            <USDateText
              id="end_date"
              name="end_date"
              calendar
              className="tg-control"
              defaultIso={values.end_date ?? defaults.base.end_date}
              aria-invalid={endDateError ? true : undefined}
              onIsoChange={(iso) =>
                revalidateEndDate({ value: iso, checkValidity: () => iso !== "" })
              }
            />
          </LabeledField>
          <LabeledField
            label="Registration deadline"
            htmlFor="registration_deadline"
          >
            <USDateText
              id="registration_deadline"
              name="registration_deadline"
              calendar
              className="tg-control"
              defaultIso={
                values.registration_deadline ??
                defaults.base.registration_deadline
              }
            />
          </LabeledField>
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <SectionHeader
          icon="pin"
          title="Location & season"
          subtitle="Used for the state filter on search and for the region grouping."
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <LocationAutocomplete
            label="Location"
            name="location_formatted"
            // "place" prefix: the form has its own visible input named
            // location_state_abbr, which the default prefix would collide with.
            fieldPrefix="place"
            required
            icon={<Icon name="pin" className="h-4 w-4" />}
            placeholder="City, State, or Zip Code"
            hint="Full address or city + state — used across search filters."
            defaultValue={
              values.location_formatted ?? defaults.base.location_formatted
            }
            defaultGeo={{
              lat: defaults.base.location_lat,
              lng: defaults.base.location_lng,
              place_id: defaults.base.location_place_id,
              city: defaults.base.location_city,
              state_full: defaults.base.location_state_full,
              state_abbr: defaults.base.location_state_abbr,
              zip: defaults.base.location_zip,
            }}
            validate={(v) => (v.trim() ? null : "Location is required.")}
            error={state.fieldErrors?.location_formatted}
            onResolved={(place) => {
              if (!place) return;
              const abbr = document.querySelector<HTMLInputElement>(
                "#location_state_abbr",
              );
              if (abbr) abbr.value = place.stateAbbr;
            }}
          />
          <LabeledField
            label="State (2-letter)"
            hint="Auto-filled when you pick a location; editable."
            htmlFor="location_state_abbr"
          >
            <input
              id="location_state_abbr"
              name="location_state_abbr"
              maxLength={2}
              defaultValue={
                values.location_state_abbr ?? defaults.base.location_state_abbr
              }
              className="tg-control uppercase"
            />
          </LabeledField>
          <LabeledField
            label="Region"
            required
            htmlFor="region"
            error={regionError}
          >
            {/* key: a select's defaultValue applies only at mount, so the
                post-action form reset would blank it — remount on the
                captured value (inputs/textareas sync and don't need this). */}
            <select
              id="region"
              name="region"
              key={values.region ?? "unset"}
              defaultValue={values.region ?? defaults.base.region}
              onInput={(e) => revalidateRegion(e.currentTarget)}
              className="tg-control tg-select"
            >
              <option value="">Choose a region</option>
              {EVENT_REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField
            label="Season"
            required
            htmlFor="season_id"
            error={seasonError}
          >
            <select
              id="season_id"
              name="season_id"
              key={values.season_id ?? "unset"}
              defaultValue={values.season_id ?? defaults.base.season_id}
              onInput={(e) => revalidateSeason(e.currentTarget)}
              className="tg-control tg-select"
            >
              <option value="">Choose a season</option>
              {defaults.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </LabeledField>
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <SectionHeader
          icon="award"
          title="Competition"
          subtitle="Field size, levels, and how big the event is this year."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LabeledField
            label="Number of teams (this year)"
            htmlFor="num_teams_this_year"
          >
            <IconInput
              id="num_teams_this_year"
              name="num_teams_this_year"
              type="number"
              min={0}
              defaultValue={
                values.num_teams_this_year ?? defaults.base.num_teams_this_year
              }
              icon={<HashGlyph />}
            />
          </LabeledField>
        </div>
        <LabeledField
          label="Levels of competition"
          required
          error={state.fieldErrors?.competition_levels}
        >
          <MultiSelectPills
            options={COMPETITION_LEVELS}
            value={levels}
            onChange={setLevels}
          />
        </LabeledField>
        <LabeledField
          label="Fields"
          required
          error={state.fieldErrors?.surfaces}
        >
          <MultiSelectPills
            options={SURFACES}
            value={surfaces}
            onChange={setSurfaces}
          />
        </LabeledField>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <SectionHeader
          icon="users"
          title="Age groups"
          subtitle={
            <>
              Add one per bracket you offer. Prices are USD.
              <InfoTip text="Per-team pricing shows on the public page as a range. Leave a price at $0 to keep that division out of it." />
            </>
          }
          action={
            <>
              {ageGroups.length > 0 && (
                <CountChip
                  icon="users"
                  count={ageGroups.length}
                  label={ageGroups.length === 1 ? "division" : "divisions"}
                />
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setAgeGroups([
                    ...ageGroups,
                    { team_gender: "boys", age: "U10", price: 0, field_size: "7v7" },
                  ])
                }
              >
                <Icon name="plus" className="h-4 w-4" />
                Add age group
              </Button>
            </>
          }
        />
        <AgeGroupsEditor
          value={ageGroups}
          onChange={setAgeGroups}
          error={state.fieldErrors?.age_groups}
        />
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <SectionHeader
          icon="megaphone"
          title="Sponsors"
          subtitle="Optional — one row per sponsor with name, link, and logo."
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setSponsors([...sponsors, { name: "", link: "", logo_url: "" }])
              }
            >
              <Icon name="plus" className="h-4 w-4" />
              Add sponsor
            </Button>
          }
        />
        <SponsorsEditor
          value={sponsors}
          onChange={setSponsors}
          error={state.fieldErrors?.sponsors}
        />
      </section>

      {/* Premium sections — Extras, feature tiles, and Key dates all
          render only for premium events; the save action mirrors the
          gate for milestones (milestonesForSave). */}
      {isPremium && (
        <>
          <section
            ref={premiumSectionRef}
            className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6"
          >
            <SectionHeader
              icon="spark"
              title="Extras unlocked"
              subtitle="Video, roster and registration links, and last year's numbers."
              action={<PremiumTag />}
            />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <LabeledField
                label="Teams this year (URL)"
                htmlFor="teams_this_year_url"
                hint="Link to the applied-teams page for this season."
              >
                <IconInput
                  id="teams_this_year_url"
                  name="teams_this_year_url"
                  type="url"
                  defaultValue={
                    values.teams_this_year_url ??
                    defaults.base.teams_this_year_url
                  }
                  placeholder="https://…"
                  icon={<span className="text-xs font-bold">→</span>}
                />
              </LabeledField>
              <LabeledField
                label="Teams last year (URL)"
                htmlFor="teams_prev_year_url"
              >
                <IconInput
                  id="teams_prev_year_url"
                  name="teams_prev_year_url"
                  type="url"
                  defaultValue={
                    values.teams_prev_year_url ??
                    defaults.base.teams_prev_year_url
                  }
                  placeholder="https://…"
                  icon={<span className="text-xs font-bold">→</span>}
                />
              </LabeledField>
              <LabeledField label="Registration URL" htmlFor="registration_url">
                <IconInput
                  id="registration_url"
                  name="registration_url"
                  type="url"
                  defaultValue={
                    values.registration_url ?? defaults.base.registration_url
                  }
                  placeholder="https://…"
                  icon={<span className="text-xs font-bold">→</span>}
                />
              </LabeledField>
              <LabeledField
                label="Teams last year (count)"
                htmlFor="teams_attended_prev_year"
              >
                <input
                  id="teams_attended_prev_year"
                  name="teams_attended_prev_year"
                  type="number"
                  min={0}
                  defaultValue={
                    values.teams_attended_prev_year ??
                    defaults.base.teams_attended_prev_year
                  }
                  className="tg-control"
                />
              </LabeledField>
              <LabeledField label="Event video (URL)" htmlFor="video_url">
                <IconInput
                  id="video_url"
                  name="video_url"
                  type="url"
                  defaultValue={values.video_url ?? defaults.base.video_url}
                  placeholder="https://…"
                  icon={<span className="text-xs font-bold">▶</span>}
                />
              </LabeledField>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <SectionHeader
              icon="check"
              title="Additional features"
              subtitle="On-site amenities shown on your public listing."
              action={<PremiumTag />}
            />
            <FeatureTiles
              options={EVENT_FEATURES}
              value={features}
              onChange={setFeatures}
              error={state.fieldErrors?.features}
            />
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <SectionHeader
              icon="flag"
              title="Key dates & deadlines"
              subtitle="Milestones families track — shown as a timeline on your event page."
              action={
                <>
                  <PremiumTag />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setMilestones([
                        ...milestones,
                        { title: "", milestone_date: "", description: "" },
                      ])
                    }
                  >
                    <Icon name="plus" className="h-4 w-4" />
                    Add milestone
                  </Button>
                </>
              }
            />
            <MilestonesEditor
              value={milestones}
              onChange={setMilestones}
              startIso={liveStartIso}
            />
          </section>
        </>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <SectionHeader
          icon="image"
          title="Photos"
          subtitle={`Up to ${FREE_IMAGE_LIMIT} for free events. Premium unlocks 10 more.`}
          action={
            <CountChip
              icon="image"
              count={images.length}
              label={`/ ${isPremium ? PREMIUM_IMAGE_LIMIT : FREE_IMAGE_LIMIT} used`}
            />
          }
        />
        <ImagesEditor
          value={images}
          onChange={setImages}
          isPremium={isPremium}
          error={state.fieldErrors?.images}
        />
      </section>

      {/* Admin-only: the on-behalf premium flip while payments are
          deferred. EDs' "Upgrade this event" routes to the coming-soon
          add-ons preview instead of opening this confirm. */}
      {isAdmin && (
        <ConfirmDialog
          open={upgradeOpen}
          destructive={false}
          title="Upgrade this event to premium?"
          body="We'll unlock video, extra images, roster + registration URLs, key dates & deadlines, and the full feature list. Payments aren't wired yet — the client will manage premium on-behalf while the app launches, so this is a free flip for now."
          confirmLabel="Yes, upgrade"
          onClose={() => setUpgradeOpen(false)}
          onConfirm={async () => {
            if (!defaults.eventId) return;
            const res = await upgradeEvent(defaults.eventId);
            setUpgradeOpen(false);
            if (res.error) {
              push("error", res.error);
              return;
            }
            setIsPremium(true);
            push(
              "success",
              "Event upgraded. Premium fields are now editable below.",
            );
            setTimeout(() => {
              premiumSectionRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }, 50);
          }}
        />
      )}

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 backdrop-blur">
        <p className="text-xs text-slate-500">
          Draft saves quietly. Publishing runs the full checklist.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/dashboard/events` as Route)}
          >
            Cancel
          </Button>
          {/* Submitter name/value pairs carry the intent (only the
              clicked button's pair rides the FormData), so the server
              knows draft-vs-publish and FormButton spins only the
              button that fired. */}
          {(!isEdit || defaults.lifecycle === "draft") && (
            <FormButton
              variant="secondary"
              name="intent"
              value="draft"
              formNoValidate
              pendingLabel="Saving…"
            >
              <Icon name="save" className="h-4 w-4" />
              Save as draft
            </FormButton>
          )}
          <FormButton
            variant="primary"
            name="intent"
            value={
              isEdit && defaults.lifecycle === "active" ? "update" : "publish"
            }
            disabled={!canPublish}
            pendingLabel="Saving…"
          >
            <Icon name="check" className="h-4 w-4" />
            {isEdit
              ? defaults.lifecycle === "active"
                ? "Update"
                : "Update & publish"
              : "Publish"}
          </FormButton>
        </div>
      </div>
    </form>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: IconName;
  title: string;
  subtitle: ReactNode;
  /** Right-side slot — "+ Add X" CTA, Premium tag, count chips. */
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-slate-100 text-slate-600">
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="font-[var(--font-heading)] text-[15.5px] font-extrabold leading-[1.15] tracking-[-0.01em] text-slate-900">
            {title}
          </h2>
          <p className="mt-0.5 text-[12.5px] font-medium text-slate-500">
            {subtitle}
          </p>
        </div>
      </div>
      {action && (
        <div className="flex flex-wrap items-center gap-2.5">{action}</div>
      )}
    </div>
  );
}

/** Slate-fill section count chip ("3 divisions", "2 / 3 used") — the
 * in-section sibling of the page-header HeaderCountChip. */
function CountChip({
  icon,
  count,
  label,
}: {
  icon: IconName;
  count: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-3 py-[5px] text-[11.5px] font-bold text-slate-600">
      <Icon name={icon} className="h-3.5 w-3.5 text-slate-400" />
      <span className="font-[var(--font-heading)] text-[12px] font-extrabold text-slate-900">
        {count}
      </span>{" "}
      {label}
    </span>
  );
}

/** Hover/focus info bubble for section subtitles — keeps helper copy
 * out of the layout without clipping it. */
function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative ml-1.5 inline-flex align-[-3px]">
      <button
        type="button"
        aria-label={text}
        className="grid h-4 w-4 place-items-center rounded-full bg-slate-200 text-slate-500 transition-colors hover:bg-slate-300 hover:text-slate-700"
      >
        <Icon name="info" className="h-3 w-3" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-20 w-60 rounded-xl bg-slate-900 px-3 py-2 text-[11.5px] font-medium leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-focus-within/tip:opacity-100 group-hover/tip:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

/** Uppercase micro-label for the editor grid headers. */
function MiniLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">
      {children}
    </span>
  );
}

function AgeGroupsEditor({
  value,
  onChange,
  error,
}: {
  value: AgeGroupInput[];
  onChange: (next: AgeGroupInput[]) => void;
  error?: string;
}) {
  const update = (i: number, patch: Partial<AgeGroupInput>) =>
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const columns =
    "md:grid-cols-[minmax(0,1fr)_92px_104px_104px_32px]";
  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div
            className={cn(
              "hidden gap-2.5 bg-slate-50 px-3 py-2 md:grid",
              columns,
            )}
          >
            <MiniLabel>Gender</MiniLabel>
            <MiniLabel>Age</MiniLabel>
            <MiniLabel>Price</MiniLabel>
            <MiniLabel>Field size</MiniLabel>
            <span />
          </div>
          <div className="divide-y divide-slate-100 md:border-t md:border-slate-100">
            {value.map((row, i) => (
              <div
                key={i}
                className={cn(
                  "grid grid-cols-1 items-center gap-2.5 px-3 py-2.5",
                  columns,
                )}
              >
                {/* Single-select choice chips (STYLE-GUIDE: selectable
                    blocks for gender, never a dropdown). Same
                    row.team_gender value — the serialized age_groups
                    JSON is unchanged. */}
                <div
                  className="flex flex-wrap gap-1.5"
                  role="group"
                  aria-label={`Age group ${i + 1} gender`}
                >
                  {TEAM_GENDERS.map((g) => {
                    const active = row.team_gender === g.value;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => update(i, { team_gender: g.value })}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-3 py-[5px] text-[12px] font-semibold transition hover:-translate-y-px",
                          active
                            ? "border-red-600 bg-red-50 text-red-700"
                            : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900",
                        )}
                      >
                        {active && <CheckGlyph />}
                        {g.label}
                      </button>
                    );
                  })}
                </div>
                <select
                  aria-label={`Age group ${i + 1} age`}
                  className="tg-control tg-control-sm tg-select"
                  value={row.age}
                  onChange={(e) => update(i, { age: e.target.value })}
                >
                  <option value="">—</option>
                  {AGE_BRACKETS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 flex w-7 items-center justify-center text-[13px] font-bold text-slate-500"
                  >
                    $
                  </span>
                  <input
                    aria-label={`Age group ${i + 1} price`}
                    type="number"
                    min={0}
                    className="tg-control tg-control-sm pl-7"
                    value={String(row.price)}
                    onChange={(e) =>
                      update(i, { price: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <select
                  aria-label={`Age group ${i + 1} field size`}
                  className="tg-control tg-control-sm tg-select"
                  value={row.field_size}
                  onChange={(e) => update(i, { field_size: e.target.value })}
                >
                  <option value="">—</option>
                  {FIELD_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <RemoveIconButton
                  size="sm"
                  label={`Remove age group ${i + 1}`}
                  onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p className="text-xs font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}

function SponsorsEditor({
  value,
  onChange,
  error,
}: {
  value: SponsorInput[];
  onChange: (next: SponsorInput[]) => void;
  error?: string;
}) {
  return (
    <div className="space-y-3">
      {/* Compact rows sharing one bordered container: name/link up top,
          the logo as a fixed SQUARE tile (thumbSize="sm" — never a
          stretchy rectangle), X remove on the row edge. */}
      {value.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="divide-y divide-slate-100">
            {value.map((row, i) => (
              <div key={i} className="flex items-start gap-3 p-3.5">
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-2.5 md:grid-cols-2">
                  <input
                    aria-label={`Sponsor ${i + 1} name`}
                    className="tg-control tg-control-sm"
                    placeholder="Sponsor name"
                    value={row.name}
                    onChange={(e) =>
                      onChange(
                        value.map((r, idx) =>
                          idx === i ? { ...r, name: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex w-9 items-center justify-center text-slate-400">
                      <LinkGlyph />
                    </span>
                    <input
                      aria-label={`Sponsor ${i + 1} link`}
                      type="url"
                      placeholder="https://…"
                      className="tg-control tg-control-sm pl-9"
                      value={row.link}
                      onChange={(e) =>
                        onChange(
                          value.map((r, idx) =>
                            idx === i ? { ...r, link: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <ImageUploadField
                      label="Logo"
                      bucket="event-images"
                      thumbSize="sm"
                      value={row.logo_url}
                      onChange={(v) =>
                        onChange(
                          value.map((r, idx) =>
                            idx === i ? { ...r, logo_url: v } : r,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
                <RemoveIconButton
                  size="sm"
                  label={`Remove sponsor ${i + 1}`}
                  onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

/** Solid red premium marker — STYLE-GUIDE §6: violet is reserved for
 * Spotlight, so premium labels are always red. */
function PremiumTag() {
  return (
    <span className="inline-flex items-center rounded-full bg-red-600 px-2.5 py-[3px] font-[var(--font-heading)] text-[9px] font-extrabold uppercase tracking-[0.07em] text-white">
      Premium
    </span>
  );
}

function MilestonesEditor({
  value,
  onChange,
  startIso,
}: {
  value: MilestoneInput[];
  onChange: (next: MilestoneInput[]) => void;
  /** The event's live start date (ISO) — feeds the pinned, read-only
   * "Tournament Kicks Off" anchor row. Derived, never stored. */
  startIso: string;
}) {
  const update = (i: number, patch: Partial<MilestoneInput>) =>
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const columns =
    "md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_32px]";
  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div
              className={cn(
                "hidden gap-2.5 bg-slate-50 px-3 py-2 md:grid",
                columns,
              )}
            >
              <MiniLabel>Date</MiniLabel>
              <MiniLabel>Title</MiniLabel>
              <MiniLabel>Description</MiniLabel>
              <span />
            </div>
            <div className="divide-y divide-slate-100 md:border-t md:border-slate-100">
              {value.map((row, i) => (
                <div
                  key={i}
                  className={cn(
                    "grid grid-cols-1 items-center gap-2.5 px-3 py-2.5",
                    columns,
                  )}
                >
                  <USDateText
                    aria-label={`Milestone ${i + 1} date`}
                    calendar
                    className="tg-control tg-control-sm"
                    iso={row.milestone_date}
                    onIsoChange={(iso) => update(i, { milestone_date: iso })}
                  />
                  <input
                    aria-label={`Milestone ${i + 1} title`}
                    className="tg-control tg-control-sm"
                    placeholder="Milestone title"
                    value={row.title}
                    onChange={(e) => update(i, { title: e.target.value })}
                  />
                  <input
                    aria-label={`Milestone ${i + 1} description`}
                    className="tg-control tg-control-sm"
                    placeholder="Optional description"
                    value={row.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                  />
                  <RemoveIconButton
                    size="sm"
                    label={`Remove milestone ${i + 1}`}
                    onClick={() =>
                      onChange(value.filter((_, idx) => idx !== i))
                    }
                  />
                </div>
              ))}
              {/* Pinned READ-ONLY anchor: the event's start date shown as
                  the required kick-off milestone. Derived display — no
                  stored row, no new validation rule. */}
              <div
                className={cn(
                  "grid grid-cols-1 items-center gap-2.5 bg-red-50/60 px-3 py-2.5",
                  columns,
                )}
              >
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 grid w-8 place-items-center text-red-600"
                  >
                    <Icon name="flag" className="h-4 w-4" />
                  </span>
                  <input
                    aria-label="Tournament kick-off date (the event's start date)"
                    readOnly
                    tabIndex={-1}
                    value={usFromIso(startIso)}
                    placeholder="mm/dd/yyyy"
                    className="tg-control tg-control-sm border-red-200 pl-8 font-semibold"
                  />
                </div>
                <div className="flex items-center gap-2 md:col-span-2">
                  <input
                    aria-label="Tournament kick-off milestone title"
                    readOnly
                    tabIndex={-1}
                    value="Tournament Kicks Off"
                    className="tg-control tg-control-sm border-red-200 font-bold"
                  />
                  <span className="inline-flex flex-none items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-[3px] font-[var(--font-heading)] text-[9px] font-extrabold uppercase tracking-[0.07em] text-red-700">
                    Required
                  </span>
                </div>
                <span />
              </div>
            </div>
          </div>
          <p className="text-[11.5px] text-slate-500">
            If you add milestones, the{" "}
            <b className="font-bold text-slate-700">Tournament Kicks Off</b>{" "}
            date is required — it anchors the timeline on your event page and
            is always your event&apos;s start date.
          </p>
        </>
      )}
    </div>
  );
}

function ImagesEditor({
  value,
  onChange,
  isPremium,
  error,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  isPremium: boolean;
  error?: string;
}) {
  const cap = isPremium ? PREMIUM_IMAGE_LIMIT : FREE_IMAGE_LIMIT;
  return (
    <div className="space-y-3">
      {/* Uniform square tiles with X-on-hover + a dashed "Add photo"
          tile. Adding appends an empty slot, which renders below as a
          full ImageUploadField (upload OR paste-a-URL — the storage
          flow is untouched) until a value lands and it becomes a tile. */}
      <div className="flex flex-wrap gap-3">
        {value.map((url, i) =>
          url.trim() !== "" ? (
            <div
              key={i}
              className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
            >
              <SafeImg
                src={safeImageSrc(url) ?? undefined}
                alt=""
                className="h-full w-full object-cover"
                fallback={
                  <span className="grid h-full w-full place-items-center text-slate-300">
                    <Icon name="image" className="h-6 w-6" />
                  </span>
                }
              />
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-lg bg-slate-900/60 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null,
        )}
        {value.length < cap && (
          <button
            type="button"
            onClick={() => onChange([...value, ""])}
            className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:-translate-y-px hover:border-red-600 hover:bg-[#fff7f7] hover:text-red-600"
          >
            <Icon name="plus" className="h-5 w-5" />
            <span className="text-[10.5px] font-bold">Add photo</span>
          </button>
        )}
      </div>
      {value.map((url, i) =>
        url.trim() === "" ? (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
          >
            {/* onRemove renders the Remove button beside Upload — one
                control cluster, not a lone button across the row. */}
            <ImageUploadField
              label={`Photo ${i + 1}`}
              bucket="event-images"
              value={url}
              onChange={(v) =>
                onChange(value.map((cur, idx) => (idx === i ? v : cur)))
              }
              onRemove={() => onChange(value.filter((_, idx) => idx !== i))}
            />
          </div>
        ) : null,
      )}
      {!isPremium && value.length >= FREE_IMAGE_LIMIT && (
        <p className="text-xs text-slate-500">
          You&apos;re at the free-tier cap. Upgrade the event to add up to{" "}
          {PREMIUM_IMAGE_LIMIT}.
        </p>
      )}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

function LinkGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}

function HashGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" />
    </svg>
  );
}

