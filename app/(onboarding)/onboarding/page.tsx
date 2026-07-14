import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata: Metadata = { title: "Set up your account — Tournament Guru" };

export default async function OnboardingPage() {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this route, but be defensive.
  if (!user) redirect("/login?next=/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, full_name, onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_complete) redirect("/");

  // Prefill from any name we already have on the profile row.
  const [fromFullFirst = "", ...fromFullRest] = (profile?.full_name ?? "").split(" ");

  return (
    <OnboardingWizard
      initialFirstName={profile?.first_name ?? fromFullFirst}
      initialLastName={profile?.last_name ?? fromFullRest.join(" ")}
    />
  );
}
