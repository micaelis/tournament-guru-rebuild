import Link from "next/link";
import type { Route } from "next";
import { createAnonServerClient } from "@/lib/supabase/server";
import { unwrapRows } from "@/lib/supabase/unwrap";
import { safeImageSrc } from "@/lib/url";

/**
 * Public directors directory. Reads from the `public_directors` view
 * so no PII (email / DOB) leaks even if the caller inspects the wire.
 */
export default async function DirectorsPage() {
  const supabase = createAnonServerClient();
  // unwrap: a failed query must not render as "No directors listed yet".
  const directors = unwrapRows<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    organization_title: string | null;
    org_logo_url: string | null;
    profile_photo_url: string | null;
  }>(
    await supabase
      .from("public_directors")
      .select(
        "id, first_name, last_name, organization_title, org_logo_url, profile_photo_url",
      ),
    "DirectorsPage directors",
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-[var(--font-heading)] text-4xl font-extrabold text-slate-900">
        Event Directors
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Organizations running events on Tournament Guru.
      </p>
      {directors.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
          No directors listed yet — check back soon.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {directors.map((d) => {
            const logo = safeImageSrc(d.org_logo_url ?? d.profile_photo_url);
            const name =
              d.organization_title ??
              [d.first_name, d.last_name].filter(Boolean).join(" ") ??
              "Director";
            return (
              <Link
                key={d.id}
                href={`/directors/${d.id}` as Route}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-400"
              >
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt=""
                    className="h-12 w-12 flex-none rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-500">
                    {name[0]?.toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-slate-900">
                    {name}
                  </p>
                  {d.organization_title && d.first_name && (
                    <p className="text-xs text-slate-500">
                      {d.first_name} {d.last_name}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
