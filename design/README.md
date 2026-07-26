# design/ — standalone design artifacts

Static HTML mockups for design review. **Nothing in this folder is wired to the app or
enters the Next build** — open the files directly in a browser. Once a direction is
approved, it gets implemented for real under `app/` (and these files stay as the record
of what was explored).

- `account-redesign.html` — Account-page polish round (Danny's 2026-07-26 brief),
  shown as a complete ED account (Rachel Donovan · Pacific Crest Youth Soccer) with
  all four tabs clickable (or keys 1–4). Replaces the earlier 4-direction dashboard
  exploration at this path — that direction (D · Blend) is implemented in `app/` and
  the old file lives in git history (`1e1394f`). What it applies:
  Security / Preferences / Notifications rebuilt on the Profile card language
  (split label column + fields, slate footer action bar): Security = one card with
  Login email (Verified badge) + Password (eye toggle, requirement pills) sections
  and a white danger-zone card with a red hairline; Preferences = travel-distance
  block chips + team cards using choice chips for gender/level (Age stays the one
  allowed dropdown) with a quiet dashed add-state for the unused slot;
  Notifications = a grouped In-app / Email switch matrix (ink switches, column
  headers, "Your activity" / "Your events" groups). Success alerts restyled as
  white surface cards with a small green check disc (no more emerald slab); at
  100% completeness the preview card drops the progress bar for a soft "Profile
  complete → Add an event" prompt; profile photo is a circle with upload/remove
  beside it; DOB is a proper labelled read-only field (lock icon + hint); section
  label column widened to 210px so headers + descriptions wrap cleanly. Uses the
  real `public/logo.svg` mark (wordmark inverted white for the ink rail) — no "TG"
  placeholder tile. Tailwind CDN + Google Fonts, so it needs network to render
  styled. Design-only — do not implement into `app/` until Danny signs off.
- `event-details-redesign.html` — redesigned public event-details page (Danny's
  2026-07-24 brief), shown on a premium example ("Spring Kickoff Cup — U12 Girls").
  Host + status pill + location on one line over the title; ATTENDEE + COACH as a
  flat cluster with big stars UNDER the title; "would attend again" (green %, no
  amber pill) boxed together with the fav + Share buttons as one section on the
  header's right edge;
  hero (gallery + header) sits on one white surface card; tinted icon facts row
  (Format derived from age groups); About + Age groups & pricing collapsed by
  default (colored age badges per division, per-team-pricing note as an InfoTip);
  Location = two columns — real Leaflet/OSM map with a red soccer-ball marker
  left, venue details + compact "What's included" checklist right (no Key Dates,
  no airports); right rail without price/dates (bigger org-rating stars, compact
  Call + Email rows with the org description below them, ink Contact host);
  share tiles; "Other events by this organization" cards (age/gender chips,
  location, premium card highlighted red); refined past-event cards; sponsor
  cards = initial badge + green domain link; real site footer (mirrors
  `app/components/Footer.tsx`).
  The gallery mocks both states — switch with the floating toggle (or open with
  `#no-photos`). Design-only — do not implement into `app/` until Danny signs off.
