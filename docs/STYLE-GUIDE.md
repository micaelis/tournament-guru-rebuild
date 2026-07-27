# Tournament Guru — Style Guide

The visual language for the app. Tokens and components here are the single source of
truth; build every screen from these primitives rather than one-off styles. Derived from
the approved design (`tgredesign`) and implemented in `app/components/ui/`.

---

## 1. Brand

- **Logo:** the Tournament Guru wordmark (`public` / inline SVG). Dark slate wordmark
  (`#0f172a`) with the star accent in brand red (`#dc2626`). Clear-space = the height of
  the star on all sides. Minimum height 24px.
- **Voice of the mark:** confident, sporty, trustworthy — "verified reviews you can trust."

---

## 2. Color

The palette is a slate neutral scale with a single hot accent (red) and functional colors
for ratings and status. Do not introduce new hues outside this set.

**Neutrals (slate)**
| Token | Hex | Use |
|---|---|---|
| ink | `#0f172a` | primary text, headings, dark buttons |
| body | `#475569` | body copy |
| muted | `#64748b` | secondary text |
| faint | `#94a3b8` | tertiary text, placeholders, icons |
| line | `#e2e8f0` | borders, dividers |
| line-2 | `#f1f5f9` | subtle dividers, hover fills |
| surface | `#ffffff` | cards |
| bg | `#f8fafc` | page background |

**Accent & functional**
| Token | Hex | Use |
|---|---|---|
| red / accent | `#dc2626` | primary accent, coach pool, "Guru Review", verified, primary links, upgrade CTA |
| red-bg / red-bd | `#fef2f2` / `#fecaca` | red pill/tint backgrounds & borders |
| gold | `#f59e0b` | star ratings (filled), amber emphasis |
| amber | `#b45309` | attendee pool accent |
| green | `#059669` (bg `#d1fae5`, bd `#6ee7b7`, ink `#065f46`) | open/ongoing/active/published status — the deeper "live" pairing, legible at pill size |
| blue | `#1d4ed8` (bg `#eff6ff`) | upcoming status |
| sky | `#0369a1` (bg `#f0f9ff`, bd `#bae6fd`) | draft status, info tints |
| violet | `#7c3aed` (bg `#f5f3ff`, bd `#ddd6fe`) | Spotlight tag |

**Semantic pairings to memorize:** Coach = **red**, Attendee = **amber/gold**. This split
recurs on rating pools, reviewer cards, and metric strips — keep it consistent everywhere.

---

## 3. Typography

- **Headings / display / numbers:** `Bricolage Grotesque` (700–800), tight tracking
  (`-0.02` to `-0.03em`). Used for page titles, card titles, stat values, rating numbers.
- **Body / UI:** `Inter` (400–700).
- **Eyebrows / labels / chips:** uppercase, 10–11.5px, weight 800, letter-spacing `.06–.14em`
  (occasionally `ui-monospace` for codes/eyebrows).

| Role | Font | Size | Weight |
|---|---|---|---|
| Page title (h1) | Bricolage | 26–34px | 800 |
| Card / section title | Bricolage | 15–17px | 700 |
| Stat / rating value | Bricolage | 16–18px | 800 |
| Body | Inter | 13.5–15px | 400–500 |
| Label / eyebrow | Inter | 10–11.5px | 800 (uppercase) |
| Code chip (promo) | ui-monospace | 11–12px | 700 |

---

## 4. Spacing, radius, elevation

- **Radius:** cards `12–16px`; pills/chips/avatars `9999px`; buttons `9–10px`; small tags `6–8px`.
- **Card padding:** `12–18px`.
- **Elevation is restrained — borders, not shadows.** Cards sit on a `1px` border and change
  **border color on hover** (`#e2e8f0` → `#cbd5e1`/`#94a3b8`), NOT box-shadow. This keeps the
  UI flat and calm. Reserve soft shadows only for lifted interactive chips/primary buttons on hover.
- **Focus:** inputs get `border: ink` + a `3px` soft ring (`rgba(15,23,42,.06)`).
- **Input hover:** form controls (`.tg-control`) shift border color `#e2e8f0` → `#cbd5e1` on
  hover — same border-not-shadow language as cards. Focus, invalid, and disabled states win
  over the hover color.
- **`.tg-control` lives in `@layer components`** so Tailwind utilities can override its
  defaults — icon inputs pad with `pl-12` (icon container `w-11`), toolbar selects size with
  `w-auto min-w-[…]`. Unlayered, the class silently beat every utility (DECISIONS S12.6).
