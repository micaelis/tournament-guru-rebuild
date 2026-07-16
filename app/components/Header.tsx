"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TGLogo } from "./TGLogo";
import { HeaderAuth } from "./HeaderAuth";
import { HeaderPill } from "./HeaderPill";
import { EventSearchOverlay } from "./EventSearchOverlay";

/* ── Navigation model ──
   A top item is either a simple link (href, no children) or a hover/focus
   dropdown (children). A dropdown may also carry its own href — the label then
   links to a hub page while still revealing its children.
   A child with action: "review-overlay" opens the review picker instead of
   navigating. */
type NavChild = { label: string; href: string; action?: "review-overlay" };
type NavItem = { label: string; href?: string; children?: NavChild[] };

const NAV: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "For Attendees",
    href: "/attendees",
    children: [
      { label: "Search Events", href: "/events" },
      { label: "Write a Review", href: "/reviews/new", action: "review-overlay" },
    ],
  },
  {
    label: "For Event Directors",
    href: "/host",
    children: [
      // Straight to the ED-claim auth screen (ED type pre-selected), not
      // the marketing hub — see docs/AUTH-SCREENS.md §4.
      { label: "Claim / List Your Event Free", href: "/signup?type=event_director" },
      { label: "Upgrade Your Event Listing", href: "/host" },
    ],
  },
  { label: "Featured Events", href: "/#featured-events" },
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
];

/* Is `item` the section the current path lives in? */
function useIsActive() {
  const pathname = usePathname();
  return (item: NavItem) => {
    const hrefs = [
      ...(item.href ? [item.href] : []),
      ...(item.children?.map((c) => c.href) ?? []),
    ];
    return hrefs.some((h) =>
      h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(h + "/"),
    );
  };
}

