"use client";

import { useState, useTransition } from "react";
import { toggleFavorite } from "@/lib/user-events/actions";
import { useToast } from "@/app/components/ui";
import { cn } from "@/app/components/ui/cn";

/** Heart-style favorite toggle. Optimistic — revert on error. */
export function FavoriteButton({
  eventId,
  initialFavorited,
  disabled,
}: {
  eventId: string;
  initialFavorited: boolean;
  disabled?: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [, startTransition] = useTransition();
  const { push } = useToast();

  return (
    <button
      type="button"
      onClick={() => {
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
      }}
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
