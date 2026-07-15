"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui";
import {
  AddFirstEventPrompt,
  CreateTournamentDialog,
} from "./TournamentDialogs";

/**
 * The primary CTA on the first-run WelcomeCard. Opens the create
 * dialog; on success routes into the "add first event" prompt so the
 * new ED lands directly on the event form.
 */
export function FirstRunAddButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  return (
    <>
      <Button size="lg" onClick={() => setCreating(true)}>
        Add New Tournament
      </Button>
      <CreateTournamentDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          setCreatedId(id);
          router.refresh();
        }}
      />
      {createdId && (
        <AddFirstEventPrompt
          tournamentId={createdId}
          onDismiss={() => setCreatedId(null)}
        />
      )}
    </>
  );
}
