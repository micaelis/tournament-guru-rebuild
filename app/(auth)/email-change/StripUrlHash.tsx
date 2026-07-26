"use client";

import { useEffect } from "react";

/**
 * GoTrue's verify redirect appends its status to the URL fragment
 * (`#message=…`/`#error=…`) and fragments survive the 302 hops through
 * /auth/callback — scrub it so the address bar shows a clean URL.
 */
export function StripUrlHash() {
  useEffect(() => {
    if (window.location.hash) {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);
  return null;
}