export function Header({
  initialEmail = null,
  authMode = false,
}: {
  initialEmail?: string | null;
  /** Auth-flow variant: the brand logo moves into the page content, so the
   *  header drops it, left-aligns the nav (active link underlined), and swaps
   *  the auth CTA for a "Browse events" pill so visitors can jump back to the
   *  public site. */
  authMode?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [reviewOverlay, setReviewOverlay] = useState(false);
  // Tracks whether the #featured-events section on the landing page is
  // currently in the viewport — when true, the "Featured Events" nav link
  // lights up accent-red even though the URL hasn't changed. Purely a
  // landing-page thing (the section only exists there).
  const [featuredInView, setFeaturedInView] = useState(false);
  const isActive = useIsActive();
  const pathname = usePathname();

  // React 19's "reset state when a prop changes" idiom: track the
  // previous pathname in state and issue the resets during render.
  // React handles setState during render specially (no cascading
  // re-render), which is why the two useEffect(setState, [pathname])
  // blocks below were replaced with this — same behaviour, satisfies
  // react-hooks/set-state-in-effect.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
    setOpenMenu(null);
    if (pathname !== "/") setFeaturedInView(false);
  }

  const onChildAction = (action: string | undefined) => {
    if (action === "review-overlay") {
      setOpenMenu(null);
      setMenuOpen(false);
      setReviewOverlay(true);
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // Preserve whatever the caller (or a lower-stack modal) set on
    // overflow, so opening/closing the mobile menu doesn't reset the
    // page's scroll-lock state as a side effect.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  // Landing-only IntersectionObserver — turns the "Featured Events" nav
  // link accent when the section scrolls into view. rootMargin trims the
  // sticky header off the top and the bottom third off the bottom so the
  // link goes active roughly when the section is centred, not the moment
  // its first pixel appears.
  useEffect(() => {
    // The setFeaturedInView(false) reset when pathname !== "/" happens
    // in the setState-during-render block above; this effect only sets
    // up / tears down the observer.
    if (pathname !== "/") return;
    const el = document.getElementById("featured-events");
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setFeaturedInView(entry.isIntersecting);
      },
      { rootMargin: "-80px 0px -35% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pathname]);

  const raised = scrolled || menuOpen;

  return (
    <>
      <header
        className="sticky top-0 z-50"
        style={{
          background: raised ? "rgba(246, 249, 252, 0.82)" : "#fff",
          backdropFilter: "saturate(140%) blur(9px)",
          WebkitBackdropFilter: "saturate(140%) blur(9px)",
          borderBottom: `1px solid ${raised ? "rgba(148, 163, 184, 0.28)" : "var(--color-border)"}`,
          boxShadow: raised ? "0 6px 22px -12px rgba(15,23,42,.16)" : "none",
          transition: "background .2s ease, border-color .2s ease, box-shadow .2s ease",
        }}
      >
        <div
          className={`relative flex items-center justify-between gap-6 ${
            authMode ? "w-full" : "mx-auto max-w-[1280px]"
          }`}
          style={{ padding: authMode ? "0 28px" : "12px 24px", height: authMode ? 65 : undefined }}
        >
          {!authMode && <TGLogo href="/" size="md" />}

          <nav
            className={`hidden w-max items-center gap-2 whitespace-nowrap lg:flex ${
              authMode ? "" : "absolute left-1/2 -translate-x-1/2"
            }`}
          >
            {NAV.map((item) => {
              // Featured Events lights up whenever that section is in view
              // on the landing page, in addition to the normal URL match.
              const activeExtra =
                item.label === "Featured Events" && featuredInView;
              // In the auth flow no nav route is "current", so highlight Home
              // as the anchor back to the public site.
              const active =
                isActive(item) ||
                activeExtra ||
                (authMode && item.label === "Home");
              return item.children ? (
                <DesktopDropdown
                  key={item.label}
                  item={item}
                  active={active}
                  authMode={authMode}
                  open={openMenu === item.label}
                  onOpen={() => setOpenMenu(item.label)}
                  onClose={() => setOpenMenu((v) => (v === item.label ? null : v))}
                  onToggle={() =>
                    setOpenMenu((v) => (v === item.label ? null : item.label))
                  }
                  onChildAction={onChildAction}
                />
              ) : (
                <TopLink
                  key={item.label}
                  href={item.href! as Route}
                  active={active}
                  authMode={authMode}
                >
                  {item.label}
                </TopLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            {authMode ? (
              <HeaderPill
                href="/events"
                size="sm"
                variant="outline"
                icon={
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                }
              >
                Browse events
              </HeaderPill>
            ) : (
              <HeaderAuth initialEmail={initialEmail} />
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border bg-white transition-colors hover:bg-[var(--color-surface-alt)] lg:hidden"
              style={{
                width: 40,
                height: 40,
                borderColor: "var(--color-border)",
                color: "var(--color-dark)",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 cursor-default lg:hidden"
              style={{ background: "rgba(15,23,42,.28)", border: 0 }}
              tabIndex={-1}
            />
            <nav
              id="mobile-menu"
              className="relative z-50 max-h-[calc(100dvh-64px)] overflow-y-auto lg:hidden"
              style={{
                background: "#fff",
                borderTop: "1px solid var(--color-border)",
                boxShadow: "0 12px 28px -12px rgba(15,23,42,.22)",
                padding: "8px 16px 16px",
              }}
            >
              {NAV.map((item) =>
                item.children ? (
                  <MobileSection
                    key={item.label}
                    item={item}
                    onNavigate={() => setMenuOpen(false)}
                    onChildAction={onChildAction}
                  />
                ) : (
                  <Link
                    key={item.label}
                    href={item.href! as Route}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl transition-colors hover:bg-[var(--color-surface-alt)]"
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: isActive(item) ? "var(--color-accent)" : "var(--color-dark)",
                      textDecoration: "none",
                      padding: "12px",
                    }}
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
          </>
        )}
      </header>

      <EventSearchOverlay
        open={reviewOverlay}
        onClose={() => setReviewOverlay(false)}
        mode="review"
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════
   Desktop — simple top link
   ═══════════════════════════════════════════════════ */

function TopLink({
  href,
  active,
  authMode = false,
  children,
}: {
  href: string;
  active: boolean;
  authMode?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as Route}
      className={`tg-nav-link rounded-lg ${
        authMode && active ? "tg-nav-link--active" : ""
      }`}
      style={{
        fontSize: 14.5,
        fontWeight: authMode ? 600 : 500,
        textDecoration: "none",
        padding: authMode ? "9px 15px" : "8px 11px",
        color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
      }}
    >
      {children}
    </Link>
  );
}

/* ═══════════════════════════════════════════════════
   Desktop — hover / focus dropdown
   ═══════════════════════════════════════════════════ */

function DesktopDropdown({
  item,
  active,
  authMode = false,
  open,
  onOpen,
  onClose,
  onToggle,
  onChildAction,
}: {
  item: NavItem;
  active: boolean;
  authMode?: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
  onChildAction: (action: string | undefined) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viaPointer = useRef(false);
  const menuId = `menu-${item.label.replace(/\s+/g, "-").toLowerCase()}`;

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openNow = () => {
    cancelClose();
    onOpen();
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = setTimeout(onClose, 220);
  };
  useEffect(() => cancelClose, []);

  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) {
      cancelClose();
      onClose();
    }
  };

  const onTriggerFocus = () => {
    if (viaPointer.current) {
      viaPointer.current = false;
      return;
    }
    openNow();
  };
  const onTriggerPointerDown = () => {
    viaPointer.current = true;
  };

  const triggerColor = active || open ? "var(--color-accent)" : "var(--color-text-secondary)";

  const triggerInner = (
    <>
      {item.label}
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{
          transition: "transform .2s ease",
          transform: open ? "rotate(180deg)" : "none",
          opacity: 0.7,
        }}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </>
  );

  const triggerCls = `tg-nav-link ${
    authMode && active ? "tg-nav-link--active" : ""
  }`;

  const triggerStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 14.5,
    fontWeight: authMode ? 600 : 500,
    textDecoration: "none",
    padding: authMode ? "9px 15px" : "8px 11px",
    borderRadius: 8,
    color: triggerColor,
    background: "transparent",
    border: 0,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openNow();
      const first = wrapRef.current?.querySelector<HTMLElement>("[data-menuitem]");
      first?.focus();
    }
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onBlur={onBlur}
    >
      {item.href ? (
        <Link
          href={item.href as Route}
          className={triggerCls}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onFocus={onTriggerFocus}
          onPointerDown={onTriggerPointerDown}
          onKeyDown={onTriggerKeyDown}
          style={triggerStyle}
        >
          {triggerInner}
        </Link>
      ) : (
        <button
          type="button"
          className={triggerCls}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={onToggle}
          onFocus={onTriggerFocus}
          onPointerDown={onTriggerPointerDown}
          onKeyDown={onTriggerKeyDown}
          style={triggerStyle}
        >
          {triggerInner}
        </button>
      )}

      <div
        id={menuId}
        role="menu"
        aria-label={item.label}
        className="absolute left-0"
        onMouseEnter={cancelClose}
        style={{
          top: "100%",
          paddingTop: 8,
          minWidth: 232,
          zIndex: 60,
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          transform: open ? "translateY(0)" : "translateY(-6px)",
          pointerEvents: open ? "auto" : "none",
          transition: "opacity .18s ease, transform .18s ease, visibility .18s",
        }}
      >
        <div
          className="relative"
          style={{
            background: "#fff",
            border: "1px solid var(--color-border)",
            borderRadius: 14,
            boxShadow: "0 18px 40px -18px rgba(15,23,42,.28), 0 2px 6px rgba(15,23,42,.05)",
            padding: 7,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -5,
              left: 22,
              width: 10,
              height: 10,
              background: "#fff",
              borderLeft: "1px solid var(--color-border)",
              borderTop: "1px solid var(--color-border)",
              transform: "rotate(45deg)",
            }}
          />
          {item.children!.map((child) =>
            child.action ? (
              <button
                key={child.label}
                type="button"
                role="menuitem"
                data-menuitem
                tabIndex={open ? 0 : -1}
                onClick={() => onChildAction(child.action)}
                className="block w-full cursor-pointer rounded-lg bg-transparent text-left transition-colors hover:bg-[var(--color-surface-alt)]"
                style={{
                  position: "relative",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "var(--color-dark)",
                  padding: "10px 12px",
                  border: 0,
                  fontFamily: "inherit",
                }}
              >
                {child.label}
              </button>
            ) : (
              <Link
                key={child.label}
                href={child.href as Route}
                role="menuitem"
                data-menuitem
                tabIndex={open ? 0 : -1}
                className="block rounded-lg transition-colors hover:bg-[var(--color-surface-alt)]"
                style={{
                  position: "relative",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "var(--color-dark)",
                  textDecoration: "none",
                  padding: "10px 12px",
                }}
              >
                {child.label}
              </Link>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Mobile — collapsible accordion section
   ═══════════════════════════════════════════════════ */

function MobileSection({
  item,
  onNavigate,
  onChildAction,
}: {
  item: NavItem;
  onNavigate: () => void;
  onChildAction: (action: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `m-${item.label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between rounded-xl transition-colors hover:bg-[var(--color-surface-alt)]"
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--color-dark)",
          background: "transparent",
          border: 0,
          padding: "12px",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {item.label}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ transition: "transform .2s ease", transform: open ? "rotate(180deg)" : "none", opacity: 0.6 }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div id={panelId} style={{ paddingLeft: 8, paddingBottom: 4 }}>
          {item.href && (
            <Link
              href={item.href as Route}
              onClick={onNavigate}
              className="block rounded-xl transition-colors hover:bg-[var(--color-surface-alt)]"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-accent)",
                textDecoration: "none",
                padding: "10px 12px",
              }}
            >
              Overview
            </Link>
          )}
          {item.children!.map((child) =>
            child.action ? (
              <button
                key={child.label}
                type="button"
                onClick={() => onChildAction(child.action)}
                className="block w-full cursor-pointer rounded-xl bg-transparent text-left transition-colors hover:bg-[var(--color-surface-alt)]"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  padding: "10px 12px",
                  border: 0,
                  fontFamily: "inherit",
                }}
              >
                {child.label}
              </button>
            ) : (
              <Link
                key={child.label}
                href={child.href as Route}
                onClick={onNavigate}
                className="block rounded-xl transition-colors hover:bg-[var(--color-surface-alt)]"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  textDecoration: "none",
                  padding: "10px 12px",
                }}
              >
                {child.label}
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}
