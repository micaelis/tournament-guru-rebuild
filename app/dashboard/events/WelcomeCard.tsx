import { Button } from "@/app/components/ui";

/**
 * First-run empty state for an ED with no tournaments yet. Copy is
 * verbatim from Dashboard > Events.rtf, including the static YouTube
 * embed. The three info tiles use large numeral eyebrows (01/02/03)
 * as called out in the spec.
 */
export function WelcomeCard({
  firstName,
  onAddTournament,
}: {
  firstName: string;
  onAddTournament?: React.ReactNode;
}) {
  return (
    <section className="space-y-8 rounded-2xl border border-slate-200 bg-white p-8 md:p-12">
      <header>
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900 md:text-4xl">
          Welcome, {firstName || "there"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600 md:text-base">
          We&apos;re excited to have you on board! As an Event Director, you
          can create and manage tournaments — watch the video or follow the
          guide to get started.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <InfoTile
          number="01"
          title="Create Your Event"
          body="Set up your event in minutes. Add details, schedule the date, and customize it to fit your audience."
        />
        <InfoTile
          number="02"
          title="Promote Your Event"
          body="Share your event with your community, reach a wider audience, and boost attendance."
        />
        <InfoTile
          number="03"
          title="Get benefits from this promotion"
          body="Enjoy increased visibility, attract more participants, and grow your reputation."
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="relative aspect-video w-full bg-slate-100">
          <iframe
            className="absolute inset-0 h-full w-full"
            src="https://www.youtube.com/embed/DRx5FdXORwY?si=zR5vmdYVlvYUHp4P"
            title="Tournament Guru — Getting started"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </div>

      <div className="flex justify-start">
        {onAddTournament ?? (
          <Button variant="primary" size="lg" disabled>
            Add New Tournament
          </Button>
        )}
      </div>
    </section>
  );
}

function InfoTile({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
      <p className="font-[var(--font-heading)] text-5xl font-extrabold text-red-600">
        {number}
      </p>
      <h3 className="mt-3 font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
        {title}
      </h3>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
    </div>
  );
}
