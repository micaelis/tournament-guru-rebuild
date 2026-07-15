import { type NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import { requireSessionAndProfile } from "@/lib/supabase/session";

/**
 * Generates a QR code for an event's public URL. Admin-only.
 * Spec: 400x400 PNG, plus a PDF variant. We compute on demand
 * (idempotent — the QR just encodes the URL). Format is selected
 * via `?format=png|pdf`, defaulting to PNG.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { profile } = await requireSessionAndProfile();
  if (profile.user_type !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(`/events/${id}`, request.nextUrl.origin).toString();
  const format = request.nextUrl.searchParams.get("format") ?? "png";

  const png = await QRCode.toBuffer(url, {
    width: 400,
    margin: 2,
    color: { dark: "#0f172a", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });

  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    const image = await pdf.embedPng(png);
    const page = pdf.addPage([432, 500]);
    page.drawImage(image, { x: 16, y: 84, width: 400, height: 400 });
    page.drawText(`Event: ${id}`, { x: 16, y: 60, size: 10 });
    page.drawText(url, { x: 16, y: 44, size: 8 });
    const bytes = await pdf.save();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="event-${id}-qr.pdf"`,
      },
    });
  }

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="event-${id}-qr.png"`,
    },
  });
}
