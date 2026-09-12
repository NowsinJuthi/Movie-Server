"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { PLAN_FEATURES, PLAN_TIERS, VIDEO_QUALITIES, type PublicPlan } from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EditPlanFormValues = {
  name: string;
  description: string;
  tier: string;
  currency: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  maxVideoQuality: string;
  maxDevices: number;
  maxStreams: number;
  trialDays: number;
  sortOrder: number;
  features: string[];
  isActive: boolean;
};

export function EditPlanDialog({
  open,
  plan,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  plan: PublicPlan | null;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: EditPlanFormValues) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<EditPlanFormValues | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && plan) {
      setForm({
        name: plan.name,
        description: plan.description,
        tier: plan.tier,
        currency: plan.currency,
        monthlyPriceCents: plan.monthlyPriceCents,
        yearlyPriceCents: plan.yearlyPriceCents,
        maxVideoQuality: plan.maxVideoQuality,
        maxDevices: plan.maxDevices,
        maxStreams: plan.maxStreams,
        trialDays: plan.trialDays,
        sortOrder: plan.sortOrder,
        features: [...plan.features],
        isActive: plan.isActive,
      });
    }
  }, [open, plan]);

  if (!mounted || !open || !plan || !form) return null;

  const toggleFeature = (feature: string) => {
    setForm((current) =>
      current
        ? {
            ...current,
            features: current.features.includes(feature)
              ? current.features.filter((item) => item !== feature)
              : [...current.features, feature],
          }
        : current,
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-plan-title"
        className="relative max-h-[min(92vh,720px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <button
          type="button"
          className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Close"
          disabled={pending}
          onClick={onClose}
        >
          <X className="size-4" />
        </button>

        <h2 id="edit-plan-title" className="text-lg font-semibold">
          Edit plan
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Slug: <span className="font-mono text-foreground">{plan.slug}</span> (cannot be changed)
        </p>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <form
          className="mt-5 grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(form);
          }}
        >
          <label className="space-y-2 text-sm md:col-span-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>

          <label className="space-y-2 text-sm md:col-span-2">
            <Label>Description</Label>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              required
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-2 text-sm">
            <Label>Tier</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3"
              value={form.tier}
              onChange={(event) => setForm({ ...form, tier: event.target.value })}
            >
              {PLAN_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <Label>Max quality</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3"
              value={form.maxVideoQuality}
              onChange={(event) => setForm({ ...form, maxVideoQuality: event.target.value })}
            >
              {VIDEO_QUALITIES.map((quality) => (
                <option key={quality} value={quality}>
                  {quality}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <Label>Currency</Label>
            <Input
              value={form.currency}
              maxLength={3}
              onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })}
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <Label>Sort order</Label>
            <Input
              type="number"
              value={String(form.sortOrder)}
              onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
              min={0}
            />
          </label>

          <label className="space-y-2 text-sm">
            <Label>Monthly price (cents)</Label>
            <Input
              type="number"
              value={String(form.monthlyPriceCents)}
              onChange={(event) => setForm({ ...form, monthlyPriceCents: Number(event.target.value) })}
              min={0}
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <Label>Yearly price (cents)</Label>
            <Input
              type="number"
              value={String(form.yearlyPriceCents)}
              onChange={(event) => setForm({ ...form, yearlyPriceCents: Number(event.target.value) })}
              min={0}
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <Label>Max devices</Label>
            <Input
              type="number"
              value={String(form.maxDevices)}
              onChange={(event) => setForm({ ...form, maxDevices: Number(event.target.value) })}
              min={1}
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <Label>Max streams</Label>
            <Input
              type="number"
              value={String(form.maxStreams)}
              onChange={(event) => setForm({ ...form, maxStreams: Number(event.target.value) })}
              min={1}
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <Label>Trial days</Label>
            <Input
              type="number"
              value={String(form.trialDays)}
              onChange={(event) => setForm({ ...form, trialDays: Number(event.target.value) })}
              min={0}
              required
            />
          </label>

          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            Active (offered for new signups)
          </label>

          <div className="md:col-span-2">
            <Label>Features</Label>
            <div className="mt-2 flex flex-wrap gap-3">
              {PLAN_FEATURES.map((feature) => (
                <label key={feature} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.features.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                  />
                  {feature}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save changes"}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
