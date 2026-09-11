"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminPage } from "@/components/admin/admin-page";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { licenseApi } from "@/lib/license-api";
import { LicenseContactPanel } from "@/components/license/license-contact-panel";

const schema = z.object({
  licenseKey: z.string().min(20, "Paste a full CV1… license key."),
});

type FormValues = z.infer<typeof schema>;

export default function AdminLicensePage() {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { licenseKey: "" },
  });

  const statusQuery = useQuery({
    queryKey: ["license-status"],
    queryFn: licenseApi.status,
    refetchInterval: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => licenseApi.activate(values.licenseKey.trim()),
    onSuccess: async (data) => {
      setFormError(null);
      setFormSuccess(data.status.message || "License activated.");
      form.reset({ licenseKey: "" });
      await queryClient.invalidateQueries({ queryKey: ["license-status"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error: unknown) => {
      setFormSuccess(null);
      setFormError(error instanceof ApiError ? error.message : "Unable to activate license.");
    },
  });

  const status = statusQuery.data;
  const loadError = statusQuery.error instanceof ApiError ? statusQuery.error.message : null;

  return (
    <AdminPage
      title="License"
      description="Activate a signed license key for this CineVault install. Without a key the full product stays available for 30 days from first launch."
      error={loadError}
    >
      {!status ? (
        <p className="text-sm text-muted-foreground">Loading license status...</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatusCard label="Mode" value={status.mode} ok={!status.locked} />
            <StatusCard
              label="Edition"
              value={status.edition ?? "—"}
              ok={!status.locked}
            />
            <StatusCard
              label={status.licensed ? "License expires" : "Trial ends"}
              value={
                status.licensed
                  ? status.licenseExpiresAt
                    ? new Date(status.licenseExpiresAt).toLocaleDateString()
                    : "Lifetime"
                  : new Date(status.trialEndsAt).toLocaleDateString()
              }
              ok={!status.locked}
            />
            <StatusCard
              label={status.licensed ? "Status" : "Trial days left"}
              value={
                status.licensed
                  ? "Active"
                  : String(status.trialDaysRemaining)
              }
              ok={!status.locked}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{status.message}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Install ID: <span className="font-mono text-foreground">{status.installId}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Installed: {new Date(status.installedAt).toLocaleString()}
              {status.activatedAt
                ? ` · Activated: ${new Date(status.activatedAt).toLocaleString()}`
                : ""}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
            <form
              className="flex h-full flex-col space-y-4 rounded-xl border border-border bg-card p-5"
              onSubmit={form.handleSubmit((values) => {
                setFormError(null);
                setFormSuccess(null);
                mutation.mutate(values);
              })}
            >
              <div>
                <h2 className="text-base font-semibold">Activate license key</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Paste the key from your vendor (starts with <code className="text-xs">CV1.</code>).
                  Keys are verified on the API with HMAC — they cannot be forged from the browser.
                </p>
              </div>
              {formError ? <Alert>{formError}</Alert> : null}
              {formSuccess ? (
                <Alert className="border-emerald-500/40 text-emerald-300">{formSuccess}</Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="licenseKey">License key</Label>
                <Input
                  id="licenseKey"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="CV1...."
                  className="font-mono text-sm"
                  {...form.register("licenseKey")}
                />
                {form.formState.errors.licenseKey ? (
                  <p className="text-xs text-destructive">{form.formState.errors.licenseKey.message}</p>
                ) : null}
              </div>
              <Button type="submit" className="mt-auto w-fit" disabled={mutation.isPending}>
                {mutation.isPending ? "Activating..." : "Activate license"}
              </Button>
            </form>

            <div className="h-full min-h-full [&_aside]:h-full">
              <LicenseContactPanel />
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}

function StatusCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-xl font-semibold capitalize ${ok ? "" : "text-destructive"}`}>{value}</p>
    </div>
  );
}