- **Hover motion:** interactive chips/primary buttons may lift `translateY(-1px)` with a soft
  shadow; cards do not move. Every lifting control transitions **transform AND shadow**
  smoothly — use `transition-all duration-200` (or the global a/button transition), never
  `transition-transform` alone: the Tailwind utility overrides the global rule's
  box-shadow/color transition, so paired shadow or color changes snap (S12.28).

---

## 5. Components (`app/components/ui/`)

Build screens from these; don't hand-roll equivalents.

- **Button** — variants: `primary` (dark `#0f172a`, white text; lifts 1px with a soft
  shadow on hover), `secondary` (the crisp ink-outline: transparent surface, 1.5px
  slate-400 border, bold ink label; hover darkens the border to ink with a whisper of
  ink tint — a real but subordinate action: Duplicate/Share, Save as draft, "+ Add row"
  CTAs, per-section Edit links. NEVER a white or gray fill — legibility comes from the
  border weight, so the same button holds up on white cards and the slate wash alike;
  supersedes the S12.17 slate-100 fill, see DECISIONS S12.31), `accent` (brand-red
  fill — RESERVED for premium/upgrade CTAs, the color table's "upgrade CTA" role;
  never a general-purpose primary), `ghost` (transparent with a soft slate-200
  border — tertiary/bail-out: Cancel, dialog dismiss), `danger` (the unified red-tint
  destructive treatment: red-50 fill, red-200 border, red-700 text — the
  RemoveIconButton palette; every destructive control shares it), `link` (the
  TextLink treatment), and the settled **two-tier secondary** pair (S12.35): `outline`
  (white surface, 1px ink-navy border — container-level actions like a tournament
  card's Add event / Edit tournament) over `soft` (gray-blue slate-100 fill, no
  border — the row-level actions subordinate to them: Edit, the "…" trigger). The
  pair is live on the ED events list only for now; replacing `secondary`/`ghost`
  app-wide is a tracked follow-up. Sizes: `xs`, `sm`, `md`, `lg`.
  All transitions run 150ms ease-out. `loading` disables the button and prepends the
  shared **Spinner** — pass the pending flag from `useActionState`, or use **FormButton**
  (a submit Button that wires `useFormStatus` automatically, with an optional
  `pendingLabel` swap like "Saving…"). Every in-flight action shows the spinner; don't
  hand-roll "…" or label-only pending states. Forms with **multiple submit buttons**
  give each FormButton a `name`/`value` submitter pair (e.g. `name="intent"
  value="draft"`): only the clicked button spins while its siblings merely disable,
  and the server reads the same pair off the FormData — no hidden intent input
  (S12.16).
- **Card** — white surface, `1px` line border, radius 14–16px, border-color hover. The base
  container for tournaments, events, reviews, panels.
- **Chip** — small pill: `count` (slate, neutral), `prem` (red, "Premium"), `spons` (violet,
  "Spotlight"), role/eyebrow variants. Uppercase, 10px, weight 800.
