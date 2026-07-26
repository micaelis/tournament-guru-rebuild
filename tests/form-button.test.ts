/**
 * S12.16 — submitter-aware pending for multi-submit forms. useFormStatus
 * flips `pending` for the WHOLE form, so two FormButtons ("Save as
 * draft" / "Publish") both showed "Saving…" whichever was clicked. The
 * decision of which button owns the in-flight submission is the pure
 * `ownsPending` — the browser puts exactly the clicked submitter's
 * name/value pair in the FormData, so a button with an identity owns the
 * submission only when its own pair is present.
 */
import { describe, expect, it } from "vitest";
import { ownsPending } from "@/app/components/ui/FormButton";

function fd(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(entries)) data.set(k, v);
  return data;
}

describe("ownsPending", () => {
  it("is never pending while the form is idle", () => {
    expect(ownsPending(false, null, undefined, undefined)).toBe(false);
    expect(ownsPending(false, fd({ intent: "draft" }), "intent", "draft")).toBe(
      false,
    );
  });

  it("owns every submission when the button has no submitter identity", () => {
    expect(ownsPending(true, null, undefined, undefined)).toBe(true);
    expect(ownsPending(true, fd({ intent: "draft" }), undefined, undefined)).toBe(
      true,
    );
    // name without value (or vice versa) is not an identity either.
    expect(ownsPending(true, fd({ intent: "draft" }), "intent", undefined)).toBe(
      true,
    );
  });

  it("owns the submission only when the FormData carries its own pair", () => {
    const data = fd({ intent: "draft", title: "x" });
    expect(ownsPending(true, data, "intent", "draft")).toBe(true);
    expect(ownsPending(true, data, "intent", "publish")).toBe(false);
  });

  it("stays quiet when the in-flight FormData is unavailable", () => {
    expect(ownsPending(true, null, "intent", "draft")).toBe(false);
  });

  it("matches numeric values through the string form the browser posts", () => {
    expect(ownsPending(true, fd({ step: "2" }), "step", 2)).toBe(true);
    expect(ownsPending(true, fd({ step: "2" }), "step", 3)).toBe(false);
  });
});
