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
  Host + status pill + location + fav/share buttons on one line over the title;
  ATTENDEE + COACH + "would attend again" as a flat compact cluster ON the title
  line (right-aligned, no box; wraps under the title on narrow screens; green %,
  no amber pill);
  tinted icon facts row (Format derived from age groups); About + Age groups &
  pricing collapsed by default; Location = two columns — real Leaflet/OSM map with
  a red soccer-ball marker left, venue details + premium facility features right
  (no Key Dates, no airports); right rail without price/dates (bigger org-rating
  stars, description leads, reference-style Call + Email rows, ink Contact host);
  share tiles; compact "More from this org" list; refined past-event cards;
  monogram sponsor wall; real site footer (mirrors `app/components/Footer.tsx`).
  The gallery mocks both states — switch with the floating toggle (or open with
  `#no-photos`). Design-only — do not implement into `app/` until Danny signs off.
