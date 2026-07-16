"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  loadPlaces,
  type PlacesLibrary,
  type PlaceLite,
} from "@/lib/maps/loader";
import { useLiveValidation } from "@/app/components/ui/useLiveValidation";

/** Geo payload resolved from a picked suggestion. */
export type ResolvedPlace = {
  formatted: string;
  lat: number;
  lng: number;
  placeId: string;
  city: string;
  stateFull: string;
  stateAbbr: string;
  zip: string;
};

type GeoFields = {
  lat: string;
  lng: string;
  place_id: string;
  city: string;
  state_full: string;
  state_abbr: string;
  zip: string;
};

const EMPTY_GEO: GeoFields = {
  lat: "",
  lng: "",
  place_id: "",
  city: "",
  state_full: "",
  state_abbr: "",
  zip: "",
};

function componentText(
  place: PlaceLite,
  type: string,
  form: "long" | "short" = "long",
): string {
  const c = (place.addressComponents ?? []).find((x) => x.types.includes(type));
  return (form === "long" ? c?.longText : c?.shortText) ?? "";
}

/**
 * Location input backed by Google Places autocomplete (Places API New).
 *
 * Renders a labelled tg-control text input plus HIDDEN inputs
 * `{fieldPrefix}_lat/_lng/_place_id/_city/_state_full/_state_abbr/_zip`
 * so plain Server Action forms pick up the geo payload with zero client
 * plumbing. Editing the text after picking a suggestion clears the hidden
 * geo fields — stored coordinates never disagree with the visible text.
 *
 * Without NEXT_PUBLIC_GOOGLE_MAPS_KEY (or if the script fails) it behaves
 * as the plain text input it replaces.
 */
export function LocationAutocomplete({
  label,
  name,
  fieldPrefix = "location",
  defaultValue = "",
  defaultGeo,
  placeholder,
  hint,
  required,
  error,
  validate,
  onResolved,
}: {
  label: string;
  name: string;
  /** Prefix for the hidden geo inputs (e.g. "location" → location_lat …). */
  fieldPrefix?: string;
  defaultValue?: string;
  /** Pre-fill the hidden geo fields (edit forms with a saved place). */
  defaultGeo?: Partial<GeoFields>;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  error?: string;
  validate?: (value: string) => string | null;
  onResolved?: (place: ResolvedPlace | null) => void;
}) {
  const inputId = useId();
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [geo, setGeo] = useState<GeoFields>({ ...EMPTY_GEO, ...defaultGeo });
  const [suggestions, setSuggestions] = useState<
    { text: string; pick: () => void }[]
  >([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const { shownError, revalidate } = useLiveValidation(error, validate);

  const placesRef = useRef<PlacesLibrary | null>(null);
  const sessionRef = useRef<object | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadPlaces().then((lib) => {
      if (alive) placesRef.current = lib;
    });
    return () => {
      alive = false;
    };
  }, []);

  const resolvePlace = async (prediction: {
    text: { text: string };
    toPlace(): PlaceLite;
  }) => {
    try {
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: ["location", "addressComponents", "formattedAddress", "id"],
      });
      // A picked place ends the autocomplete billing session.
      sessionRef.current = null;
      const lat = place.location?.lat();
      const lng = place.location?.lng();
      if (lat == null || lng == null) return;
      const resolved: ResolvedPlace = {
        formatted: place.formattedAddress || prediction.text.text,
        lat,
        lng,
        placeId: place.id,
        city:
          componentText(place, "locality") ||
          componentText(place, "sublocality") ||
          componentText(place, "postal_town"),
        stateFull: componentText(place, "administrative_area_level_1"),
        stateAbbr: componentText(place, "administrative_area_level_1", "short"),
        zip: componentText(place, "postal_code"),
      };
      setValue(resolved.formatted);
      setGeo({
        lat: String(resolved.lat),
        lng: String(resolved.lng),
        place_id: resolved.placeId,
        city: resolved.city,
        state_full: resolved.stateFull,
        state_abbr: resolved.stateAbbr,
        zip: resolved.zip,
      });
      setOpen(false);
      setSuggestions([]);
      onResolved?.(resolved);
    } catch {
      // Details fetch failed — keep the typed text, just without geo.
      setOpen(false);
    }
  };

  const onInput = (next: string, el: HTMLInputElement) => {
    setValue(next);
    revalidate(el);
    // Typed text no longer matches the picked place — drop the geo payload.
    setGeo(EMPTY_GEO);
    onResolved?.(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const lib = placesRef.current;
    if (!lib || next.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        sessionRef.current ??= new lib.AutocompleteSessionToken();
        const { suggestions: found } =
          await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: next.trim(),
            sessionToken: sessionRef.current,
            includedRegionCodes: ["us"],
          });
        const items = found
          .map((s) => s.placePrediction)
          .filter((p): p is NonNullable<typeof p> => p != null)
          .slice(0, 6)
          .map((p) => ({
            text: p.text.text,
            pick: () => void resolvePlace(p),
          }));
        setSuggestions(items);
        setHighlight(-1);
        setOpen(items.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 250);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      suggestions[highlight].pick();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-[13px] font-semibold text-slate-800"
      >
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onInput(e.target.value, e.currentTarget)}
        onKeyDown={onKeyDown}
        aria-invalid={Boolean(shownError) || undefined}
        className="tg-control"
      />
      {Object.entries(geo).map(([key, v]) => (
        <input
          key={key}
          type="hidden"
          name={`${fieldPrefix}_${key}`}
          value={v}
        />
      ))}
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl bg-white"
          style={{
            border: "1px solid var(--color-border)",
            boxShadow: "0 18px 40px -18px rgba(15,23,42,.28)",
          }}
        >
          {suggestions.map((s, i) => (
            <li key={`${s.text}-${i}`} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                // onMouseDown so the pick wins the race against input blur.
                onMouseDown={(e) => {
                  e.preventDefault();
                  s.pick();
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`block w-full cursor-pointer px-3.5 py-2.5 text-left text-[13.5px] font-medium text-slate-800 ${
                  i === highlight ? "bg-[var(--color-surface-alt)]" : "bg-white"
                }`}
                style={{ border: 0 }}
              >
                {s.text}
              </button>
            </li>
          ))}
        </ul>
      )}
      {hint && !shownError && (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
      {shownError && (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {shownError}
        </span>
      )}
    </div>
  );
}