- **HeaderCountChip** — the canonical **page-header count** (S12.41): a white pill beside
  the page title — 22px circular slate-100 icon medallion, the count in Bricolage 800 ink,
  quiet slate-500 label, hairline border + subtle shadow. Takes `{icon, count, label}`.
  EVERY count that sits beside a page `<h1>` renders through it (FAQ answers/topics,
  My Reviews reviews/published/drafts, ED events tournaments/events/reviews) — never a
  plain-text "N things" subtext on the title line again. Scope is the PAGE header only:
  inline sub-counts (a tournament group's "3 events" meta line) stay plain text.
- **Switch** — the binary on/off toggle (notification channels). Controlled only, and
  deliberately **button-backed** (`role="switch"` + `aria-checked`), not a checkbox:
  React's automatic post-action form reset reverts checkbox DOM state to the page-load
  attribute, so a just-saved "off" rendered as "on" (S12.10) — buttons and the
  state-derived hidden input (`name=on` only while checked, Checkbox's wire format) are
  immune. Track = ink when on (the Checkbox fill rule), never red — the accent marks
  *choices*, not on/off state. Use for settings matrices; Checkbox stays for consent and
  inline confirmations.
- **Alert** (auth `parts.tsx`) — form-level messages on auth screens and dashboard forms.
  `error` = the red-tinted block; `info`/success = a **white surface card with a small
  green-check disc** — green lives only in the icon, so the note sits calmly on the gray
  dashboard bg and the white auth cards alike (S12.9). Never a flat green slab. The Toast's
  success tone uses this exact treatment (S12.29) — the two confirmation surfaces are ONE
  style.
- **StatusPill** — the event lifecycle pill; one color per status (see §6), and every
  lifecycle tone leads with a matching status dot. Also
  carries the badge tones `premium` (solid red) and `spotlight` (violet outline) so
  the event badge pair renders through the same primitive everywhere. The live green
  (`ongoing`/`success`) is the deeper emerald-100 wash + emerald-300 border pairing —
  the paler emerald-50 tint washed out at pill size. Draft is the sky tint and
  Concluded the crisp white-surface ink-outline (S12.36) — never amber (gold belongs
  to ratings), never violet (Spotlight owns it), never a gray slab.
- **StarRating** — gold filled stars (`#f59e0b`) on `#e2e8f0` empty, 0.5 step, with the numeric
  value in Bricolage bold and optional `(x reviews)` count. The canonical rating display —
  do not use `react-simple-star-rating`.
- **MetricStrip** — the horizontal metric row (Overall / Coach / Attendee + the 6 categories);
  Coach value in red, Attendee in amber.
- **Avatar** — circular element whose placeholder is the **red-bg treatment**: brand accent
  red (`--color-accent` / red-600) with white initials — the ONE placeholder style app-wide,
  dashboard and public. Accepts an optional `src` prop: when provided, renders an `<img>` with
  `object-fit: cover` filling the circle (no padding, no `object-contain`); when absent — or
  when the URL fails to load — renders the red initials badge. All circle avatars/logos
  (org logos, profile photos, reviewer avatars) must go through Avatar so the fill rule
  applies uniformly.
- **SafeImg** — `<img>` wrapper that swaps to a caller-supplied `fallback` (default: nothing)
  when the source is missing or fails to load. EVERY non-circular image whose URL comes from
  the DB or a remote host renders through it (event logos, photos, sponsor logos, portraits)
  so a dead URL never paints the browser's broken-image glyph. Callers still scheme-check via
  `safeImageSrc`. Don't use next/image for per-event remote hosts — the optimizer only accepts
  allow-listed hostnames.
- **ImageUploadField** — the image input for every DB-backed logo/photo (event logo, sponsor
  logos, gallery, org logo, profile photo). Controlled (`value`/`onChange`), with BOTH a real
  upload (pick a PNG/JPG → straight to the bucket via `lib/storage/upload`) and a paste-a-URL
  fallback in the same field. Shows a `SafeImg` thumbnail whose empty state is an
  **icon-led tile** (picture glyph + "No image"; photo glyph + "No photo" on circle
  fields — S12.20, never a bare text string), a soft non-blocking "couldn't load that
  image" warning on a dead URL, and a
  Clear button. Pass `name` to submit the value in an uncontrolled `<form>`. In list rows
  (event images), pass `onRemove` — it renders a Remove button in the same cluster as
  Upload (replacing Clear) so the pair reads as one control — since S12.17 that Remove
  is the shared RemoveIconButton, not a text button; never park a lone Remove at
  the far edge of the row.
  `thumbSize="lg"` renders the preview as a fixed **square tile** (`h-36 w-36`) instead of
  the slim column-height thumb — use it for org logos and other hero-ish images that must
  never stretch with the row. `thumbSize="sm"` is the compact fixed square (`h-20 w-20`,
  rounded corners) for logos inside list rows — sponsor logos always use it; a sponsor
  logo is a square tile, never a row-height rectangle (S12.19). `thumbShape="circle"`
  renders a fixed **circular** thumb
  (`h-24 w-24`) — the form-side mirror of Avatar's circle rule; use it for profile photos
  (S12.9). Never build a bare URL text input for a DB image again — use this.
- **SearchInput** — the one text-search treatment app-wide: a `tg-control`
  `type="search"` input with the magnifying-glass glyph inset left. `className`
  styles the wrapper (widths / flex); everything else spreads onto the input.
  Every plain search box (dashboard tables, FAQ, users) renders through it —
  never a bare `tg-control` search input again. The bespoke marketing search
  bars (hero, overlay, header) keep their own styled glyphs.
- **RemoveIconButton** — the row-removal control for editable lists (age groups,
  sponsors, milestones, gallery images): a trash glyph on the soft red tint
  (`bg-red-50` / `text-red-600`, red-100 border), `md` (40px, aligns with control rows)
  or `sm` (32px, sits in size-sm button clusters). Always give it a contextual
  `label` ("Remove sponsor 2") — it is the accessible name and tooltip. Never a plain
  "Remove" text button in a list row again (S12.17).
- **TextLink** — the canonical inline text link (the signup page's "browse events"
  treatment): semibold slate-700 with a soft slate underline, warming to the red accent
  (text + decoration) on hover. Font-size inherits from the surrounding copy; pass a
  `text-*` class only when the context needs a specific scale. Renders `next/link` for
  in-app routes and a plain `<a>` for scheme-prefixed hrefs (`http:`, `mailto:`, …).
  EVERY link that sits in or beside body copy uses it — auth cross-links, back-links,
  helper rows, legal body links, table utility links. Buttons that look like text links
  (CSV downloads, filter Reset/Clear, inline sign-out) share the exported
  `textLinkClass`. The one intentional exception: **entity-title links** (event/reviewer
  names in tables, cards, dashboards) stay bold slate-900 with `hover:text-red-600` and
  no underline at rest — that's a title pattern, not a text link. Don't hand-roll either
  style again.
- **Table** — dashboard list rows; use a shared grid template with a fixed-width actions column
  so columns align across rows (never `auto`-width action cells).
- **EmptyState** — the shared "no results / nothing yet" placeholder (S12.42): a white
  card (solid hairline border + the card shadow — **never a dashed border, never a bare
  red dot**) with an icon disc, optional red corner `badgeIcon`, friendly title/body, and
  caller-supplied `action` + `secondary` slots. Two illustrated tones: `gold` — the
  celebratory first-run weight (floating amber disc, warm radial wash, twinkle accents;
  all motion killed by the global reduced-motion rule) — and the default `slate` (calm
  64px slate-100 disc) for no-matches states. `compact` stays the quiet one-liner for
  filtered-no-results rows. Titles are friendly prompts, not shouty headlines; the
  primary CTA is a real Button (accent for first-run pushes), the secondary a TextLink.
- **ConfirmDialog** — destructive/confirm popups (delete tournament, unfollow, decline claim).
- **USDateText / USDateField** — masked `mm/dd/yyyy` date input (native `type="date"`
  localizes its placeholder to the browser, not the app). Visible text is always US format;
  forms/callers receive ISO `yyyy-mm-dd` (hidden input or `onIsoChange`). `USDateField` is the
  labelled Field-wrapped variant (onboarding DOB); `USDateText` is bare (filter drawer +
  event form dates). The `calendar` prop (S12.22; default ON for `USDateField`, opt-in on
  `USDateText` — the event form's date fields pass it) adds the **in-house calendar
  popover**: a glyph toggle inside the input opens a Sunday-first month grid with
  month/year selects and ‹ › paging; the picked day wears the S12.3 red tint; the masked
  input stays first-class (the calendar is an addition, never a replacement, and never the
  native picker). Bare embeds with their own shells (filter drawer) stay typing-only.
  ALL date entry goes through these — never native `type="date"` — and
  rendered dates always pass an explicit `"en-US"` locale, never `undefined` (CLAUDE.md
  "Dates" convention: mm/dd/yyyy everywhere, dd/mm/yyyy nowhere).
- **Toast** — transient confirmations ("Link copied", "Downloaded", "Saved"), bottom-right
  stack, 4 s auto-dismiss. The **success tone mirrors the inline Alert exactly** — white
  surface card + the small green-check disc, green only in the icon, slate-800 text — plus
  `shadow-lg` for the float (S12.29). Never the pale flat-green slab: it read as "nothing
  happened". Error keeps the red-tinted block; info is the plain white card.
- **Dashboard shell** (`app/dashboard/{Sidebar,Header,icons}.tsx`) — the ink rail +
  top header pair. Sidebar: `#0f172a`, the **real brand mark** at the top (mark-only
  crop of `public/logo.svg` inlined with the swoosh filled white and the star + T
  keeping the logo's own reds, wordmark as text beside it — NOT the filter-inverted
  `TGLogo variant="light"`, which would flatten the reds to white), per-item stroke
  icons, active item = white/10
  fill + 3px red left bar, section eyebrows, thin **slate-blue scrollbar**
  (`.tg-scroll-dark`: `#334155` thumb, `#475569` hover — never the default gray);
  bottom slot is role context (ED: Premium-listings pointer + org card; attendee:
  club card; admin: none) — never session actions. Header: sticky white/95 blur,
  breadcrumb left, and the **user pill** right (S12.42): a bordered white pill —
  ringed 34px Avatar, name stacked over the ROLE in its semantic color (Coach = red,
  other attendee roles = amber, ED/Admin = neutral slate — the MetricStrip pair), and
  a chevron in a 22px slate disc that flips when the menu opens. The dropdown leads
  with a slate-50 header block (avatar + name + email + a tinted role chip in the same
  semantic tone), then **Account**, **Log out** — the only sign-out surface in the
  dashboard. Icons come from the shared `Icon` lookup in
  `app/dashboard/icons.tsx`; don't inline one-off SVGs in shell code.
- **Choice chips (selected state)** — selectable blocks (user type, role, gender,
  distance, flag reasons) mark the checked option with the **soft red tint**:
  `border-red-600 bg-red-50 text-red-700`. NEVER solid ink — `bg-slate-900` is
  reserved for primary CTAs, and a selection must not read as a button
  (S12.3).
- **Spinner** — the shared inline spinner (`tg-spin` keyframe, border-current circle,
  em-sized so it tracks the text scale, `currentColor` tint). Button/FormButton render it
  when pending; section loaders (like the search results' "Searching…" overlay pill)
  compose it with their own copy.
- **Navigation loading** (S12.13) — two app-wide affordances for server-rendered
  navigations, no per-page code: **NavigationProgress**
  (`app/components/NavigationProgress.tsx`, mounted once in the root layout) is a
  2.5px accent top bar that starts on internal link clicks / back-forward, eases to
  ~80%, snaps to 100% on route commit, and stays invisible for navigations faster
  than ~120ms; plus route-group **`loading.tsx` skeletons** (`app/dashboard/`,
  `app/(site)/`) — neutral `animate-pulse` slate blocks (`bg-slate-200/50–80`,
  `rounded-2xl` cards) shown inside the persisting shell chrome. Skeletons stay
  generic (title / stat strip / cards) — never mimic one specific page's layout.

---

## 6. Status & badge system

**Event status pill (date-derived; each its own color):**
| Status | Text / dot | Background |
|---|---|---|
| Upcoming | blue `#1d4ed8` / blue dot | `#eff6ff` |
| Ongoing | green `#065f46` / `#059669` dot | `#d1fae5` |
| Concluded | slate `#334155` / slate dot | white, `1px` slate-400 outline |
| Draft | sky `#0369a1` / sky dot | `#f0f9ff` |
| Canceled | red `#dc2626` / red dot | `#fef2f2` (card also grayed) |

**Badges & tags:**
- **Premium** — solid red pill on the event card (per-event flag; StatusPill tone `premium`).
- **Spotlight** — violet outline pill on the event card (internal column: `is_general_ad`;
  StatusPill tone `spotlight`).
- **Guru Review / Verified** — solid red badge on verified-coach reviews; the review card is
  visually elevated. Coach role chip additionally shows the 8-char promo code.
- **Account chip** — `Registered` (linked) / `Invited` (no account yet) on promo rows.

**Layout patterns for Spotlight events:**
- **Search page:** Spotlight events render in a horizontal-scroll section above the main
  result list. Cards scroll left/right; the section is hidden when no Spotlight events match
  the current filters.
- **Attendee dashboard (Favorites / Activity):** a sticky 270px right column displays up to
  3 Spotlight events (ended ≤1 month ago, shuffled per load, hidden if none qualify).

---

## 7. Interaction & states

- Every list has an **EmptyState**; every destructive action a **ConfirmDialog**; every
  irreversible/successful action a **Toast**.
- **Missing media** degrades gracefully: logo-only event hero looks intentional; missing profile
  photo → the red-bg initials placeholder (see Avatar).
- Canceled events render **grayed out**; drafts are visible only on the owner's dashboard.
- Copy-to-clipboard, downloads, and sends always give visible confirmation.

---

## 8. Accessibility

- Maintain AA contrast — the slate text tokens on white/`#f8fafc` all pass; check any colored
  text on colored pills.
- All interactive controls keyboard-reachable; modals trap focus, close on Escape, and lock
  body scroll.
- Provide `alt` text on images (event logos, avatars, sponsor logos) and labels on inputs.
- Star ratings and status colors are never the sole signal — pair with a number or label.

---

## 9. Do / Don't

- **Do** build from `app/components/ui/` primitives; **don't** introduce one-off button/card styles.
- **Do** change border color on hover; **don't** add heavy drop shadows to cards.
- **Do** keep Coach = red, Attendee = amber everywhere; **don't** swap or reassign those.
- **Do** use selectable blocks for choices (user type, role, gender, distance, team fields);
  **don't** use dropdowns except the team Age list (the one intentional exception).
- **Do** mark the checked choice with the red tint (`bg-red-50` / `border-red-600` /
  `text-red-700`); **don't** fill selections with ink — solid `#0f172a` means "button".
- **Do** use fixed-width action columns in tables so rows align; **don't** let action cells auto-size.
