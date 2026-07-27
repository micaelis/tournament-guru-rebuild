"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui";
import { Icon } from "@/app/dashboard/icons";
import {
  AddFirstEventPrompt,
  CreateTournamentDialog,
} from "./TournamentDialogs";

/**
 * The page header's "New tournament" CTA — owns the create dialog and
 * the follow-up "add first event?" prompt so the toolbar can stay a
 * pure filter row. (The first-run WelcomeCard has its own sibling,
 * FirstRunAddButton.)
 */
export function NewTournamentButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  return (
    <>
      <Button onClick={() => setCreating(true)}>
        <Icon name="plus" className="h-4 w-4" />
        New tournament
      </Button>
      <CreateTournamentDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          setCreatedId(id);
          startTransition(() => router.refresh());
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
