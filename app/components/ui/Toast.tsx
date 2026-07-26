"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { cn } from "./cn";

type Tone = "success" | "error" | "info";
type ToastRecord = { id: number; tone: Tone; message: string };
type ToastCtx = { push: (tone: Tone, message: string) => void };

const Ctx = createContext<ToastCtx | null>(null);

let seq = 0;

/**
 * Global toast provider — mount once at the layout level and any
 * client component can call `useToast().push(...)` to fire an alert.
 * Auto-dismiss after 4 s; multiple toasts stack.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const push = useCallback((tone: Tone, message: string) => {
    const id = ++seq;
    setToasts((list) => [...list, { id, tone, message }]);
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-2">
        {/* Success mirrors the inline Alert's S12.9 treatment exactly —
            white surface + green-check disc, green only in the icon —
            so the two confirmation surfaces read as one style. */}
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm shadow-lg",
              t.tone === "success" && "border-slate-200 bg-white",
              t.tone === "error" && "border-red-200 bg-red-50 text-red-700",
              t.tone === "info" && "border-slate-200 bg-white text-slate-800",
            )}
          >
            {t.tone === "success" && (
              <span
                aria-hidden="true"
                className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-emerald-50 ring-1 ring-emerald-200"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-emerald-600"
                >
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </span>
            )}
            <span
              className={cn(
                "min-w-0 leading-relaxed",
                t.tone === "success" && "font-medium text-slate-800",
              )}
            >
              {t.message}
            </span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/**
 * Ephemeral URL-driven toast — reads `?flash=success:message` off the
 * URL and fires the toast then strips the param. Server actions that
 * redirect (and router.push) use this to hand a message to the next
 * page. Keyed on the pathname because this sits in a persisting layout:
 * a soft navigation doesn't remount it, so a mount-only effect would
 * miss every in-app flash (every flash flow lands on a new pathname).
 * window.location — not useSearchParams — so static pages don't need a
 * Suspense/prerender bailout.
 */
export function FlashToast() {
  const { push } = useToast();
  const pathname = usePathname();
  useEffect(() => {
    const url = new URL(window.location.href);
    const flash = url.searchParams.get("flash");
    if (!flash) return;
    const [tone, ...msg] = flash.split(":");
    push(
      (["success", "error", "info"] as const).includes(tone as Tone)
        ? (tone as Tone)
        : "info",
      msg.join(":"),
    );
    url.searchParams.delete("flash");
    window.history.replaceState({}, "", url.toString());
  }, [pathname, push]);
  return null;
}
