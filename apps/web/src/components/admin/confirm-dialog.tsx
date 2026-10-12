"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfirmDialog({
  open,
  title,
  description,
  bullets,
  variant = "default",
  confirmLabel = "Confirm",
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  bullets?: string[];
  variant?: "default" | "destructive";
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
        className={cn(
          "max-h-[min(90dvh,32rem)] w-full overflow-y-auto rounded-t-2xl border bg-card p-5 shadow-xl sm:max-w-md sm:rounded-xl sm:p-6",
          variant === "destructive" ? "border-destructive/25" : "border-border",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={variant === "destructive" ? "flex gap-4" : undefined}>
          {variant === "destructive" ? (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/20"
              aria-hidden
            >
              <AlertTriangle className="h-5 w-5" strokeWidth={2.25} />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-xl font-semibold tracking-tight">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            {bullets?.length ? (
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {bullets.map((item) => (
                  <li key={item} className="flex gap-2 leading-snug">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/70" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
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
