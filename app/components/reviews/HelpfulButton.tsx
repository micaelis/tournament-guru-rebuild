"use client";

import { useState, useTransition } from "react";
import { toggleHelpful } from "@/lib/reviews/actions";
import { useToast } from "@/app/components/ui";
import { cn } from "@/app/components/ui/cn";

/**
 * Thumbs-up toggle. Client-owned optimistic state — flip on click,
 * revert on server error. Anon visitors get a "sign in" nudge via the
 * toast because RLS blocks the insert.
 */
export function HelpfulButton({
  reviewId,
  initialHelpful,
  initialCount,
  disabled,
}: {
  reviewId: string;
  initialHelpful: boolean;
  initialCount: number;
  disabled?: boolean;
}) {
  const [helpful, setHelpful] = useState(initialHelpful);
  const [count, setCount] = useState(initialCount);
  const [_, startTransition] = useTransition();
  const { push } = useToast();

  const onClick = () => {
    if (disabled) {
      push("info", "Sign in to mark reviews helpful.");
      return;
    }
    const nextHelpful = !helpful;
    setHelpful(nextHelpful);
    setCount((n) => n + (nextHelpful ? 1 : -1));
    startTransition(async () => {
      const res = await toggleHelpful(reviewId);
      if (res.error) {
        setHelpful(!nextHelpful);
        setCount((n) => n + (nextHelpful ? -1 : 1));
        push("error", res.error);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition",
        helpful
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-400",
      )}
      aria-pressed={helpful}
    >
      <ThumbUpGlyph filled={helpful} />
      Helpful
      {count > 0 && <span className="text-slate-500">· {count}</span>}
    </button>
  );
}

function ThumbUpGlyph({ filled }: { filled: boolean }) {
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
      <path d="M7 22V11" />
      <path d="M15 22H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h1.5l3-6a1.5 1.5 0 0 1 3 1v6h4a2 2 0 0 1 2 2l-2 8a3 3 0 0 1-3 2z" />
    </svg>
  );
}
