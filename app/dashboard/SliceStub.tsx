import type { ReactNode } from "react";
import { EmptyState } from "@/app/components/ui";

/**
 * Placeholder card for pages that ship in a later slice. Keeps the
 * dashboard shell walkable during Slice 0 without pretending features
 * exist. Body text names the slice number so it's obvious when a
 * reviewer opens it that this is intentional.
 */
export function SliceStub({
  title,
  slice,
  detail,
  cta,
}: {
  title: string;
  slice: string;
  detail?: ReactNode;
  cta?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          {title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">Coming in {slice}.</p>
      </div>
      <EmptyState
        title={`${title} is on the way`}
        body={
          <>
            This surface lands in <strong>{slice}</strong>. The dashboard shell,
            component library, and route guards are in place — the data-driven
            content will follow.
            {detail && (
              <>
                <br />
                <br />
                {detail}
              </>
            )}
          </>
        }
        secondary={cta}
      />
    </div>
  );
}
