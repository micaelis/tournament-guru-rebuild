"use client";

/* StarRating — thin wrapper around `react-simple-star-rating` styled to
   match the Tournament Guru palette. Handles both interactive input (the
   Write-a-Review form) and non-interactive display. Supports half-stars.

   For read-only display of an existing average (e.g. inside a card), the
   existing `<Stars>` component is still fine and uses no dependency; this
   one is the plugin-backed variant Franco asked for on June 18 for the
   review flow where users pick a fractional score by clicking. */

import { Rating } from "react-simple-star-rating";

type Common = {
  /** Rating value in 0–5 stars (e.g. 3.5 for three-and-a-half). */
  value: number;
  /** Star size in px. Defaults to 22 (input-friendly). */
  size?: number;
  /** Enable half-star selection when true. Read-only display already
   *  supports halves regardless. */
  allowHalf?: boolean;
  className?: string;
};

type Interactive = Common & {
  readOnly?: false;
  onChange: (v: number) => void;
};

type ReadOnly = Common & {
  readOnly: true;
  onChange?: never;
};

export function StarRating(props: Interactive | ReadOnly) {
  const size = props.size ?? 22;
  // `react-simple-star-rating` measures in 0–100. Convert 0–5 → 0–100.
  const initialValue = Math.max(0, Math.min(5, props.value)) * 20;

  return (
    <Rating
      initialValue={initialValue}
      readonly={!!props.readOnly}
      allowFraction={props.allowHalf !== false}
      size={size}
      fillColor="var(--color-gold)"
      emptyColor="#e2e8f0"
      SVGstyle={{ display: "inline-block" }}
      transition
      onClick={(rate: number) => {
        // rate is in 0–100 from the plugin; convert back to 0–5.
        if (!props.readOnly && "onChange" in props && props.onChange) {
          props.onChange(rate / 20);
        }
      }}
      className={props.className}
    />
  );
}
