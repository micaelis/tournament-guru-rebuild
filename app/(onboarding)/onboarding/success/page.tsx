import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { TGLogo } from "@/app/components/TGLogo";

export default async function OnboardingSuccessPage() {
  const supabase = await createServerAuthClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, user_type, onboarding_completed")
    .eq("id", userData.user.id)
    .maybeSingle<{
      first_name: string | null;
      user_type: "attendee" | "event_director" | "admin";
      onboarding_completed: boolean;
    }>();

  if (!profile) redirect("/login");
  if (!profile.onboarding_completed) redirect("/onboarding");

  const firstName = profile.first_name || "there";
  const isED = profile.user_type === "event_director";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12 text-center"
      style={{
        backgroundColor: "#eef2f9",
        backgroundImage:
          "radial-gradient(1040px 640px at -4% -14%, rgba(220,38,38,.13), transparent 56%)," +
          "radial-gradient(980px 600px at 104% -8%, rgba(0,77,255,.10), transparent 56%)," +
          "radial-gradient(820px 820px at 100% 50%, rgba(245,158,11,.07), transparent 60%)," +
          "radial-gradient(1000px 900px at 40% 126%, rgba(124,58,237,.07), transparent 60%)",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <TGLogo href="/" size="xl" />
        </div>

        <div className="rounded-3xl border border-white/60 bg-white/80 px-8 py-10 shadow-xl backdrop-blur-sm">
          {/* Checkmark */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#059669"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 className="font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
            You&apos;re all set, {firstName}!
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-600">
            {isED
              ? "Your account is ready. Head to your dashboard to manage events and connect with attendees."
              : "Your account is ready. Start browsing events tailored to your preferences."}
          </p>

          <div className="mt-8 space-y-3">
            <Link
              href={isED ? "/dashboard/events" : "/events"}
              className="flex w-full items-center justify-center rounded-2xl px-5 py-3.5 text-[15px] font-bold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-md"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
                boxShadow: "0 8px 20px -6px rgba(220,38,38,.5)",
              }}
            >
              {isED ? "Go to Dashboard" : "Browse Events"}
            </Link>
            {!isED && (
              <Link
                href="/dashboard/reviews"
                className="block w-full rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          © {new Date().getFullYear()} Tournament Guru
        </p>
      </div>
    </div>
  );
}
