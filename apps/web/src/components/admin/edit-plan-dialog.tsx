"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  PLAN_FEATURE_LABELS,
  PLAN_FEATURES,
  PLAN_TIERS,
  VIDEO_QUALITIES,
  buildPlanFeatureLines,
  defaultPlanFeatureLines,
  featureBulletsFromText,
  featureBulletsToText,
  type PlanFeature,
  type PublicPlan,
  type VideoQuality,
} from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function majorUnitsFromCents(cents: number): number {
  return cents / 100;
}

function centsFromMajorUnits(amount: number): number {
  return Math.round(amount * 100);
}

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
  featureBullets: string[];
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
  type PlanFormState = Omit<EditPlanFormValues, "monthlyPriceCents" | "yearlyPriceCents" | "featureBullets"> & {
    monthlyPrice: number;
    yearlyPrice: number;
    useCustomFeatureBullets: boolean;
    featureBulletsText: string;
  };

  function planLineInput(state: PlanFormState) {
    return {
      maxVideoQuality: state.maxVideoQuality as VideoQuality,
      maxStreams: state.maxStreams,
      maxDevices: state.maxDevices,
      features: state.features as PlanFeature[],
    };
  }

  const [form, setForm] = useState<PlanFormState | null>(null);

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
        monthlyPrice: majorUnitsFromCents(plan.monthlyPriceCents),
        yearlyPrice: majorUnitsFromCents(plan.yearlyPriceCents),
        maxVideoQuality: plan.maxVideoQuality,
        maxDevices: plan.maxDevices,
        maxStreams: plan.maxStreams,
        trialDays: plan.trialDays,
        sortOrder: plan.sortOrder,
        features: [...plan.features],
        isActive: plan.isActive,
        useCustomFeatureBullets: (plan.featureBullets?.length ?? 0) > 0,
        featureBulletsText:
          (plan.featureBullets?.length ?? 0) > 0
            ? featureBulletsToText(plan.featureBullets)
            : defaultPlanFeatureLines({
                maxVideoQuality: plan.maxVideoQuality,
                maxStreams: plan.maxStreams,
                maxDevices: plan.maxDevices,
                features: plan.features,
              }).join("\n"),
      });
    }
  }, [open, plan]);

  const subscriptionFeaturePreview = useMemo(() => {
    if (!form) return [];
    if (form.useCustomFeatureBullets) {
      return buildPlanFeatureLines({
        ...planLineInput(form),
        featureBullets: featureBulletsFromText(form.featureBulletsText),
      });
    }
    return defaultPlanFeatureLines(planLineInput(form));
  }, [form]);

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
            onSubmit({
              ...form,
              monthlyPriceCents: centsFromMajorUnits(form.monthlyPrice),
              yearlyPriceCents: centsFromMajorUnits(form.yearlyPrice),
              featureBullets: form.useCustomFeatureBullets
                ? featureBulletsFromText(form.featureBulletsText)
                : [],
            });
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
            <Label>Monthly price ({form.currency || "BDT"})</Label>
            <Input
              type="number"
              value={String(form.monthlyPrice)}
              onChange={(event) => setForm({ ...form, monthlyPrice: Number(event.target.value) })}
              min={0}
              step={form.currency === "BDT" ? 1 : 0.01}
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <Label>Yearly price ({form.currency || "BDT"})</Label>
            <Input
              type="number"
              value={String(form.yearlyPrice)}
              onChange={(event) => setForm({ ...form, yearlyPrice: Number(event.target.value) })}
              min={0}
              step={form.currency === "BDT" ? 1 : 0.01}
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
            <Label>Entitlements</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Controls API access (quality, downloads, etc.). Used to build the subscription card list when custom
              bullets are off.
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {PLAN_FEATURES.map((feature) => (
                <label key={feature} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.features.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                  />
                  <span>
                    <span className="font-mono text-xs text-muted-foreground">{feature}</span>
                    <span className="block text-foreground">{PLAN_FEATURE_LABELS[feature as PlanFeature]}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 rounded-lg border border-border bg-muted/30 p-4">
            <Label>Subscription page — All features</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Shown on /account/subscription and /subscribe. One line per row when using a custom list.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.useCustomFeatureBullets}
                onChange={(event) =>
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          useCustomFeatureBullets: event.target.checked,
                          featureBulletsText: event.target.checked
                            ? current.featureBulletsText ||
                              defaultPlanFeatureLines(planLineInput(current)).join("\n")
                            : current.featureBulletsText,
                        }
                      : current,
                  )
                }
              />
              Use custom feature list
            </label>
            {form.useCustomFeatureBullets ? (
              <label className="mt-3 block space-y-2 text-sm">
                <span className="text-muted-foreground">Lines (shown in order)</span>
                <textarea
                  value={form.featureBulletsText}
                  onChange={(event) => setForm({ ...form, featureBulletsText: event.target.value })}
                  rows={10}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm leading-relaxed"
                  placeholder={"Up to UHD video quality\n4 simultaneous streams\n..."}
                />
              </label>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Auto-generated from max quality, devices, streams, and entitlements above.
              </p>
            )}
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Preview</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {subscriptionFeaturePreview.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-primary" aria-hidden>
                      ✓
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            {!form.useCustomFeatureBullets ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() =>
                  setForm({
                    ...form,
                    useCustomFeatureBullets: true,
                    featureBulletsText: defaultPlanFeatureLines(planLineInput(form)).join("\n"),
                  })
                }
              >
                Customize list
              </Button>
            ) : null}
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
