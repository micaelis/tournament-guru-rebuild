"use client";

import { useState, useTransition } from "react";
import { toggleFavorite } from "@/lib/user-events/actions";
import { useToast } from "@/app/components/ui";
import { cn } from "@/app/components/ui/cn";

/**
 * Favorite toggle, optimistic (reverts on error). Two looks:
 * - "pill" (default): labelled Favorite / Favorited chip (event page).
 * - "icon": round heart button for event cards (search results).
 * Signed-out callers pass `disabled` → a click nudges them to sign in
 * rather than hitting the action.
 */
export function FavoriteButton({
  eventId,
  initialFavorited,
  disabled,
  variant = "pill",
}: {
  eventId: string;
  initialFavorited: boolean;
  disabled?: boolean;
  variant?: "pill" | "icon";
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [, startTransition] = useTransition();
  const { push } = useToast();

  const toggle = () => {
    if (disabled) {
      push("info", "Sign in to favorite events.");
      return;
    }
    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      const res = await toggleFavorite(eventId);
      if (res.error) {
        setFavorited(!next);
        push("error", res.error);
      }
    });
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={favorited}
        aria-label={favorited ? "Remove from favorites" : "Save event"}
        className="tg-save-heart inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full"
        style={{
          width: 32,
          height: 32,
          border: "1px solid rgba(220,38,38,.18)",
          background: "#fff",
          color: favorited ? "#dc2626" : "#94a3b8",
          boxShadow:
            "0 2px 6px rgba(15,23,42,.10), 0 6px 14px -6px rgba(15,23,42,.14)",
          transition:
            "color .15s ease, background .15s ease, transform .1s ease, box-shadow .15s ease, border-color .15s ease",
        }}
      >
        <HeartGlyph filled={favorited} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={favorited}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition",
        favorited
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-400",
      )}
    >
      <HeartGlyph filled={favorited} />
      {favorited ? "Favorited" : "Favorite"}
    </button>
  );
}

function HeartGlyph({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
