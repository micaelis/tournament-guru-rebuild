# design/ — standalone design artifacts

Static HTML mockups for design review. **Nothing in this folder is wired to the app or
enters the Next build** — open the files directly in a browser. Once a direction is
approved, it gets implemented for real under `app/` (and these files stay as the record
of what was explored).

- `account-redesign.html` — three directions (A · Ink Rail, B · Porcelain,
  C · Broadsheet) for the elevated dashboard redesign, shown on the ED Account page
  (Profile tab). All three add a top header with an avatar/name menu ("Account" /
  "Log out") and remove "Sign out" from the sidebar. Switch directions with the
  floating pill or keys 1/2/3. Uses Tailwind CDN + Google Fonts, so it needs network
  to render styled. Awaiting Danny's pick — do not implement into `app/` before that.
