"use client";

import type { Route } from "next";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Card,
  SafeImg,
  StatusPill,
  TextLink,
  cn,
  eventStatusTone,
  textLinkClass,
} from "@/app/components/ui";
import { Icon, type IconName } from "@/app/dashboard/icons";
import { PREMIUM_IMAGE_LIMIT } from "@/lib/enums";

/**
 * The Add-on Details page (design/upgrade-addon-redesign.html), shipped
 * as a COMING-SOON preview: payments are deferred for launch, so the
 * page sells the two add-ons — Premium Listing ($900) and General Ads
 * ($300) — behind one segmented toggle, but nothing is purchasable.
 * The Activate buttons are disabled "Coming soon" stubs and there is no
 * checkout, inquiry form, or mutation of any kind. Reached from an
 * event's Upgrade CTA (row + details page + edit-form prompt) and from
 * the sidebar's "Premium listings → Learn more" pointer.
 */

export type AddOnEventContext = {
  id: string;
  title: string;
  logoUrl: string | null;
  status: "Draft" | "Upcoming" | "Ongoing" | "Concluded" | "Canceled";
  dateRange: string | null;
  isPremium: boolean;
  isGeneralAd: boolean;
};

/** Launch prices, display-only until payments ship. */
const PREMIUM_PRICE = "$900";
const ADS_PRICE = "$300";

type AddOnKey = "premium" | "ads";

export function AddOnsPreview({
  event,
}: {
  event: AddOnEventContext | null;
}) {
  const [tab, setTab] = useState<AddOnKey>("premium");

  return (
    <div>
      <div>
        <TextLink
          href={
            (event
              ? `/dashboard/events/${event.id}`
              : "/dashboard/events") as Route
          }
          className="text-[13px]"
        >
          ← {event ? `Back to ${event.title}` : "Back to events"}
        </TextLink>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-[var(--font-heading)] text-[26px] font-extrabold tracking-tight text-slate-900">
          Add-on Details
        </h1>
        <StatusPill tone="warning">Coming soon</StatusPill>
      </div>
      <p className="mt-1 text-[13.5px] leading-relaxed text-slate-600">
        Whether you unlock premium features or an advertising option, your
        event is sure to be noticed.
      </p>

      {/* The page's one non-negotiable message: nothing here is
          purchasable yet. */}
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-white text-amber-500 ring-1 ring-amber-200">
          <Icon name="clock" className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-slate-900">
            Coming soon — add-ons aren&apos;t purchasable yet
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600">
            We&apos;re putting the finishing touches on payments. This page is
            a preview of what each add-on will include — when they launch,
            you&apos;ll activate them right here.
          </p>
        </div>
      </div>

      {/* the one big decision: which add-on */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Add-on options"
          className="inline-flex flex-wrap gap-1 rounded-full border-[1.5px] border-slate-300 bg-white p-1 shadow-sm"
        >
          <AddOnTab
            id="premium"
            icon="star"
            label="Premium Listing"
            price={PREMIUM_PRICE}
            selected={tab === "premium"}
            onSelect={() => setTab("premium")}
          />
          <AddOnTab
            id="ads"
            icon="megaphone"
            label="General Ads"
            price={ADS_PRICE}
            selected={tab === "ads"}
            onSelect={() => setTab("ads")}
          />
        </div>
        <p className="hidden items-center gap-1.5 text-[11.5px] font-semibold text-slate-500 sm:inline-flex">
          <Icon name="clock" className="h-3.5 w-3.5" />
          Coming soon · one-time payment per event
        </p>
      </div>

      {tab === "premium" ? (
        <PremiumPanel event={event} onCrossSell={() => setTab("ads")} />
      ) : (
        <AdsPanel event={event} onCrossSell={() => setTab("premium")} />
      )}

      {/* shared closer — informational only; no inquiry form while the
          feature is pre-launch */}
      <Card className="mt-8 flex flex-wrap items-center gap-4 p-5 md:p-6">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
          <Icon name="lifebuoy" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-[var(--font-heading)] text-[16px] font-extrabold tracking-tight text-slate-900">
            Not sure which add-on fits?
          </p>
          <p className="mt-0.5 text-[12.5px] font-medium text-slate-600">
            Compare them now — when activation opens you&apos;ll choose right
            from this page. No action needed today.
          </p>
        </div>
      </Card>
    </div>
  );
}

/* ── segmented toggle ─────────────────────────────────────────────── */

function AddOnTab({
  id,
  icon,
  label,
  price,
  selected,
  onSelect,
}: {
  id: AddOnKey;
  icon: IconName;
  label: string;
  price: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`addon-tab-${id}`}
      aria-selected={selected}
      aria-controls={`addon-panel-${id}`}
      onClick={onSelect}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-[18px] py-[9px] font-[var(--font-heading)] text-[13.5px] font-extrabold tracking-[-0.01em] transition-colors",
        selected
          ? "border-red-600 bg-red-50 text-red-700"
          : "border-transparent text-slate-600 hover:text-slate-900",
      )}
    >
      <Icon
        name={icon}
        className={cn(
          "h-4 w-4",
          selected ? "text-red-600" : "text-slate-400",
        )}
      />
      {label}
      <span
        className={cn(
          "rounded-full bg-white px-[11px] py-[3px] text-[13.5px] font-extrabold tracking-[-0.01em] ring-1 ring-inset transition-colors",
          selected ? "text-red-700 ring-red-200" : "text-slate-700 ring-slate-300",
        )}
      >
        {price}
      </span>
    </button>
  );
}

