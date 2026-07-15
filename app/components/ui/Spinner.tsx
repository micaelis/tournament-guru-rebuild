import { cn } from "./cn";

/** Tiny loading spinner; uses the tg-spin keyframe in globals.css. */
export function Spinner({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block rounded-full border-2 border-slate-200 border-t-slate-900",
        className,
      )}
      style={{
        width: size,
        height: size,
        animation: "tg-spin 0.8s linear infinite",
      }}
    />
  );
}
