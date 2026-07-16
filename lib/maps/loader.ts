/**
 * Google Maps JS loader — browser-only, promise-singleton.
 *
 * Uses the official inline bootstrap (importLibrary) so we only ever pay for
 * the libraries we ask for. Gated on NEXT_PUBLIC_GOOGLE_MAPS_KEY: when the
 * key is absent (fresh checkout, CI, preview without env) `loadPlaces()`
 * resolves to null and callers degrade to a plain text input — the app never
 * hard-depends on Google being reachable.
 */

/* Minimal structural types for the slice of the Places (New) JS API we use —
   we deliberately don't pull in @types/google.maps for four calls. */
export type PlaceAddressComponent = {
  longText: string | null;
  shortText: string | null;
  types: string[];
};

export type PlaceLite = {
  id: string;
  formattedAddress: string | null;
  location: { lat(): number; lng(): number } | null;
  addressComponents: PlaceAddressComponent[] | null;
  fetchFields(opts: { fields: string[] }): Promise<unknown>;
};

export type PlacePrediction = {
  text: { text: string };
  toPlace(): PlaceLite;
};

export type PlacesLibrary = {
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(request: {
      input: string;
      sessionToken: object;
      includedRegionCodes?: string[];
    }): Promise<{ suggestions: { placePrediction: PlacePrediction | null }[] }>;
  };
};

type GoogleMapsGlobal = {
  maps?: { importLibrary?: (name: string) => Promise<unknown> };
};

declare global {
  interface Window {
    google?: GoogleMapsGlobal;
  }
}

let placesPromise: Promise<PlacesLibrary | null> | null = null;

/** Inject the Maps bootstrap once and load the `places` library. */
export function loadPlaces(): Promise<PlacesLibrary | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) return Promise.resolve(null);

  placesPromise ??= (async () => {
    try {
      if (!window.google?.maps?.importLibrary) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          const params = new URLSearchParams({
            key,
            v: "weekly",
            libraries: "places",
            loading: "async",
            callback: "__tgMapsReady",
          });
          (window as unknown as Record<string, unknown>).__tgMapsReady = () =>
            resolve();
          script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
          script.async = true;
          script.onerror = () => reject(new Error("Maps JS failed to load"));
          document.head.appendChild(script);
        });
      }
      const lib = await window.google!.maps!.importLibrary!("places");
      return lib as PlacesLibrary;
    } catch {
      // Offline / bad key / blocked script — callers degrade to plain text.
      return null;
    }
  })();
  return placesPromise;
}
