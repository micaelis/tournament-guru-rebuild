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
| amber | `#b45309` | attendee pool accent, draft status text |
| green | `#16a34a` (bg `#ecfdf5`, bd `#bbf7d0`, ink `#15803d`) | open/ongoing/active status |
| blue | `#1d4ed8` (bg `#eff6ff`) | upcoming status |
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
- **Hover motion:** interactive chips/primary buttons may lift `translateY(-1px)` with a soft
  shadow; cards do not move.

---

## 5. Components (`app/components/ui/`)

Build screens from these; don't hand-roll equivalents.

- **Button** — variants: `primary` (dark `#0f172a`, white text), `default` (white, bordered),
  `ghost`. Sizes: default, `sm`. Radius 9–10px. Primary lifts on hover.
- **Card** — white surface, `1px` line border, radius 14–16px, border-color hover. The base
  container for tournaments, events, reviews, panels.
- **Chip** — small pill: `count` (slate, neutral), `prem` (red, "Premium"), `spons` (violet,
  "Spotlight"), role/eyebrow variants. Uppercase, 10px, weight 800.
- **StatusPill** — the event lifecycle pill; one color per status (see §6).
- **StarRating** — gold filled stars (`#f59e0b`) on `#e2e8f0` empty, 0.5 step, with the numeric
  value in Bricolage bold and optional `(x reviews)` count. The canonical rating display —
  do not use `react-simple-star-rating`.
- **MetricStrip** — the horizontal metric row (Overall / Coach / Attendee + the 6 categories);
  Coach value in red, Attendee in amber.
- **Avatar** — circular initials with a deterministic color from a fixed palette; neutral
  placeholder icon when no photo.
- **Table** — dashboard list rows; use a shared grid template with a fixed-width actions column
  so columns align across rows (never `auto`-width action cells).
- **EmptyState** — the shared "no results / nothing yet" placeholder; reuse everywhere with
  adjusted copy + CTA (e.g. "Find Events").
- **ConfirmDialog** — destructive/confirm popups (delete tournament, unfollow, decline claim).
- **Toast** — transient confirmations ("Link copied", "Downloaded", "Saved").
- **Spinner** — inline/section loading.

---

## 6. Status & badge system

**Event status pill (date-derived; each its own color):**
| Status | Text / dot | Background |
|---|---|---|
| Upcoming | blue `#1d4ed8` | `#eff6ff` |
| Ongoing | green `#15803d` | `#ecfdf5` |
| Concluded | slate `#475569` | `#f1f5f9` |
| Draft | amber `#b45309` / gold dot | `#fffbeb` |
| Canceled | red `#dc2626` | `#fef2f2` (card also grayed) |

**Badges & tags:**
- **Premium** — solid red pill on the event card (per-event flag).
- **Spotlight** — violet outline pill on the event card (internal column: `is_general_ad`).
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
  photo → neutral placeholder icon.
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
- **Do** use fixed-width action columns in tables so rows align; **don't** let action cells auto-size.
