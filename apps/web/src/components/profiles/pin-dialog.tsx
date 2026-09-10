"use client";

import type { ReactNode } from "react";

export function PinDialog({
  open,
  title,
  error,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  error?: string | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <form
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const pin = String(new FormData(form).get("pin") ?? "");
          onSubmit(pin);
        }}
      >
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Enter the 4-digit PIN.</p>
        <input
          name="pin"
          inputMode="numeric"
          maxLength={4}
          autoFocus
          className="mt-4 h-12 w-full rounded-md border border-input bg-background px-3 text-center text-2xl tracking-[0.6em]"
        />
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="px-3 py-2 text-sm text-muted-foreground" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}

export function ScreenMessage({ children }: { children: ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center text-muted-foreground">{children}</main>;
}
