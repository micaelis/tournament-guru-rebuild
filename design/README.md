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
