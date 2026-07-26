/**
 * Notification-preference form contract, shared by the Server Action
 * and its unit test. Each notification row submits:
 *   - `section:<name>` = "1"  → the row's pair was rendered on screen
 *   - `inapp_<name>` / `email_<name>` = "on" when that switch is on
 * An unchecked switch is ABSENT from the FormData — indistinguishable
 * from an unrendered one — so the section marker is what authorizes
 * writing `false` (same partial-update rule as updateProfile, S8.7).
 */

export const NOTIF_FIELDS = [
  "email_review_replies",
  "inapp_review_replies",
  "email_review_likes",
  "inapp_review_likes",
  "email_comment_replies",
  "inapp_comment_replies",
  "email_event_reviews",
  "inapp_event_reviews",
  "email_favorited_events",
  "inapp_favorited_events",
] as const;

export type NotifField = (typeof NOTIF_FIELDS)[number];

/** Build the profiles patch: only fields whose section was rendered,
 * `true` when the switch submitted "on", `false` when it didn't. */
export function buildNotifPatch(
  formData: FormData,
): Partial<Record<NotifField, boolean>> {
  const patch: Partial<Record<NotifField, boolean>> = {};
  for (const field of NOTIF_FIELDS) {
    const section = field.replace(/^(email|inapp)_/, "");
    if (!formData.has(`section:${section}`)) continue;
    patch[field] = formData.get(field) === "on";
  }
  return patch;
}
