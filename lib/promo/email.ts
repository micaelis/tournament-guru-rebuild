import "server-only";

const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";

type SendPayload = {
  to: string;
  templateData: {
    event_title: string;
    link_url: string;
  };
};

/**
 * SendGrid client. Uses env:
 *   SENDGRID_API_KEY        - bearer token
 *   SENDGRID_FROM_EMAIL     - verified sender
 *   SENDGRID_TEMPLATE_ID    - promo-review dynamic template
 * When any of these are missing (local dev) we log the intent + return
 * ok — the promo flow still generates codes + advances status so the
 * app is fully testable offline.
 */
export async function sendPromoEmail(payload: SendPayload): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  const templateId = process.env.SENDGRID_TEMPLATE_ID;
  if (!apiKey || !from || !templateId) {
    console.log(
      `[sendgrid-stub] ${payload.to} · event=${payload.templateData.event_title} · link=${payload.templateData.link_url}`,
    );
    return { ok: true, reason: "stub" };
  }
  try {
    const res = await fetch(SENDGRID_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { email: from, name: "Tournament Guru" },
        personalizations: [
          {
            to: [{ email: payload.to }],
            dynamic_template_data: payload.templateData,
          },
        ],
        template_id: templateId,
        subject: "Submit Your Review on Your Recent Tournament Experience",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, reason: `${res.status} ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Fire an array of sends with a small concurrency limit. SendGrid
 * rate-limits at hundreds of requests per second on the shared tier;
 * batches of 5 with a short throttle keeps the app well under any
 * reasonable cap and keeps the action within a single Vercel
 * function invocation (per spec, "the system should queue these jobs
 * and make sure they are executed" — real background queue is a
 * follow-up).
 */
export async function sendPromoEmailsInBatches(
  batch: SendPayload[],
): Promise<{ sent: number; failed: number; failures: string[] }> {
  const chunkSize = 5;
  const failures: string[] = [];
  let sent = 0;
  for (let i = 0; i < batch.length; i += chunkSize) {
    const chunk = batch.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map((c) => sendPromoEmail(c)));
    for (const [j, r] of results.entries()) {
      if (r.ok) sent += 1;
      else failures.push(`${chunk[j].to}: ${r.reason ?? "unknown"}`);
    }
    // Small throttle between chunks — 100 ms is invisible to the
    // admin at the popup level and keeps burst rate reasonable.
    if (i + chunkSize < batch.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return { sent, failed: failures.length, failures };
}
