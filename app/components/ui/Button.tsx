import { Spinner } from "./Spinner";

type Variant = "primary" | "ghost";

/**
 * Primary = full-width red CTA (brand accent). Ghost = bordered neutral.
 * Pass `pending` to show a spinner and disable the button during a submit.
 */
export function Button({
  variant = "primary",
  pending = false,
  fullWidth = true,
  children,
  style,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  pending?: boolean;
  fullWidth?: boolean;
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: fullWidth ? "100%" : undefined,
    borderRadius: 11,
    padding: "13px 20px",
    fontSize: 14.5,
    fontWeight: 700,
    cursor: pending || disabled ? "not-allowed" : "pointer",
    transition: "background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease",
    opacity: disabled && !pending ? 0.55 : 1,
  };

  const variantStyle: React.CSSProperties =
    variant === "primary"
      ? { background: "var(--color-accent)", color: "#fff", border: "1px solid transparent" }
      : {
          background: "#fff",
          color: "var(--color-dark)",
          border: "1px solid var(--color-border)",
        };

  return (
    <button
      {...props}
      disabled={pending || disabled}
      className={`tg-btn tg-btn-${variant}`}
      style={{ ...base, ...variantStyle, ...style }}
    >
      {pending && <Spinner size={16} />}
      {children}
    </button>
  );
}