/* ── Premium Listing panel ────────────────────────────────────────── */

function PremiumPanel({
  event,
  onCrossSell,
}: {
  event: AddOnEventContext | null;
  onCrossSell: () => void;
}) {
  return (
    <section
      id="addon-panel-premium"
      role="tabpanel"
      aria-labelledby="addon-tab-premium"
      className="tg-step-in mt-6"
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0 p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-amber-50 text-amber-500">
              <Icon name="star" className="h-4 w-4" />
            </span>
            <h2 className="font-[var(--font-heading)] text-[22px] font-extrabold tracking-tight text-slate-900">
              Premium Listing
            </h2>
            <StatusPill tone="premium">Premium</StatusPill>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-red-700">
              <Icon name="shield" className="h-3 w-3" />
              Verified listing
            </span>
          </div>
          <p className="mt-2.5 max-w-[58ch] text-[13.5px] leading-relaxed text-slate-600">
            Stand out and inspire trust with a premium event presence.
          </p>

          <DevicePreview />
          <p className="mt-3 text-center text-[11.5px] font-semibold text-slate-500">
            How your promoted listing appears across search, event pages, and
            the mobile experience.
          </p>

          <div className="my-6 h-px bg-slate-100" />

          <Eyebrow>What&apos;s included</Eyebrow>
          <ul className="mt-4 grid gap-x-7 gap-y-4 sm:grid-cols-2">
            <CheckItem title="Priority listing placement">
              Your event ranks first in search results and category pages.
            </CheckItem>
            <CheckItem title="Verified & trusted coach/manager reviews">
              Reviews carry the verified badge attendees trust.
            </CheckItem>
            <CheckItem title="Enhanced profile">
              More images, an extended description, and event videos.
            </CheckItem>
            <CheckItem title={`Up to ${PREMIUM_IMAGE_LIMIT} images & event video`}>
              Show the full story of your event weekend.
            </CheckItem>
            <CheckItem title="Hyperlinks to team lists">
              Send coaches straight to your registered team lists.
            </CheckItem>
            <CheckItem title="Key dates & deadlines timeline">
              Publish the milestone dates families track, right on your event
              page.
            </CheckItem>
            <CheckItem title="Weekly Featured Events email listing">
              Your event lands in subscriber inboxes every week.
            </CheckItem>
          </ul>
        </Card>

        <aside className="flex flex-col lg:sticky lg:top-24">
          <Card className="relative overflow-hidden p-6">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-red-600 via-red-400 to-amber-400"
            />
            <Eyebrow>Premium Listing · one-time</Eyebrow>
            <PriceLine amount={PREMIUM_PRICE} />
            <IncludesAllStrip />
            <ComingSoonCta flavor="premium" />
            <StripeSignal />
            {event && <AppliesTo event={event} />}
            <div className="my-5 h-px bg-slate-100" />
            <button
              type="button"
              onClick={onCrossSell}
              className={cn(
                textLinkClass,
                "inline-flex items-center gap-1 text-left text-[12.5px]",
              )}
            >
              Need broader reach? See General Ads — {ADS_PRICE}
              <Icon name="chevron-right" className="h-3.5 w-3.5" />
            </button>
          </Card>

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-white text-amber-500 ring-1 ring-amber-200">
              <Icon name="spark" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-slate-900">
                Goes live instantly
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">
                Once add-ons launch, premium features will unlock the moment
                you activate — no review wait.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

/* ── General Ads panel ────────────────────────────────────────────── */

function AdsPanel({
  event,
  onCrossSell,
}: {
  event: AddOnEventContext | null;
  onCrossSell: () => void;
}) {
  return (
    <section
      id="addon-panel-ads"
      role="tabpanel"
      aria-labelledby="addon-tab-ads"
      className="tg-step-in mt-6"
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0 p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-violet-50 text-violet-600">
              <Icon name="megaphone" className="h-4 w-4" />
            </span>
            <h2 className="font-[var(--font-heading)] text-[22px] font-extrabold tracking-tight text-slate-900">
              General Ads
            </h2>
            <StatusPill tone="spotlight">Spotlight</StatusPill>
          </div>
          <p className="mt-2.5 max-w-[58ch] text-[13.5px] leading-relaxed text-slate-600">
            Expand your reach with high-visibility ads across the platform.
          </p>
          <p className="mt-1 text-[12px] font-semibold text-slate-500">
            Shown to attendees as the &quot;Spotlight&quot; section.
          </p>

          <AdPreview />
          <p className="mt-3 text-center text-[11.5px] font-semibold text-slate-500">
            Your event card in the Spotlight strip — seen by every visitor
            browsing events.
          </p>

          <div className="my-6 h-px bg-slate-100" />

          <Eyebrow>What&apos;s included</Eyebrow>
          <ul className="mt-4 grid gap-x-7 gap-y-4 sm:grid-cols-2">
            <CheckItem title="Event ads on user-facing pages">
              Placed in high-visibility areas where attendees actually look.
            </CheckItem>
            <CheckItem title="Broad, non-targeted reach">
              Your ad reaches all visitors — coaches, parents, and managers.
            </CheckItem>
            <CheckItem title="Detailed statistics">
              Every impression is counted and reported to you.
            </CheckItem>
            <CheckItem title="Consistent visibility">
              Shown across event and listing pages, not a single slot.
            </CheckItem>
          </ul>
        </Card>

        <aside className="flex flex-col lg:sticky lg:top-24">
          <Card className="relative overflow-hidden p-6">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-violet-600 via-violet-400 to-sky-400"
            />
            <Eyebrow>General Ads · one-time</Eyebrow>
            <PriceLine amount={ADS_PRICE} />
            <IncludesAllStrip />
            <ComingSoonCta flavor="ads" />
            <StripeSignal />
            {event && <AppliesTo event={event} />}
            <div className="my-5 h-px bg-slate-100" />
            <button
              type="button"
              onClick={onCrossSell}
              className={cn(
                textLinkClass,
                "inline-flex items-center gap-1 text-left text-[12.5px]",
              )}
            >
              Want the full presence? See Premium Listing — {PREMIUM_PRICE}
              <Icon name="chevron-right" className="h-3.5 w-3.5" />
            </button>
          </Card>

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-white text-violet-600 ring-1 ring-violet-200">
              <Icon name="chart" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-slate-900">
                Impression reporting included
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">
                Track views from your dashboard from the first day your ad
                runs.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

/* ── shared rail pieces ───────────────────────────────────────────── */

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-[var(--font-heading)] text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
      {children}
    </p>
  );
}

function PriceLine({ amount }: { amount: string }) {
  return (
    <>
      <div className="mt-3 flex items-end gap-2">
        <span className="font-[var(--font-heading)] text-[44px] font-extrabold leading-none tracking-tight text-slate-900">
          {amount}
        </span>
        <span className="pb-1 text-[13px] font-bold text-slate-500">USD</span>
      </div>
      <p className="mt-1.5 text-[12.5px] font-semibold text-slate-600">
        per event listing · one-time payment
      </p>
    </>
  );
}

function IncludesAllStrip() {
  return (
    <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
      <span className="grid h-5 w-5 flex-none place-items-center rounded-full border border-emerald-200 bg-white text-emerald-600">
        <Icon name="check" className="h-3 w-3" />
      </span>
      <p className="text-[12.5px] font-bold text-emerald-900">
        Includes all features listed
      </p>
    </div>
  );
}

/**
 * The Activate slot, pre-launch: a deliberately disabled stub in the
 * add-on's accent register (solid brand red for Premium, the ads rail's
 * violet→sky gradient for General Ads). No checkout is wired.
 */
function ComingSoonCta({ flavor }: { flavor: AddOnKey }) {
  return (
    <>
      <button
        type="button"
        disabled
        className={cn(
          "mt-4 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl px-[18px] py-3 text-sm font-extrabold tracking-[-0.01em] text-white opacity-60",
          flavor === "premium"
            ? "bg-red-600"
            : "bg-gradient-to-r from-violet-600 via-violet-400 to-sky-400",
        )}
      >
        <Icon name="lock" className="h-4 w-4" />
        Coming soon
      </button>
      <p className="mt-2.5 text-center text-[11.5px] font-semibold text-slate-500">
        Activation opens when payments launch.
      </p>
    </>
  );
}

/**
 * The mockup's per-rail Stripe trust signal, reworded for pre-launch:
 * "Payments powered by Stripe", not "Secure checkout · powered by
 * Stripe" — there is no checkout to call secure yet. The wordmark is a
 * static asset in /public, not a DB URL, so it renders as a plain
 * <img> rather than through SafeImg/safeImageSrc.
 */
function StripeSignal() {
  return (
    <div className="mt-3.5 flex flex-col items-center gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/stripe-logo.png" alt="Stripe" className="h-6 w-auto" />
      <p className="flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-slate-600">
        <Icon name="lock" className="h-3 w-3" />
        Payments powered by Stripe
      </p>
    </div>
  );
}

function AppliesTo({ event }: { event: AddOnEventContext }) {
  return (
    <>
      <div className="my-5 h-px bg-slate-100" />
      <Eyebrow>Applies to</Eyebrow>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-xl ring-1 ring-slate-200">
          <SafeImg
            src={event.logoUrl ?? undefined}
            alt=""
            className="h-full w-full object-cover"
            fallback={
              <span className="grid h-full w-full place-items-center bg-gradient-to-br from-red-500 to-red-800 font-[var(--font-heading)] text-[13px] font-extrabold text-white">
                {initialsOf(event.title)}
              </span>
            }
          />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-slate-900">
            {event.title}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-600">
            <StatusPill tone={eventStatusTone(event.status)} compact>
              {event.status}
            </StatusPill>
            {event.isPremium && (
              <StatusPill tone="premium" compact>
                Premium
              </StatusPill>
            )}
            {event.isGeneralAd && (
              <StatusPill tone="spotlight" compact>
                Spotlight
              </StatusPill>
            )}
            {event.dateRange}
          </p>
        </div>
      </div>
    </>
  );
}

function CheckItem({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-px grid h-[22px] w-[22px] flex-none place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
        <Icon name="check" className="h-3 w-3" />
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-bold text-slate-900">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">
          {children}
        </p>
      </div>
    </li>
  );
}

function initialsOf(text: string): string {
  return (
    text
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "E"
  );
}

/* ── device / ad previews — the summary-band ink treatment ────────── */

function FloatChip({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "absolute z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-slate-900 shadow-[0_10px_24px_-8px_rgba(2,6,23,.5)] backdrop-blur-[2px]",
        className,
      )}
    >
      {children}
    </span>
  );
}

