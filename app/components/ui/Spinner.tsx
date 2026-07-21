import { cn } from "./cn";

/**
 * Shared inline spinner (the tg-spin keyframe from globals.css). Sized
 * in em so it tracks the surrounding text scale, tinted via
 * currentColor so it inherits the control's text color. Decorative —
 * pair it with visible pending copy or aria-busy on the container.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-[1.05em] w-[1.05em] shrink-0 rounded-full border-2 border-current border-t-transparent opacity-80",
        className,
      )}
      style={{ animation: "tg-spin .6s linear infinite" }}
    />
  );
}
