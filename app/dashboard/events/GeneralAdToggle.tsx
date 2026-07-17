"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/ui";
import { toggleGeneralAd } from "./event-actions";

export function GeneralAdToggle({
  eventId,
  enabled,
}: {
  eventId: string;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
        General Ads
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={pending}
        className="relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
        style={{ background: enabled ? "var(--color-accent)" : "#cbd5e1" }}
        onClick={() =>
          startTransition(async () => {
            const res = await toggleGeneralAd(eventId, !enabled);
            if (res.error) {
              push("error", res.error);
            } else {
              push(
                "success",
                enabled ? "General Ads removed." : "General Ads enabled.",
              );
              router.refresh();
            }
          })
        }
      >
        <span
          className="pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: enabled ? "translateX(18px)" : "translateX(0)" }}
        />
      </button>
    </label>
  );
}
