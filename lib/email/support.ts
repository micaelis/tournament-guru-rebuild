import "server-only";

const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";

type SupportPayload = {
  to: string;
  senderName: string;
  senderEmail: string;
  message: string;
};

export async function sendSupportEmail(payload: SupportPayload): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !from) {
    console.log(
      `[sendgrid-stub] support → ${payload.to} · from=${payload.senderName} <${payload.senderEmail}> · message=${payload.message.slice(0, 80)}`,
    );
    return { ok: true, reason: "stub" };
  }
  const subject = `Support · ${payload.senderName}`;
  const text = [
    `From: ${payload.senderName} <${payload.senderEmail}>`,
    "",
    payload.message,
    "",
    "---",
    "Reply directly to this email or contact the sender at the address above.",
  ].join("\n");

  try {
    const res = await fetch(SENDGRID_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { email: from, name: "Tournament Guru" },
        reply_to: { email: payload.senderEmail, name: payload.senderName },
        personalizations: [{ to: [{ email: payload.to }] }],
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: `${res.status} ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
