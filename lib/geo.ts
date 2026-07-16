/**
 * Geo helpers shared by the forms that carry a Places-autocomplete payload
 * (onboarding step 2, account profile, ED event form) and the search-side
 * distance math. The hidden-input contract comes from LocationAutocomplete:
 * `{prefix}_lat/_lng/_place_id/_city/_state_full/_state_abbr/_zip`.
 */

export type GeoFields = {
  location_lat: number | null;
  location_lng: number | null;
  location_place_id: string | null;
  location_city: string | null;
  location_state_full: string | null;
  location_state_abbr: string | null;
  location_zip: string | null;
};

/**
 * Parse and sanity-check the hidden geo inputs. All-or-nothing on the
 * coordinates: without a valid lat/lng pair every geo field is null, so a
 * hand-typed (never geocoded) location stores text only — coordinates in the
 * DB always came from a picked suggestion.
 */
export function parseGeoFields(
  formData: FormData,
  prefix = "location",
): GeoFields {
  const s = (k: string) => String(formData.get(`${prefix}_${k}`) ?? "").trim();
  const lat = Number.parseFloat(s("lat"));
  const lng = Number.parseFloat(s("lng"));
  const valid =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;
  if (!valid) {
    return {
      location_lat: null,
      location_lng: null,
      location_place_id: null,
      location_city: null,
      location_state_full: null,
      location_state_abbr: null,
      location_zip: null,
    };
  }
  return {
    location_lat: lat,
    location_lng: lng,
    location_place_id: s("place_id").slice(0, 256) || null,
    location_city: s("city").slice(0, 120) || null,
    location_state_full: s("state_full").slice(0, 60) || null,
    location_state_abbr: s("state_abbr").slice(0, 2).toUpperCase() || null,
    location_zip: s("zip").slice(0, 10) || null,
  };
}

/** Great-circle distance in miles (Haversine, mean Earth radius). */
export function milesBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.7613; // miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Bounding box for a radius around a point — the cheap SQL prefilter; exact
 * Haversine runs on the candidates. Longitude span widens with latitude;
 * clamped at the poles where cos → 0.
 */
export function boundingBox(lat: number, lng: number, miles: number) {
  const latDelta = miles / 69.0; // ~69 miles per degree latitude
  const cos = Math.cos((lat * Math.PI) / 180);
  const lngDelta = cos > 0.01 ? miles / (69.172 * cos) : 180;
  return {
    minLat: Math.max(-90, lat - latDelta),
    maxLat: Math.min(90, lat + latDelta),
    minLng: Math.max(-180, lng - lngDelta),
    maxLng: Math.min(180, lng + lngDelta),
  };
}

/** The distance_pref enum ↔ miles mapping used by search + the filter UI. */
export const DISTANCE_OPTIONS = [
  { value: "no_limit", miles: null, label: "No limit" },
  { value: "miles_150", miles: 150, label: "Within 150 miles" },
  { value: "miles_300", miles: 300, label: "Within 300 miles" },
  { value: "miles_450", miles: 450, label: "Within 450 miles" },
] as const;

export function milesForPref(pref: string | null | undefined): number | null {
  return DISTANCE_OPTIONS.find((o) => o.value === pref)?.miles ?? null;
}
