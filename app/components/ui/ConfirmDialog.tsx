"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";

type Props = {
  open: boolean;
  title: React.ReactNode;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export function ConfirmDialog(props: Props) {
  if (!props.open) return null;
  return <ConfirmDialogInner {...props} />;
}

function ConfirmDialogInner({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pending, setPending] = useState(false);

  // onClose rides a ref so the mount effect never re-runs on a parent
  // re-render — re-running it would steal focus back to the dialog
  // shell mid-interaction (same class as the FilterDrawer ✕ bug).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
