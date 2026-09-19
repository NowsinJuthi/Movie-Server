"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="max-h-[min(90dvh,32rem)] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:max-w-md sm:rounded-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-xl font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="min-h-11 w-full touch-manipulation sm:w-auto" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="min-h-11 w-full touch-manipulation sm:w-auto"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Working..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
