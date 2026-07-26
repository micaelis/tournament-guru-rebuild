import type { Locator } from "@playwright/test";

/**
 * setInputFiles that survives the hydration race on freshly-loaded
 * dynamic pages. Route-level loading.tsx (S12.13) streams the page body
 * in a deferred Suspense chunk, so React can attach a file input's
 * change handler a beat AFTER the input is visible — and a change event
 * dispatched in that window is silently lost. A real user can't hit
 * this (the OS file picker alone outlasts hydration), but Playwright's
 * programmatic setInputFiles right after goto() can.
 *
 * `reacted` is an expect(...) probe with its own timeout: it must throw
 * while the UI hasn't responded. Each retry re-sets the files, which
 * re-dispatches the change event once hydration has landed. The final
 * attempt runs the probe with the caller's full timeout so a genuine
 * failure still reports the real assertion.
 */
export async function setInputFilesHydrated(
  input: Locator,
  files: Parameters<Locator["setInputFiles"]>[0],
  reacted: (timeoutMs: number) => Promise<unknown>,
  { attemptTimeoutMs = 2_500, finalTimeoutMs = 15_000 } = {},
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await input.setInputFiles(files);
    try {
      await reacted(attemptTimeoutMs);
      return;
    } catch {
      // No reaction — the handler wasn't attached yet. Go again.
    }
  }
  await input.setInputFiles(files);
  await reacted(finalTimeoutMs);
}
