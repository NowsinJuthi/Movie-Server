"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminMetricGrid, AdminStatCard } from "@/components/admin/admin-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { licenseApi } from "@/lib/license-api";
import { LicenseContactPanel } from "@/components/license/license-contact-panel";
import { cn } from "@/lib/utils";

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
      description="Activate a signed license key for this AmarPin install. Without a key the full product stays available for 30 days from first launch."
      error={loadError}
    >
      {!status ? (
        <p className="text-sm text-muted-foreground">Loading license status...</p>
      ) : (
        <>
          <AdminMetricGrid variant="lg4">
            <AdminStatCard label="Mode" value={status.mode} valueClassName={cn("capitalize", status.locked && "text-destructive")} />
            <AdminStatCard
              label="Edition"
              value={status.edition ?? "—"}
              valueClassName={cn("capitalize", status.locked && "text-destructive")}
            />
            <AdminStatCard
              label={status.licensed ? "License expires" : "Trial ends"}
              value={
                status.licensed
                  ? status.licenseExpiresAt
                    ? new Date(status.licenseExpiresAt).toLocaleDateString()
                    : "Lifetime"
                  : new Date(status.trialEndsAt).toLocaleDateString()
              }
              valueClassName={cn("text-base sm:text-2xl", status.locked && "text-destructive")}
            />
            <AdminStatCard
              label={status.licensed ? "Status" : "Trial days left"}
              value={status.licensed ? "Active" : String(status.trialDaysRemaining)}
              valueClassName={status.locked ? "text-destructive" : undefined}
            />
          </AdminMetricGrid>

          <div className="admin-card">
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

          <div className="admin-grid-1-lg-2">
            <form
              className="admin-card flex h-full flex-col space-y-4"
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
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="licenseKey">License key</Label>
                <Input id="licenseKey" {...form.register("licenseKey")} placeholder="CV1…" autoComplete="off" />
                {form.formState.errors.licenseKey ? (
                  <p className="text-sm text-destructive">{form.formState.errors.licenseKey.message}</p>
                ) : null}
              </div>
              {formError ? <Alert>{formError}</Alert> : null}
              {formSuccess ? <Alert>{formSuccess}</Alert> : null}
              <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto">
                {mutation.isPending ? "Activating..." : "Activate"}
              </Button>
            </form>

            <div className="h-full min-h-full [&_aside]:h-full">
              <LicenseContactPanel />
            </div>
          </div>
        </>
      )}
    </AdminPage>
  );
}
