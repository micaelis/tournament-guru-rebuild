"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPending(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl outline-none"
      >
        <h3 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
          {title}
        </h3>
        {body && <p className="mt-2 text-sm text-slate-600">{body}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? "…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
