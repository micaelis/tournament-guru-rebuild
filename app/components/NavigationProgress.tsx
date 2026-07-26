"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * App-wide top progress bar for internal navigations. Server-rendered
 * routes can take a beat before anything visibly changes; this gives the
 * click immediate feedback without touching any page code.
 *
 * How it works: a capture-phase click listener spots same-origin anchor
 * navigations (plus popstate for back/forward) and starts the bar; the
 * bar rushes to ~80% on a long ease-out and snaps to 100% when the
 * route actually commits (pathname/searchParams change). A short show
 * delay keeps instant navigations (prefetched routes) visually silent,
 * and a safety timeout clears the bar if a started navigation never
 * lands (cancelled transition, external handler, etc.).
 */
const SHOW_DELAY_MS = 120;
const SAFETY_TIMEOUT_MS = 15_000;

function anchorFrom(target: EventTarget | null): HTMLAnchorElement | null {
  let el = target instanceof Element ? target : null;
  while (el && el.tagName !== "A") el = el.parentElement;
  return el instanceof HTMLAnchorElement ? el : null;
}

function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");

  const timers = useRef<{ show?: number; safety?: number; reset?: number }>({});
  // Ref mirrors (synced in effects) so the bound-once DOM listeners and
  // timeouts see current values without re-binding on every navigation.
  const route = useRef("");
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    route.current = `${pathname}?${searchParams}`;
  }, [pathname, searchParams]);

  const finish = useCallback(() => {
    const t = timers.current;
    window.clearTimeout(t.show);
    window.clearTimeout(t.safety);
    if (phaseRef.current === "loading") {
      setPhase("done");
      t.reset = window.setTimeout(() => setPhase("idle"), 400);
    } else {
      setPhase("idle");
    }
  }, []);

  useEffect(() => {
    const t = timers.current;

    const start = () => {
      window.clearTimeout(t.show);
      window.clearTimeout(t.safety);
      window.clearTimeout(t.reset);
      // Delay the appearance so prefetched (near-instant) navigations
      // never flash the bar.
      t.show = window.setTimeout(() => setPhase("loading"), SHOW_DELAY_MS);
      t.safety = window.setTimeout(finish, SAFETY_TIMEOUT_MS);
    };

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const anchor = anchorFrom(e.target);
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same-route clicks (current nav item, hash jumps) don't navigate.
      if (`${url.pathname}?${url.searchParams}` === route.current) return;
      start();
    };

    const onPopState = () => {
      // The browser URL is already the destination here while React still
      // shows the old route. Equal → hash-only change, nothing will load.
      const url = new URL(window.location.href);
      if (`${url.pathname}?${url.searchParams}` !== route.current) start();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.clearTimeout(t.show);
      window.clearTimeout(t.safety);
      window.clearTimeout(t.reset);
    };
  }, [finish]);

  // The route committed — complete whatever bar is showing.
  useEffect(() => {
    finish();
  }, [pathname, searchParams, finish]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2.5px]"
      style={{
        opacity: phase === "idle" ? 0 : 1,
        transition: "opacity 250ms ease 100ms",
      }}
    >
      <div
        className="h-full rounded-r-full"
        style={{
          background: "var(--color-accent)",
          boxShadow:
            "0 0 8px color-mix(in srgb, var(--color-accent) 55%, transparent)",
          width: phase === "loading" ? "80%" : phase === "done" ? "100%" : "0%",
          transition:
            phase === "loading"
              ? "width 8s cubic-bezier(0.08, 0.65, 0.12, 1)"
              : phase === "done"
                ? "width 250ms ease-out"
                : "none",
        }}
      />
    </div>
  );
}

/** useSearchParams needs a Suspense boundary — the bar renders nothing
 * until hydration anyway, so an empty fallback costs nothing. */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}
