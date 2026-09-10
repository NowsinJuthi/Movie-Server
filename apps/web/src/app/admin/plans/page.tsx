"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PLAN_FEATURES, PLAN_TIERS, VIDEO_QUALITIES } from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { formatCents, subscriptionApi } from "@/lib/subscription-api";

export default function AdminPlansPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pendingDisable, setPendingDisable] = useState<string | null>(null);
  const [form, setForm] = useState({
    slug: "",
    name: "",
    description: "Custom plan",
    tier: "standard",
    monthlyPriceCents: 1299,
    yearlyPriceCents: 12999,
    maxVideoQuality: "hd",
    maxDevices: 2,
    maxStreams: 2,
    trialDays: 0,
    features: ["catalog", "hd"],
  });

  const query = useQuery({
    queryKey: ["admin-plans"],
    queryFn: subscriptionApi.adminPlans,
  });

  const create = useMutation({
    mutationFn: () =>
      subscriptionApi.createPlan({
        ...form,
        monthlyPriceCents: Number(form.monthlyPriceCents),
        yearlyPriceCents: Number(form.yearlyPriceCents),
        maxDevices: Number(form.maxDevices),
        maxStreams: Number(form.maxStreams),
        trialDays: Number(form.trialDays),
      }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Unable to create plan.");
    },
  });

  const disable = useMutation({
    mutationFn: (id: string) => subscriptionApi.disablePlan(id),
    onSuccess: async () => {
      setPendingDisable(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
    },
  });

  const toggleFeature = (feature: string) => {
    setForm((current) => ({
      ...current,
      features: current.features.includes(feature)
        ? current.features.filter((item) => item !== feature)
        : [...current.features, feature],
    }));
  };

  return (
    <AdminPage
      title="Subscription plans"
      description="Admin-only plan catalog. Prices are stored in cents. Disabling a plan blocks new signups."
      error={error ?? (disable.error instanceof ApiError ? disable.error.message : null)}
    >
      <div className="space-y-8">
        <form
          className="grid gap-4 rounded-xl border border-border bg-card p-6 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Slug" value={form.slug} onChange={(value) => setForm({ ...form, slug: value })} />
          <Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
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
          <Field
            label="Monthly price (cents)"
            type="number"
            value={String(form.monthlyPriceCents)}
            onChange={(value) => setForm({ ...form, monthlyPriceCents: Number(value) })}
          />
          <Field
            label="Yearly price (cents)"
            type="number"
            value={String(form.yearlyPriceCents)}
            onChange={(value) => setForm({ ...form, yearlyPriceCents: Number(value) })}
          />
          <Field
            label="Max devices"
            type="number"
            value={String(form.maxDevices)}
            onChange={(value) => setForm({ ...form, maxDevices: Number(value) })}
          />
          <Field
            label="Max streams"
            type="number"
            value={String(form.maxStreams)}
            onChange={(value) => setForm({ ...form, maxStreams: Number(value) })}
          />
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
          <div className="md:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              Create plan
            </Button>
          </div>
        </form>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Limits</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(query.data?.plans ?? []).map((plan) => (
                <tr key={plan.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{plan.name}</div>
                    <div className="text-muted-foreground">{plan.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    {formatCents(plan.monthlyPriceCents, plan.currency)} / mo
                  </td>
                  <td className="px-4 py-3">
                    {plan.maxVideoQuality.toUpperCase()} · {plan.maxStreams} streams · {plan.maxDevices} devices
                  </td>
                  <td className="px-4 py-3">{plan.isActive ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    {plan.isActive ? (
                      <Button variant="outline" size="sm" onClick={() => setPendingDisable(plan.id)}>
                        Disable
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ConfirmDialog
          open={Boolean(pendingDisable)}
          title="Disable this plan?"
          description="Existing subscribers keep access. The plan will no longer be offered for new signups."
          confirmLabel="Disable"
          pending={disable.isPending}
          onClose={() => setPendingDisable(null)}
          onConfirm={() => pendingDisable && disable.mutate(pendingDisable)}
        />
      </div>
    </AdminPage>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-2 text-sm">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
