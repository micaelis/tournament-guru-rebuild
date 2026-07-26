/**
 * S12.10 — notification-prefs partial update. The FormData contract:
 * a row that was on screen submits `section:<name>`; each switch
 * submits `on` when checked and is ABSENT when unchecked. The patch
 * builder must write `false` for rendered-but-unchecked switches
 * (the "uncheck doesn't persist" regression) while leaving unrendered
 * sections untouched (an attendee saving must not wipe ED-only prefs).
 */
import { describe, expect, it } from "vitest";
import { buildNotifPatch } from "@/app/dashboard/account/notif-fields";

describe("buildNotifPatch", () => {
  it("writes true for a checked switch and false for a rendered-but-unchecked one", () => {
    const fd = new FormData();
    fd.set("section:review_replies", "1");
    fd.set("inapp_review_replies", "on");
    // email_review_replies rendered (same section) but unchecked → absent.
    const patch = buildNotifPatch(fd);
    expect(patch.inapp_review_replies).toBe(true);
    expect(patch.email_review_replies).toBe(false);
  });

  it("leaves unrendered sections out of the patch entirely", () => {
    const fd = new FormData();
    fd.set("section:review_replies", "1");
    const patch = buildNotifPatch(fd);
    // ED-only rows weren't on screen — writing false here would wipe
    // another role's saved prefs.
    expect(patch).not.toHaveProperty("inapp_event_reviews");
    expect(patch).not.toHaveProperty("email_event_reviews");
    expect(patch).not.toHaveProperty("inapp_favorited_events");
    expect(Object.keys(patch)).toHaveLength(2);
  });

  it("returns an empty patch for an empty form (action no-ops)", () => {
    expect(Object.keys(buildNotifPatch(new FormData()))).toHaveLength(0);
  });

  it("only 'on' counts as checked — tampered values read as off", () => {
    const fd = new FormData();
    fd.set("section:review_likes", "1");
    fd.set("inapp_review_likes", "true");
    const patch = buildNotifPatch(fd);
    expect(patch.inapp_review_likes).toBe(false);
  });
});