function PreviewShell({
  glow,
  children,
}: {
  /** The two radial washes behind the artwork, per add-on register. */
  glow: string;
  children: ReactNode;
}) {
  return (
    <div
      className="relative mt-5 overflow-hidden rounded-2xl p-5 shadow-[0_20px_44px_-20px_rgba(15,23,42,.55)] md:p-7"
      style={{
        background:
          "linear-gradient(115deg,#0b1120 0%,#1e293b 74%,#28364b 100%)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: glow }}
      />
      {children}
    </div>
  );
}

/** Stylized laptop + phone showing the "Promoted Events" placement. */
function DevicePreview() {
  return (
    <PreviewShell
      glow="radial-gradient(520px 220px at 14% -20%,rgba(220,38,38,.32),transparent 65%), radial-gradient(420px 200px at 88% 130%,rgba(245,158,11,.18),transparent 70%)"
    >
      <FloatChip className="right-4 top-4 md:right-6 md:top-6">
        <Icon name="star" className="h-3.5 w-3.5 text-amber-500" />
        Top of search results
      </FloatChip>
      <FloatChip className="bottom-4 left-4 md:bottom-6 md:left-6">
        <Icon name="mail" className="h-3.5 w-3.5 text-red-600" />
        Weekly Featured Events email
      </FloatChip>
      <svg
        viewBox="0 0 720 420"
        className="relative block h-auto w-full"
        role="img"
        aria-label="Preview of a promoted event listing on a laptop and a phone"
      >
        <defs>
          <linearGradient id="ao-pvImg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#22c55e" />
            <stop offset="1" stopColor="#15803d" />
          </linearGradient>
          <linearGradient id="ao-pvBase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e2e8f0" />
            <stop offset="1" stopColor="#94a3b8" />
          </linearGradient>
          <clipPath id="ao-pvScr">
            <rect x="84" y="42" width="404" height="246" rx="6" />
          </clipPath>
          <clipPath id="ao-pvPh">
            <rect x="531" y="107" width="112" height="242" rx="14" />
          </clipPath>
        </defs>

        {/* ground shadows */}
        <ellipse cx="300" cy="338" rx="290" ry="17" fill="#020617" opacity=".35" />
        <ellipse cx="587" cy="366" rx="82" ry="11" fill="#020617" opacity=".35" />

        {/* laptop */}
        <rect x="70" y="28" width="432" height="274" rx="14" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
        <circle cx="286" cy="35.5" r="2" fill="#475569" />
        <g clipPath="url(#ao-pvScr)">
          <rect x="84" y="42" width="404" height="246" fill="#f8fafc" />
          <rect x="84" y="42" width="404" height="28" fill="#0f172a" />
          <polygon fill="#dc2626" points="98,49 100.3,53.6 105.4,54.3 101.7,57.9 102.6,63 98,60.6 93.4,63 94.3,57.9 90.6,54.3 95.7,53.6" />
          <text x="112" y="60" fontSize="9" fontWeight="800" fill="#fff" letterSpacing=".8">TOURNAMENT GURU</text>
          <rect x="360" y="53" width="30" height="6" rx="3" fill="#fff" opacity=".28" />
          <rect x="404" y="50.5" width="36" height="11" rx="5.5" fill="#dc2626" />
          <rect x="84" y="70" width="404" height="2" fill="#dc2626" opacity=".9" />

          <text x="98" y="94" fontSize="9.5" fontWeight="800" fill="#64748b" letterSpacing="2">PROMOTED EVENTS</text>

          {/* the premium card: red halo + border, full detail */}
          <rect x="94" y="100" width="190" height="162" rx="12" fill="#dc2626" opacity=".1" />
          <rect x="100" y="106" width="178" height="150" rx="9" fill="#fff" stroke="#fca5a5" strokeWidth="1.5" />
          <rect x="108" y="114" width="162" height="62" rx="5" fill="url(#ao-pvImg)" />
          <g stroke="#fff" strokeWidth="1.4" fill="none" opacity=".8">
            <line x1="189" y1="114" x2="189" y2="176" />
            <circle cx="189" cy="145" r="13" />
          </g>
          <rect x="114" y="120" width="52" height="14" rx="7" fill="#dc2626" />
          <text x="140" y="130" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#fff" letterSpacing=".8">PREMIUM</text>
          <text x="108" y="196" fontSize="11.5" fontWeight="800" fill="#0f172a">Spring Kickoff Cup</text>
          <text x="108" y="210" fontSize="8.5" fontWeight="600" fill="#64748b">Austin, TX · Jul 30 – Aug 1</text>
          <text x="107" y="228" fontSize="10" fill="#f59e0b" letterSpacing="1">★★★★★</text>
          <text x="164" y="227" fontSize="8.5" fontWeight="700" fill="#334155">4.9 (34)</text>
          <rect x="108" y="236" width="74" height="14" rx="7" fill="#0f172a" />
          <text x="145" y="245.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#fff">View event</text>

          {/* muted, non-premium neighbors */}
          <rect x="298" y="118" width="150" height="126" rx="9" fill="#fff" stroke="#e2e8f0" />
          <rect x="306" y="126" width="134" height="50" rx="5" fill="#e2e8f0" />
          <rect x="306" y="186" width="96" height="8" rx="4" fill="#cbd5e1" />
          <rect x="306" y="200" width="70" height="7" rx="3.5" fill="#e2e8f0" />
          <rect x="306" y="222" width="56" height="10" rx="5" fill="#e2e8f0" />
          <rect x="462" y="118" width="120" height="126" rx="9" fill="#fff" stroke="#e2e8f0" />
          <rect x="470" y="126" width="104" height="50" rx="5" fill="#e2e8f0" />
          <rect x="470" y="186" width="70" height="8" rx="4" fill="#cbd5e1" />
        </g>
        {/* laptop base */}
        <path d="M36 302 L536 302 L516 326 Q514 330 507 330 L65 330 Q58 330 56 326 Z" fill="url(#ao-pvBase)" />
        <rect x="252" y="302" width="68" height="7" rx="3.5" fill="#64748b" opacity=".55" />

        {/* phone */}
        <rect x="524" y="98" width="126" height="260" rx="20" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
        <g clipPath="url(#ao-pvPh)">
          <rect x="531" y="107" width="112" height="242" fill="#f8fafc" />
          <rect x="531" y="107" width="112" height="26" fill="#0f172a" />
          <polygon fill="#dc2626" points="541,114 542.9,117.8 547.1,118.4 544.1,121.4 544.8,125.6 541,123.6 537.2,125.6 537.9,121.4 534.9,118.4 539.1,117.8" />
          <text x="551" y="124" fontSize="7.5" fontWeight="800" fill="#fff" letterSpacing="1">TG</text>
          <text x="539" y="150" fontSize="8" fontWeight="800" fill="#64748b" letterSpacing="1.6">PROMOTED</text>
          <rect x="535" y="156" width="104" height="128" rx="10" fill="#dc2626" opacity=".1" />
          <rect x="539" y="160" width="96" height="120" rx="8" fill="#fff" stroke="#fca5a5" strokeWidth="1.2" />
          <rect x="545" y="166" width="84" height="44" rx="4" fill="url(#ao-pvImg)" />
          <rect x="549" y="170" width="40" height="11" rx="5.5" fill="#dc2626" />
          <text x="569" y="177.5" textAnchor="middle" fontSize="6" fontWeight="800" fill="#fff" letterSpacing=".6">PREMIUM</text>
          <text x="545" y="224" fontSize="8.5" fontWeight="800" fill="#0f172a">Spring Kickoff Cup</text>
          <text x="545" y="235" fontSize="6.5" fontWeight="600" fill="#64748b">Austin, TX · Jul 30</text>
          <text x="544" y="248" fontSize="8" fill="#f59e0b" letterSpacing=".8">★★★★★</text>
          <text x="590" y="247" fontSize="6.5" fontWeight="700" fill="#334155">4.9</text>
          <rect x="545" y="256" width="56" height="12" rx="6" fill="#0f172a" />
          <text x="573" y="264.5" textAnchor="middle" fontSize="6" fontWeight="700" fill="#fff">View event</text>
          <rect x="539" y="290" width="96" height="59" rx="8" fill="#fff" stroke="#e2e8f0" />
          <rect x="545" y="296" width="84" height="28" rx="4" fill="#e2e8f0" />
          <rect x="545" y="330" width="58" height="6" rx="3" fill="#cbd5e1" />
        </g>
      </svg>
    </PreviewShell>
  );
}

/** Browser-window mock of the Spotlight strip on the search page. */
function AdPreview() {
  return (
    <PreviewShell
      glow="radial-gradient(520px 220px at 14% -20%,rgba(124,58,237,.36),transparent 65%), radial-gradient(420px 200px at 88% 130%,rgba(56,189,248,.20),transparent 70%)"
    >
      <FloatChip className="bottom-4 left-4 md:bottom-6 md:left-6">
        <Icon name="chart" className="h-3.5 w-3.5 text-violet-600" />
        Stats for every impression
      </FloatChip>
      <svg
        viewBox="0 0 720 400"
        className="relative block h-auto w-full"
        role="img"
        aria-label="Preview of an event ad in the Spotlight strip on the search page"
      >
        <defs>
          <linearGradient id="ao-adImg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4ade80" />
            <stop offset="1" stopColor="#16a34a" />
          </linearGradient>
          <clipPath id="ao-adW">
            <rect x="58" y="22" width="604" height="348" rx="14" />
          </clipPath>
        </defs>

        <ellipse cx="360" cy="382" rx="310" ry="13" fill="#020617" opacity=".35" />

        <g clipPath="url(#ao-adW)">
          <rect x="58" y="22" width="604" height="348" fill="#fff" />
          {/* browser chrome */}
          <rect x="58" y="22" width="604" height="34" fill="#f1f5f9" />
          <circle cx="82" cy="39" r="4.5" fill="#f87171" />
          <circle cx="100" cy="39" r="4.5" fill="#fbbf24" />
          <circle cx="118" cy="39" r="4.5" fill="#34d399" />
          <rect x="142" y="30" width="252" height="18" rx="9" fill="#fff" stroke="#e2e8f0" />
          <text x="154" y="42" fontSize="8.5" fontWeight="600" fill="#475569">tournamentgurus.com/events</text>

          {/* search page header */}
          <text x="90" y="86" fontSize="14" fontWeight="800" fill="#0f172a">Find your next tournament</text>
          <rect x="90" y="96" width="280" height="24" rx="12" fill="#f8fafc" stroke="#e2e8f0" />
          <text x="104" y="111" fontSize="8.5" fontWeight="600" fill="#94a3b8">Soccer · Texas · Spring 2026</text>
          <rect x="330" y="99" width="36" height="18" rx="9" fill="#dc2626" />
          <text x="348" y="110.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">Search</text>

          {/* spotlight strip */}
          <text x="90" y="150" fontSize="9.5" fontWeight="800" fill="#7c3aed" letterSpacing="2">SPOTLIGHT</text>
          <text x="164" y="150" fontSize="8" fontWeight="600" fill="#94a3b8">· sponsored placements</text>

          <rect x="90" y="162" width="152" height="138" rx="10" fill="#fff" stroke="#e2e8f0" />
          <rect x="98" y="170" width="136" height="52" rx="5" fill="#e2e8f0" />
          <rect x="98" y="232" width="96" height="8" rx="4" fill="#cbd5e1" />
          <rect x="98" y="246" width="70" height="7" rx="3.5" fill="#e2e8f0" />
          <rect x="98" y="270" width="56" height="12" rx="6" fill="#e2e8f0" />

          {/* YOUR ad: violet halo + border + AD chip */}
          <rect x="252" y="156" width="186" height="150" rx="12" fill="#7c3aed" opacity=".1" />
          <rect x="258" y="162" width="174" height="138" rx="10" fill="#fff" stroke="#a78bfa" strokeWidth="1.5" />
          <rect x="266" y="170" width="158" height="56" rx="5" fill="url(#ao-adImg)" />
          <g stroke="#fff" strokeWidth="1.3" fill="none" opacity=".8">
            <line x1="345" y1="170" x2="345" y2="226" />
            <circle cx="345" cy="198" r="12" />
          </g>
          <rect x="272" y="176" width="28" height="13" rx="6.5" fill="#7c3aed" />
          <text x="286" y="185.5" textAnchor="middle" fontSize="7" fontWeight="800" fill="#fff" letterSpacing=".8">AD</text>
          <circle cx="416" cy="184" r="9" fill="#ede9fe" stroke="#ddd6fe" />
          <g stroke="#7c3aed" fill="none" strokeWidth="1.2">
            <path d="M409 184c2.4-3.4 11.6-3.4 14 0c-2.4 3.4-11.6 3.4-14 0z" />
          </g>
          <circle cx="416" cy="184" r="1.6" fill="#7c3aed" />
          <text x="266" y="244" fontSize="11" fontWeight="800" fill="#0f172a">Spring Kickoff Cup</text>
          <text x="266" y="257" fontSize="8" fontWeight="600" fill="#64748b">Austin, TX · U9–U11 · from $495</text>
          <rect x="266" y="268" width="70" height="15" rx="7.5" fill="#0f172a" />
          <text x="301" y="278" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#fff">View event</text>
          <text x="346" y="279" fontSize="9" fill="#f59e0b" letterSpacing=".8">★★★★★</text>
          <text x="396" y="278.5" fontSize="7.5" fontWeight="700" fill="#334155">4.9</text>

          <rect x="448" y="162" width="152" height="138" rx="10" fill="#fff" stroke="#e2e8f0" />
          <rect x="456" y="170" width="136" height="52" rx="5" fill="#e2e8f0" />
          <rect x="456" y="232" width="96" height="8" rx="4" fill="#cbd5e1" />
          <rect x="456" y="246" width="70" height="7" rx="3.5" fill="#e2e8f0" />
          <rect x="456" y="270" width="56" height="12" rx="6" fill="#e2e8f0" />
          <rect x="616" y="162" width="120" height="138" rx="10" fill="#fff" stroke="#e2e8f0" />
          <rect x="624" y="170" width="104" height="52" rx="5" fill="#e2e8f0" />

          {/* listing rows below the strip */}
          <rect x="90" y="318" width="510" height="20" rx="6" fill="#f8fafc" stroke="#f1f5f9" />
          <circle cx="104" cy="328" r="6" fill="#e2e8f0" />
          <rect x="118" y="324" width="140" height="8" rx="4" fill="#e2e8f0" />
          <rect x="430" y="324" width="60" height="8" rx="4" fill="#f1f5f9" />
          <rect x="90" y="344" width="510" height="20" rx="6" fill="#f8fafc" stroke="#f1f5f9" />
          <circle cx="104" cy="354" r="6" fill="#e2e8f0" />
          <rect x="118" y="350" width="120" height="8" rx="4" fill="#e2e8f0" />
          <rect x="430" y="350" width="60" height="8" rx="4" fill="#f1f5f9" />
        </g>
        <rect x="58" y="22" width="604" height="348" rx="14" fill="none" stroke="#cbd5e1" />
      </svg>
    </PreviewShell>
  );
}
