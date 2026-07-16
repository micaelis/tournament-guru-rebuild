"use client";

import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "./cn";

type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> & {
  size?: "sm" | "md";
  label?: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ size = "md", label, className, ...rest }, ref) {
    const dim = size === "sm" ? "h-[15px] w-[15px]" : "h-[17px] w-[17px]";
    const tick = size === "sm" ? 9 : 11;

    return (
      <label
        className={cn(
          "group/cb inline-flex cursor-pointer select-none items-center gap-2",
          rest.disabled && "pointer-events-none opacity-50",
          className,
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          {...rest}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            dim,
            "inline-flex shrink-0 items-center justify-center rounded-[5px] border transition-all duration-150",
            "border-slate-300 bg-white",
            "group-hover/cb:border-slate-400 group-hover/cb:bg-slate-50",
            "group-active/cb:scale-90",
            "group-has-[:focus-visible]/cb:ring-2 group-has-[:focus-visible]/cb:ring-slate-900/30 group-has-[:focus-visible]/cb:ring-offset-1",
            "group-has-[:checked]/cb:border-slate-900 group-has-[:checked]/cb:bg-slate-900",
            "group-hover/cb:group-has-[:checked]/cb:bg-slate-700 group-hover/cb:group-has-[:checked]/cb:border-slate-700",
          )}
        >
          <svg
            width={tick}
            height={tick}
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-0 transition-opacity duration-100 group-has-[:checked]/cb:opacity-100"
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        </span>
        {label && (
          <span className="text-sm font-medium text-slate-700 group-hover/cb:text-slate-900 transition-colors">
            {label}
          </span>
        )}
      </label>
    );
  },
);
