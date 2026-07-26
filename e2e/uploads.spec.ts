import { test, expect } from "@playwright/test";
import {
  createEventDirector,
  deleteTournament,
  deleteUser,
  seedTournament,
  type SeededUser,
} from "./helpers/db";
import { signIn } from "./helpers/auth";
import { setInputFilesHydrated } from "./helpers/hydration";

/**
 * Real browser → Supabase Storage upload, end to end. Picks a PNG in the
 * event form's logo field; the ImageUploadField uploads it to the public
 * event-images bucket and drops the resulting public URL into the field.
 * We assert the field now holds a storage URL under the ED's own folder —
 * proof the client upload + RLS path works, not just that the widget
 * renders. (Storage RLS itself is proven in tests/probes/storage-rls.)
 */

// 1x1 transparent PNG.
const PNG_1PX = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100" +
    "05000106a5b0f60000000049454e44ae426082",
  "hex",
);

test("ED uploads an event logo to Storage from the add-event form", async ({
  page,
}) => {
  let ed: SeededUser | undefined;
  let tournamentId: string | undefined;
  try {
    ed = await createEventDirector({ completeOnboarding: true });
    tournamentId = await seedTournament(ed.id);
    await signIn(page, ed.email, ed.password);
    await page.goto(`/dashboard/events/new?tournament=${tournamentId}`);

    // The ImageUploadField's file input is hidden with an accessible name.
    // On success the widget writes the public URL into the logo_url input;
    // the 1px PNG uploads to the local bucket well inside one attempt
    // window, so a silent attempt means the change handler wasn't
    // hydrated yet and the helper re-fires it.
    const logoInput = page.locator('input[name="logo_url"]');
    await setInputFilesHydrated(
      page.getByLabel("Upload Event logo"),
      { name: "logo.png", mimeType: "image/png", buffer: PNG_1PX },
      (timeout) =>
        expect(logoInput).toHaveValue(
          /\/storage\/v1\/object\/public\/event-images\//,
          { timeout },
        ),
      { attemptTimeoutMs: 5_000 },
    );
    // Keyed by the ED's own uid folder (owner-scoped path).
    await expect(logoInput).toHaveValue(new RegExp(`/event-images/${ed.id}/`));
  } finally {
    if (tournamentId) await deleteTournament(tournamentId);
    if (ed) await deleteUser(ed.id);
  }
});
