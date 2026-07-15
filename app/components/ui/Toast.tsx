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
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-md",
              t.tone === "success" &&
                "border-emerald-200 bg-emerald-50 text-emerald-800",
              t.tone === "error" && "border-red-200 bg-red-50 text-red-700",
              t.tone === "info" && "border-slate-200 bg-white text-slate-800",
            )}
          >
            {t.message}
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
 * pathname and fires the toast then strips the param. Server actions
 * that redirect can use this to hand a message to the next page.
 */
export function FlashToast() {
  const { push } = useToast();
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
  }, [push]);
  return null;
}
