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
import {
  isSupportedLicenseKeyFormat,
  LICENSE_KEY_FORMAT_HINT,
  normalizeLicenseKeyInput,
} from "@movie-server/shared";
import { ApiError } from "@/lib/api";
import { licenseApi } from "@/lib/license-api";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { LicenseContactPanel } from "@/components/license/license-contact-panel";
import { cn } from "@/lib/utils";

const schema = z.object({
  licenseKey: z
    .string()
    .min(1, "Enter a license key.")
    .transform(normalizeLicenseKeyInput)
    .pipe(
      z
        .string()
        .min(12, "Enter your full license key.")
        .refine((value) => isSupportedLicenseKeyFormat(value), {
          message: LICENSE_KEY_FORMAT_HINT,
        }),
    ),
});

type FormValues = z.infer<typeof schema>;

export default function AdminLicensePage() {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { licenseKey: "" },
  });

  const statusQuery = useQuery({
    queryKey: ["license-status"],
    queryFn: licenseApi.status,
    refetchInterval: 60_000,
  });

  const activateMutation = useMutation({
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

  const deactivateMutation = useMutation({
    mutationFn: () => licenseApi.deactivate(),
    onSuccess: async (data) => {
      setDeactivateOpen(false);
      setFormError(null);
      setFormSuccess(data.status.message || "License deactivated.");
      form.reset({ licenseKey: "" });
      await queryClient.invalidateQueries({ queryKey: ["license-status"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error: unknown) => {
      setFormSuccess(null);
      setFormError(error instanceof ApiError ? error.message : "Unable to deactivate license.");
    },
  });

  const status = statusQuery.data;
  const canDeactivate = status?.canDeactivate === true;
  const licenseBusy = activateMutation.isPending || deactivateMutation.isPending;
  const loadError = statusQuery.error instanceof ApiError ? statusQuery.error.message : null;

  return (
    <AdminPage
      title="License"
      description="Activate a signed license key for this AmarPin install. Without a key the full product stays available for 90 days from first launch."
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
                if (canDeactivate) {
                  return;
                }
                setFormError(null);
                setFormSuccess(null);
                activateMutation.mutate(values);
              })}
            >
              <div>
                <h2 className="text-base font-semibold">
                  {canDeactivate ? "License active" : "Activate license key"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {canDeactivate
                    ? "This install is licensed. Deactivate to lock the site until you enter a key again."
                    : "Paste your license.amarpin.com key (AMP-…). Works on any domain."}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="licenseKey">License key</Label>
                <Input
                  id="licenseKey"
                  {...form.register("licenseKey")}
                  placeholder="AMP-PRO-… or CV1.…"
                  autoComplete="off"
                  disabled={canDeactivate || licenseBusy}
                />
                {form.formState.errors.licenseKey ? (
                  <p className="text-sm text-destructive">{form.formState.errors.licenseKey.message}</p>
                ) : null}
              </div>
              {formError ? <Alert>{formError}</Alert> : null}
              {formSuccess ? <Alert>{formSuccess}</Alert> : null}
              {canDeactivate ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={licenseBusy}
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setFormError(null);
                    setFormSuccess(null);
                    setDeactivateOpen(true);
                  }}
                >
                  Deactivate license
                </Button>
              ) : (
                <Button type="submit" disabled={licenseBusy} className="w-full sm:w-auto">
                  {activateMutation.isPending ? "Activating..." : "Activate license"}
                </Button>
              )}
            </form>

            <div className="h-full min-h-full [&_aside]:h-full">
              <LicenseContactPanel />
            </div>
          </div>

          <ConfirmDialog
            open={deactivateOpen}
            variant="destructive"
            title="Deactivate license on this server?"
            description="This install will no longer be licensed. You can activate again anytime with a valid key."
            bullets={[
              "Public access locks until a new license key is activated.",
              "Admin users can still sign in to enter a key on the License page.",
              "license.amarpin.com keys release this installation slot for reuse.",
            ]}
            confirmLabel="Deactivate license"
            pending={deactivateMutation.isPending}
            onClose={() => setDeactivateOpen(false)}
            onConfirm={() => {
              setFormError(null);
              setFormSuccess(null);
              deactivateMutation.mutate();
            }}
          />
        </>
      )}
    </AdminPage>
  );
}
