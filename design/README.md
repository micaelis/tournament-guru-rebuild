# design/ — standalone design artifacts

Static HTML mockups for design review. **Nothing in this folder is wired to the app or
enters the Next build** — open the files directly in a browser. Once a direction is
approved, it gets implemented for real under `app/` (and these files stay as the record
of what was explored).

- `account-redesign.html` — four directions (A · Ink Rail, B · Porcelain,
  C · Broadsheet, D · Blend) for the elevated dashboard redesign, shown on the ED
  Account page (Profile tab). All add a top header with an avatar/name menu
  ("Account" / "Log out") and remove "Sign out" from the sidebar. Switch directions
  with the floating pill or keys 1–4. Uses Tailwind CDN + Google Fonts, so it needs
  network to render styled.
  **D · Blend is the current candidate** (default on load), built from Danny's
  2026-07-24 feedback: A's shell + B's "Premium listings" sidebar card + C's profile
  preview card beside the form; bigger org-logo uploader; empty fields always show
  placeholders (inputs get `placeholder`, the preview card shows "Add your …" rows);
  selected choice-chips are red-tinted, NOT ink/black, so selections never read as
  CTAs. Still design-only — do not implement into `app/` until Danny signs off.
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
