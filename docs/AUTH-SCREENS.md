# Authentication & Onboarding — Screen Specifications

Per-screen spec for the auth surfaces. All variants share one layout component; only the
copy and a few behaviors differ. Deep behavior/logic is authoritative in
`docs/SPECIFICATION.md` (Authentication & Onboarding); this file is the screen-by-screen
reference for building/verifying the UI.

> **No social sign-in.** Authentication is **email + password only**. Do NOT build Google
> or any OAuth/social login. If a restored design includes a "Continue with Google" (or
> similar) button, remove it.

## Shared layout & rules (all variants)
- Two-column layout: form/inputs on the **left**; a sticky, full-height **image on the right**
  with a glassmorphism overlay (headline, labels, chips). Dark overlay behind the text for
  legibility. Backdrop uses an image from `public/`.
- Implemented as **one shared auth-layout component** that takes copy/variant as props — no
  duplicate per-variant layouts.
- **Blocked-account rule:** on login or any protected page, if the account is `blocked` →
  force logout + popup "We're sorry to let you know that your account has been indefinitely
  blocked," redirect to login.

## 1. Login
- Fields: email (required), password (required). "Forgot password?" → reset.
- On success: onboarding complete → role-based dashboard; incomplete → onboarding.
- Link to signup.
- Copy: "Welcome back to Tournament Guru" + a short sign-in subtitle.
- Email/password only — no social sign-in button.

## 2. Signup
- Fields: email (required), password (required — **8 chars, ≥1 uppercase, ≥1 number**, enforced
  server-side).
- **No in-form type picker.** User type is decided by the entry point: **Attendee by default**,
  **Event Director** when arriving via `?type=event_director` (claim CTAs). Type is locked
  after signup.
- Role selection is a **mandatory dropdown**, phrased as a question per type:
  - Attendee: "Are you a coach, parent / spectator, team manager?"
  - Event Director: "Are you an Event Director, Event Admin, or Club Director?"
- **Terms consent is required**: a checkbox — "I agree to the Privacy Policy and
  Legal Terms" — with both documents linked (open in a new tab). Enforced
  **server-side** (`agree_terms` field error when missing); the client
  `required` attribute is UX only. The checkbox state survives a failed submit
  like every other field.
- "Skip registration" CTA → Search Events page.
- Deep-link: arriving from "Claim/List your event free" → **Event Director type pre-selected**;
  if a signed-in user clicked it → log them out first, then signup with ED pre-selected.
- On success: with email confirmations ON (prod) → redirect to the standalone
  `/signup/verify-email` screen (mail icon, 3-step "what happens next", Go-to-sign-in CTA;
  no email address in the URL). Local dev (confirmations off) → straight to onboarding.
  Failed submits keep typed values on the form; the old above-the-form success banner is gone.
