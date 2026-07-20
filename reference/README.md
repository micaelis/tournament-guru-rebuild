# Reference — original Bubble app export

`tournamentguru.bubble` is the full export of the legacy Bubble application
(Settings → General → export), kept here as a **read-only historical reference**
for the Next.js rebuild — the old data model (34 data types), pages (36),
and workflows (19 API workflows / backend logic) as they existed at export time.

It is **reference only**, not a spec: much of the Bubble app was
unfinished / dead / paused, and the current requirements live in `docs/`
(SPECIFICATION.md et al.), written from scratch and kept authoritative.

## ⚠ Secrets were scrubbed before commit

Every secret value in the export was replaced with the literal string
`REDACTED` (2026-07-20). The keys/structure are preserved so you can still see
*which* integrations existed, just not their credentials. Redacted (30 values):

- Stripe live + test keys (publishable and secret)
- SendGrid API key (+ its API-connector saved headers under `settings.secure.apiconnector2`)
- Google Maps / Geocode API keys, Google & Facebook OAuth client IDs + secrets
- The stored `settings.secure` username/password and every other value under `settings.secure`
- A hardcoded workflow notification recipient (personal work email)

Do **not** treat any value in this file as a live credential, and do not
re-import it into Bubble as-is.
