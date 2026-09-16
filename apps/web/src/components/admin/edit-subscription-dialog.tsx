"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { SUBSCRIPTION_STATUSES, type AdminSubscriptionRow } from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EditSubscriptionFormValues = {
  status: string;
  currentPeriodEnd: string;
  trialEnd: string;
  gracePeriodEndsAt: string;
  autoRenew: boolean;
  reason: string;
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function EditSubscriptionDialog({
  open,
  subscription,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  subscription: AdminSubscriptionRow | null;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: EditSubscriptionFormValues) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<EditSubscriptionFormValues | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && subscription) {
      setForm({
        status: subscription.status,
        currentPeriodEnd: toLocalInput(subscription.currentPeriodEnd),
        trialEnd: toLocalInput(subscription.trialEnd),
        gracePeriodEndsAt: toLocalInput(subscription.gracePeriodEndsAt),
        autoRenew: subscription.autoRenew,
        reason: "",
      });
    }
  }, [open, subscription]);

  if (!mounted || !open || !subscription || !form) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Manage subscription</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {subscription.userDisplayName || subscription.userEmail} · {subscription.plan.name}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
          <div>
            <p className="text-muted-foreground">Devices</p>
            <p className="font-medium">
              {subscription.deviceCount} / {subscription.maxDevices}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Streams</p>
            <p className="font-medium">
              {subscription.streamCount} / {subscription.maxStreams}
            </p>
          </div>
        </div>

        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(form);
          }}
        >
          <label className="block space-y-2 text-sm">
            <Label>Status</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              {SUBSCRIPTION_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 text-sm">
            <Label>Period end</Label>
            <Input
              type="datetime-local"
              value={form.currentPeriodEnd}
              onChange={(event) => setForm({ ...form, currentPeriodEnd: event.target.value })}
            />
          </label>

          {subscription.status === "trial" || form.status === "trial" ? (
            <label className="block space-y-2 text-sm">
              <Label>Trial end</Label>
              <Input
                type="datetime-local"
                value={form.trialEnd}
                onChange={(event) => setForm({ ...form, trialEnd: event.target.value })}
              />
            </label>
          ) : null}

          {subscription.status === "suspended" || form.status === "suspended" ? (
            <label className="block space-y-2 text-sm">
              <Label>Grace period ends</Label>
              <Input
                type="datetime-local"
                value={form.gracePeriodEndsAt}
                onChange={(event) => setForm({ ...form, gracePeriodEndsAt: event.target.value })}
              />
            </label>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.autoRenew}
              onChange={(event) => setForm({ ...form, autoRenew: event.target.checked })}
            />
            Auto-renew enabled
          </label>

          <label className="block space-y-2 text-sm">
            <Label>Reason (optional)</Label>
            <Input
              value={form.reason}
              placeholder="Audit note for status changes"
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export function buildPatchPayload(values: EditSubscriptionFormValues) {
  return {
    status: values.status,
    currentPeriodEnd: fromLocalInput(values.currentPeriodEnd),
    trialEnd: fromLocalInput(values.trialEnd),
    gracePeriodEndsAt: fromLocalInput(values.gracePeriodEndsAt),
    autoRenew: values.autoRenew,
    reason: values.reason.trim() || undefined,
  };
}