- **Already-registered email** (DECISIONS S12.4): with confirmations ON, Supabase answers
  the dup signUp with a user whose `identities` array is **empty** (no error, no session) —
  `signupAction` detects that shape and returns an `email` field error ("An account with
  this email already exists. Try logging in, or reset your password.") with **Log in /
  Reset password links** under the field. The user is deliberately **not** sent to
  verify-email. Signup is the one flow that reveals account existence — password reset
  (§3) stays generic. Local dev (confirmations off) instead shows Supabase's own
  "User already registered" error via the generic error path.
- Email/password only — no social sign-in button.

## 3. Password Reset
- Field: email.
- Rate limit: **1 email / 30 seconds** — server-side enforced, with a client countdown.
- **Anti-enumeration:** identical generic response whether or not the email exists
  ("If an account exists for this email, we've sent a reset link"). Never reveal existence
  here — signup (§2) is the deliberate, sole exception (DECISIONS S12.4).
- Uses Supabase default reset emails.

## 4. ED-Claim variant
Reached via `/signup?type=event_director` from any of:
- an event's **Claim** CTA (when logged out; carries `&next=<event>`),
- the header **For Event Directors → "Claim / List Your Event Free"** sub-link,
- the For Event Directors page's **"Claim / Create Free Listing"** CTA.

Shared layout (`AuthShell variant="ed-claim"` — never a forked layout); right-panel copy differs:
- Badge: **"Tournament Guru"**
- Title: **"Become Part of the Largest and Growing Soccer Community"**
- Subtitle: "Tournament Guru lists all publicly available tournament listings from around the
  United States. Claiming your event allows Event Directors to maximize their visibility by
  customizing the information available to the thousands of tournament seekers."
- User type **auto-selected to Event Director** on the signup form.
- After auth from a claim CTA → return to the event to complete the claim (preserve intent).

## 5. Promo-Review variant (`?promo=<token>`)
The "2nd auth version" for the verified-review flow. Accessible by anon + signed-in.
- If no `?promo` value, or the promo object doesn't exist → **simple placeholder on the left**
  (no form).
- If a signed-in, onboarding-complete user opens a valid promo → redirect straight to the
  promo's event page (keep the `?promo` param).
- Left-panel copy: "To get started with your review, please provide us with a few bits of
  information about yourself so that we can best utilize and understand your review. The info
  you provide will be used only for internal purposes. We will not share your contact info with
  anyone."
- **Step 1** — Email (auto: current user, else the promo's stored email), First Name, Last Name,
  Organization. Continue → validate all present, then resolve the account:
  logged-in → save to profile; not logged-in but an account exists for that email → log them in +
  save; onboarding already complete → redirect to the promo event; no account → create one with
  type = Attendee, role = Coach.
- **Step 2** — location / gender / DOB (same as onboarding Screen 2).
- **Step 3** — team info, up to 3 teams (same as onboarding Screen 3).
- Funnel tracking records the step reached (landed / step1 / step2 / step3 / applied).

## 6. Onboarding (post-signup, signed-in only)
Same left/right chrome as the auth screens.
- Guard: authed-only; if all mandatory fields present → dashboard; else → Screen 1 with saved
  data prefilled. Logout available → login.
- **Screen 1 — Personal Information:** First name*, Last name*, role dropdown (type-scoped;
  adjustable here, **locked after completion**), Organization Title* (required for all except
  Parent/Spectator).
- **Screen 2:** Location* (Google Places autocomplete, **mandatory**), Gender* (Female/Male as
  selectable blocks, **mandatory**), Date of Birth* (masked mm/dd/yyyy text input — US format
  regardless of browser locale; posts ISO via a hidden field; **under-18 blocked**).
- **Screen 3 — Preferred Event Criteria (all optional):** Distance (No limit / <150 / <300 /
  <450 mi); Team info (Parent/Spectator = 1 team, others = up to 3; each: gender Boys/Girls/Both,
  age U4–U20 dropdown, competitive level Highest→Lowest).
- **Screen 4 — Event Directors only:** Organization logo (PNG/JPG/JPEG, 5MB max), Organization
  description* (required).
- Redirects: Attendee → Search Events; Event Director → dashboard.
- **Success screen** (`/onboarding/success`): standalone celebration card (own logo +
  check icon + role-based CTAs) rendered OUTSIDE the auth shell — its route group opts
  out of the left/right chrome so the brand logo appears exactly once.
- Role: adjustable during onboarding, locked once onboarding completes.
- Mandatory-to-complete set: first_name, last_name, role, dob, gender, location,
  organization_title (except Parent/Spectator), org_description (ED).

## Notes on scope
- **Google Places autocomplete** (Screen 2 location) is LIVE — wired via
  `LocationAutocomplete` on the client's Google Cloud project keys
  (`NEXT_PUBLIC_GOOGLE_MAPS_KEY`). It stores lat/lng/place_id/city/state/zip alongside
  `location_formatted`, feeding the Find Events distance filter. It is a separate feature
  from any map display. Without the env key the field degrades to a plain text input.
- **No social/OAuth sign-in** anywhere — email + password only.

## Design decisions log
Running log of auth-screen visual decisions (kept here so future changes stay consistent).

- **Layout:** full site Header on top (auth mode — logo-less nav + "Browse events" CTA);
  form column left over the landing aurora; sticky dusk-stadium photo right with a floating
  editorial hero (frosted badge chip, big headline + brand HighlightSwipe on "Tournament Guru",
  tagline, audience chips, real-stats metric bar).
- **Brand mark:** the full logo lockup lives at the top of the left form column. The header
  carries a compact monogram mark only (icon, no wordmark) so it doesn't read as bare.
- **Header nav:** centered; auth CTA "Browse events" is the *outline* header pill (white bg,
  accent text/border, hover tint + lift) so it reads quieter than the primary red-gradient
  actions — smaller font (~13.5px) with a touch more vertical padding than the public pill.
  The signed-in "Log out" button shares the exact same outline-pill look (`headerPillLook`).
- **Primary CTA (Sign in / Continue / etc.):** public red-gradient pill, hover-lift +
  active-press. Secondary links (Create an account, Forgot password, Contact support) use
  the canonical **TextLink** treatment from the style guide (semibold slate, soft slate
  underline, accent on hover); footer lines (Create an account, privacy note) are centered.
- **Password field:** show/hide via an eye / eye-off icon toggle (hover + active-applied
  state), not a text button.
- **Metric bar:** render ONLY when at least TWO metrics are non-zero; if 0 or 1 has data,
  omit the whole section (a lone stat looks unfinished).
- **Contrast:** faint UI-text token darkened to #5b6675 to meet WCAG AA (was #94a3b8).
