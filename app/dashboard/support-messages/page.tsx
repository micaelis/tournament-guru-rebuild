import { requireSessionAndProfile } from "@/lib/supabase/session";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { SupportMessagesTable, type SupportMessageRow } from "./SupportMessagesTable";

export default async function SupportMessagesPage() {
  const { profile } = await requireSessionAndProfile();
  if (profile.user_type !== "admin") redirect("/dashboard/events");

  const supabase = await createServerAuthClient();
  const { data } = await supabase
    .from("support_messages")
    .select(
      "id, name, email, message, created_at, sender:profiles!support_messages_user_id_fkey(user_type, role_title)",
    )
    .order("created_at", { ascending: false });

  const rows: SupportMessageRow[] = ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    email: string;
    message: string;
    created_at: string;
    sender: { user_type: string; role_title: string } | null;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    message: r.message,
    created_at: r.created_at,
    user_type: r.sender?.user_type ?? null,
    role_title: r.sender?.role_title ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
          Support Messages
        </h1>
        <p className="mt-1.5 text-[13.5px] text-slate-500">
          Messages submitted through the dashboard support form.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">
          No support messages yet.
        </p>
      ) : (
        <SupportMessagesTable rows={rows} />
      )}
    </div>
  );
}
