"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Alert, Field } from "../../(auth)/parts";
import { LocationAutocomplete } from "@/app/components/LocationAutocomplete";
import {
  IconInput,
  LabeledField,
  MultiSelectPills,
  RemoveRowButton,
} from "./event-form-parts";
import {
  AGE_BRACKETS,
  COMPETITION_LEVELS,
  EVENT_FEATURES,
  EVENT_REGIONS,
  FIELD_SIZES,
  FREE_IMAGE_LIMIT,
  SURFACES,
  TEAM_GENDERS,
} from "@/lib/enums";
import { Button, useToast } from "@/app/components/ui";
import { useLiveValidation } from "@/app/components/ui/useLiveValidation";
import { useSubmittedValues } from "@/app/components/ui/useSubmittedValues";
import { safeExternalUrl } from "@/lib/url";
import {
  saveEvent,
  upgradeEvent,
  type AgeGroupInput,
  type EventFormState,
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
export function EventForm({ defaults }: { defaults: EventFormDefaults }) {
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
  const { shownError: seasonError, revalidate: revalidateSeason } =
    useLiveValidation(state.fieldErrors?.season_id, (v) =>
      v ? null : "Season is required.",
    );
  const [intent, setIntent] = useState<"draft" | "publish" | "update">(
    isEdit && defaults.lifecycle === "active" ? "update" : "draft",
  );
  const [ageGroups, setAgeGroups] = useState<AgeGroupInput[]>(defaults.ageGroups);
  const [sponsors, setSponsors] = useState<SponsorInput[]>(defaults.sponsors);
  const [levels, setLevels] = useState<string[]>(defaults.competitionLevels);
  const [surfaces, setSurfaces] = useState<string[]>(defaults.surfaces);
  const [features, setFeatures] = useState<string[]>(defaults.features);
  const [images, setImages] = useState<string[]>(defaults.images);
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

  useEffect(() => {
    if (state.createdId && isEdit) {
      push("success", intent === "publish" ? "Event published." : "Changes saved.");
    }
  }, [state.createdId, isEdit, intent, push]);

  const canPublish = useMemo(() => {
    return (
      defaults.base.title.length > 0 ||
      (state.fieldErrors ?? {}).title === undefined
    );
  }, [defaults.base.title, state.fieldErrors]);

  return (
    <form
      action={(fd) => {
        capture(fd);
        formAction(fd);
      }}
      className="space-y-8"
    >
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="tournament_id" value={defaults.tournamentId} />
      {defaults.eventId && (
        <input type="hidden" name="event_id" value={defaults.eventId} />
      )}
      <input type="hidden" name="age_groups" value={JSON.stringify(ageGroups)} />
      <input type="hidden" name="sponsors" value={JSON.stringify(sponsors)} />
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

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <SectionHeader
          title="The basics"
          subtitle="Show attendees what this event is and where to find it."
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <LabeledField label="Event logo URL" required htmlFor="logo_url">
            <IconInput
              id="logo_url"
              name="logo_url"
              type="url"
              placeholder="https://…"
              defaultValue={values.logo_url ?? defaults.base.logo_url}
              icon={<UploadGlyph />}
            />
          </LabeledField>
          <Field
            label="Event title"
            name="title"
            required
            defaultValue={values.title ?? defaults.base.title}
            validate={(v) => (v.trim() ? null : "Title is required.")}
            error={state.fieldErrors?.title}
          />
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
          <Field
            label="Start date"
            name="start_date"
            type="date"
            required
            defaultValue={values.start_date ?? defaults.base.start_date}
            validate={(v) => (v ? null : "Starting date is required.")}
            error={state.fieldErrors?.start_date}
          />
          <Field
            label="End date"
            name="end_date"
            type="date"
            required
            defaultValue={values.end_date ?? defaults.base.end_date}
            validate={(v) => {
              if (!v) return "Ending date is required.";
              const start = document.querySelector<HTMLInputElement>(
                'input[name="start_date"]',
              );
              return start?.value && v < start.value
                ? "End date must be on or after the start date."
                : null;
            }}
            error={state.fieldErrors?.end_date}
          />
          <Field
            label="Registration deadline"
            name="registration_deadline"
            type="date"
            defaultValue={
              values.registration_deadline ??
              defaults.base.registration_deadline
            }
          />
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
          label="Description"
          required
          htmlFor="description"
          error={descriptionError}
        >
          <textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={values.description ?? defaults.base.description}
            onInput={(e) => revalidateDescription(e.currentTarget)}
            className="tg-control resize-none"
          />
        </LabeledField>
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <SectionHeader
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
            <select
              id="region"
              name="region"
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
          title="Competition"
          subtitle="What levels are welcome, on what surfaces."
        />
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

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <SectionHeader
          title="Age groups"
          subtitle="Add one per bracket you offer. Prices are USD."
        />
        <AgeGroupsEditor
          value={ageGroups}
          onChange={setAgeGroups}
          error={state.fieldErrors?.age_groups}
        />
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <SectionHeader
          title="Sponsors"
          subtitle="Optional — one row per sponsor with name, link, and logo."
        />
        <SponsorsEditor
          value={sponsors}
          onChange={setSponsors}
          error={state.fieldErrors?.sponsors}
        />
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <SectionHeader
          title="Images"
          subtitle={`Up to ${FREE_IMAGE_LIMIT} for free events. Premium unlocks 10 more.`}
        />
        <ImagesEditor
          value={images}
          onChange={setImages}
          isPremium={isPremium}
          error={state.fieldErrors?.images}
        />
        {!isPremium && defaults.eventId && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-amber-900">
                  Unlock premium features
                </p>
                <p className="mt-1 text-xs text-amber-900/80">
                  Video, extra images, teams URLs, and additional features.
                  We&apos;ll flip your event to premium and reveal the extra
                  fields.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setUpgradeOpen(true)}
                className="!bg-amber-900"
              >
                ★ Upgrade this event
              </Button>
            </div>
          </div>
        )}
      </section>

      {isPremium && (
        <section
          ref={premiumSectionRef}
          className="space-y-5 rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-white p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-900">
                Premium
              </p>
              <h2 className="mt-1 font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
                Extras unlocked
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Videos, external roster links, and the full features list.
              </p>
            </div>
          </div>
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
          <LabeledField
            label="Additional features"
            error={state.fieldErrors?.features}
          >
            <MultiSelectPills
              options={EVENT_FEATURES}
              value={features}
              onChange={setFeatures}
            />
          </LabeledField>
        </section>
      )}

      <ConfirmDialog
        open={upgradeOpen}
        destructive={false}
        title="Upgrade this event to premium?"
        body="We'll unlock video, extra images, roster + registration URLs, and the full feature list. Payments aren't wired yet — the client will manage premium on-behalf while the app launches, so this is a free flip for now."
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
          {isEdit && defaults.lifecycle === "draft" && (
            <Button
              type="submit"
              variant="ghost"
              formNoValidate
              onClick={() => setIntent("draft")}
            >
              Save as draft
            </Button>
          )}
          {!isEdit && (
            <Button
              type="submit"
              variant="ghost"
              formNoValidate
              onClick={() => setIntent("draft")}
            >
              Save as draft
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={!canPublish}
            onClick={() =>
              setIntent(isEdit && defaults.lifecycle === "active" ? "update" : "publish")
            }
          >
            {isEdit
              ? defaults.lifecycle === "active"
                ? "Update"
                : "Update & publish"
              : "Publish"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
        {title}
      </h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
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
  return (
    <div className="space-y-3">
      {value.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-1 items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto]"
        >
          <LabeledField label="Gender" htmlFor={`ag_g_${i}`}>
            <select
              id={`ag_g_${i}`}
              className="tg-control tg-select"
              value={row.team_gender}
              onChange={(e) =>
                onChange(
                  value.map((r, idx) =>
                    idx === i ? { ...r, team_gender: e.target.value } : r,
                  ),
                )
              }
            >
              <option value="">—</option>
              {TEAM_GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Age" htmlFor={`ag_a_${i}`}>
            <select
              id={`ag_a_${i}`}
              className="tg-control tg-select"
              value={row.age}
              onChange={(e) =>
                onChange(
                  value.map((r, idx) =>
                    idx === i ? { ...r, age: e.target.value } : r,
                  ),
                )
              }
            >
              <option value="">—</option>
              {AGE_BRACKETS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Price" htmlFor={`ag_p_${i}`}>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex w-11 items-center justify-center font-semibold text-slate-500">
                $
              </span>
              <input
                id={`ag_p_${i}`}
                type="number"
                min={0}
                className="tg-control pl-12"
                value={String(row.price)}
                onChange={(e) =>
                  onChange(
                    value.map((r, idx) =>
                      idx === i
                        ? { ...r, price: Number(e.target.value) || 0 }
                        : r,
                    ),
                  )
                }
              />
            </div>
          </LabeledField>
          <LabeledField label="Field size" htmlFor={`ag_f_${i}`}>
            <select
              id={`ag_f_${i}`}
              className="tg-control tg-select"
              value={row.field_size}
              onChange={(e) =>
                onChange(
                  value.map((r, idx) =>
                    idx === i ? { ...r, field_size: e.target.value } : r,
                  ),
                )
              }
            >
              <option value="">—</option>
              {FIELD_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </LabeledField>
          <RemoveRowButton
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        onClick={() =>
          onChange([
            ...value,
            { team_gender: "boys", age: "U10", price: 0, field_size: "7v7" },
          ])
        }
      >
        + Add age group
      </Button>
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
      {value.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-1 items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <LabeledField label="Name" htmlFor={`sp_n_${i}`}>
            <input
              id={`sp_n_${i}`}
              className="tg-control"
              value={row.name}
              onChange={(e) =>
                onChange(
                  value.map((r, idx) =>
                    idx === i ? { ...r, name: e.target.value } : r,
                  ),
                )
              }
            />
          </LabeledField>
          <LabeledField label="Link" htmlFor={`sp_l_${i}`}>
            <input
              id={`sp_l_${i}`}
              type="url"
              className="tg-control"
              value={row.link}
              onChange={(e) =>
                onChange(
                  value.map((r, idx) =>
                    idx === i ? { ...r, link: e.target.value } : r,
                  ),
                )
              }
            />
          </LabeledField>
          <LabeledField label="Logo URL" htmlFor={`sp_i_${i}`}>
            <input
              id={`sp_i_${i}`}
              type="url"
              className="tg-control"
              value={row.logo_url}
              onChange={(e) =>
                onChange(
                  value.map((r, idx) =>
                    idx === i ? { ...r, logo_url: e.target.value } : r,
                  ),
                )
              }
            />
          </LabeledField>
          <RemoveRowButton
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        onClick={() =>
          onChange([...value, { name: "", link: "", logo_url: "" }])
        }
      >
        + Add sponsor
      </Button>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
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
  const cap = isPremium ? 13 : FREE_IMAGE_LIMIT;
  return (
    <div className="space-y-3">
      {value.map((url, i) => (
        <div
          key={i}
          className="grid grid-cols-1 items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-[1fr_auto]"
        >
          <LabeledField label={`Image ${i + 1}`} htmlFor={`img_${i}`}>
            <input
              id={`img_${i}`}
              type="url"
              className="tg-control"
              value={url}
              onChange={(e) =>
                onChange(
                  value.map((v, idx) => (idx === i ? e.target.value : v)),
                )
              }
            />
          </LabeledField>
          <RemoveRowButton
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
          />
        </div>
      ))}
      {value.length < cap && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => onChange([...value, ""])}
        >
          + Add image URL
        </Button>
      )}
      {!isPremium && value.length >= FREE_IMAGE_LIMIT && (
        <p className="text-xs text-slate-500">
          You&apos;re at the free-tier cap. Upgrade the event to add up to 13.
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

function UploadGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
