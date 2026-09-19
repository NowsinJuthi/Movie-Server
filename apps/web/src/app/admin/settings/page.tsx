"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import type { AdminSiteSettings } from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { brandingAssetSrc, settingsApi } from "@/lib/settings-api";

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [siteName, setSiteName] = useState("");
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [testTo, setTestTo] = useState("");

  const query = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await settingsApi.get()).settings,
  });

  useEffect(() => {
    if (!query.data) return;
    applySettings(query.data);
  }, [query.data]);

  function applySettings(settings: AdminSiteSettings) {
    setSiteName(settings.siteName);
    setSmtpEnabled(settings.smtp.enabled);
    setSmtpHost(settings.smtp.host);
    setSmtpPort(settings.smtp.port);
    setSmtpSecure(settings.smtp.secure);
    setSmtpUser(settings.smtp.user);
    setSmtpPassword("");
    setFromName(settings.smtp.fromName);
    setFromEmail(settings.smtp.fromEmail);
  }

  function smtpSettingsInput(enabled = smtpEnabled) {
    return {
      smtp: {
        enabled,
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser,
        password: smtpPassword || undefined,
        fromName,
        fromEmail,
      },
    };
  }

  const saveBrandingMutation = useMutation({
    mutationFn: () => settingsApi.update({ siteName }),
    onSuccess: async (data) => {
      setError(null);
      setSuccess("Branding settings saved.");
      applySettings(data.settings);
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["public-branding"] });
    },
    onError: (err: unknown) => {
      setSuccess(null);
      setError(err instanceof ApiError ? err.message : "Unable to save branding settings.");
    },
  });

  const saveSmtpMutation = useMutation({
    mutationFn: () => settingsApi.update(smtpSettingsInput()),
    onSuccess: async (data) => {
      setError(null);
      setSuccess("SMTP settings saved.");
      applySettings(data.settings);
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (err: unknown) => {
      setSuccess(null);
      setError(err instanceof ApiError ? err.message : "Unable to save SMTP settings.");
    },
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => settingsApi.uploadLogo(file),
    onSuccess: async (data) => {
      setError(null);
      setSuccess("Logo updated.");
      applySettings(data.settings);
      await queryClient.invalidateQueries({ queryKey: ["public-branding"] });
    },
    onError: (err: unknown) => {
      setSuccess(null);
      setError(err instanceof ApiError ? err.message : "Logo upload failed.");
    },
  });

  const faviconMutation = useMutation({
    mutationFn: (file: File) => settingsApi.uploadFavicon(file),
    onSuccess: async (data) => {
      setError(null);
      setSuccess("Favicon updated.");
      applySettings(data.settings);
      await queryClient.invalidateQueries({ queryKey: ["public-branding"] });
    },
    onError: (err: unknown) => {
      setSuccess(null);
      setError(err instanceof ApiError ? err.message : "Favicon upload failed.");
    },
  });

  const clearLogoMutation = useMutation({
    mutationFn: () => settingsApi.clearLogo(),
    onSuccess: async (data) => {
      setSuccess("Logo removed.");
      applySettings(data.settings);
      await queryClient.invalidateQueries({ queryKey: ["public-branding"] });
    },
  });

  const clearFaviconMutation = useMutation({
    mutationFn: () => settingsApi.clearFavicon(),
    onSuccess: async (data) => {
      setSuccess("Favicon removed.");
      applySettings(data.settings);
      await queryClient.invalidateQueries({ queryKey: ["public-branding"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      // Testing the values currently visible in the form must not depend on a
      // separate Save click. Persist them first so mail workers use the same
      // encrypted MongoDB configuration immediately.
      const saved = await settingsApi.update(smtpSettingsInput(true));
      const result = await settingsApi.testSmtp(testTo.trim());
      return { result, settings: saved.settings };
    },
    onSuccess: async ({ result, settings }) => {
      applySettings(settings);
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      if (result.ok) {
        setError(null);
        setSuccess(result.message);
      } else {
        setSuccess(null);
        setError(`SMTP settings were saved, but the test failed: ${result.message}`);
      }
    },
    onError: (err: unknown) => {
      setSuccess(null);
      setError(err instanceof ApiError ? err.message : "SMTP test failed.");
    },
  });

  const settings = query.data;
  const loadError = query.error instanceof ApiError ? query.error.message : null;
  const bust = settings?.siteName;

  return (
    <AdminPage
      title="System settings"
      description="Configure website branding and SMTP email delivery. SMTP password is encrypted at rest and never shown again."
      error={loadError}
    >
      {!settings ? (
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      ) : (
        <div className="space-y-6">
          <Link
            href="/admin/settings/roles"
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-4 py-3 transition hover:border-primary/35 hover:bg-primary/5"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <Shield className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">Roles & permissions</span>
                <span className="block text-xs text-muted-foreground">
                  Configure staff access to movies, billing, libraries, and settings.
                </span>
              </span>
            </span>
            <span className="text-xs font-medium text-primary">Manage →</span>
          </Link>

          {error ? <Alert>{error}</Alert> : null}
          {success ? (
            <Alert className="border-emerald-500/40 text-emerald-300">{success}</Alert>
          ) : null}

          <div className="admin-grid-1-lg-2">
            <section className="admin-card flex h-full flex-col space-y-4">
              <div>
                <h2 className="text-base font-semibold">Website branding</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Site name appears in the header, admin panel, browser title, and email subjects.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="siteName">Website name</Label>
                <Input
                  id="siteName"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  maxLength={80}
                />
              </div>

              <div className="grid flex-1 grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-3 rounded-lg border border-border/70 p-4">
                  <p className="text-sm font-medium">Logo</p>
                  {settings.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brandingAssetSrc(settings.logoUrl, bust) ?? undefined}
                      alt="Logo preview"
                      className="h-12 w-auto max-w-full object-contain"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">No logo uploaded</p>
                  )}
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) logoMutation.mutate(file);
                      e.target.value = "";
                    }}
                  />
                  {settings.logoUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={clearLogoMutation.isPending}
                      onClick={() => clearLogoMutation.mutate()}
                    >
                      Remove logo
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-3 rounded-lg border border-border/70 p-4">
                  <p className="text-sm font-medium">Favicon</p>
                  {settings.faviconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brandingAssetSrc(settings.faviconUrl, bust) ?? undefined}
                      alt="Favicon preview"
                      className="h-10 w-10 object-contain"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">No favicon uploaded</p>
                  )}
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon,.ico"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) faviconMutation.mutate(file);
                      e.target.value = "";
                    }}
                  />
                  {settings.faviconUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={clearFaviconMutation.isPending}
                      onClick={() => clearFaviconMutation.mutate()}
                    >
                      Remove favicon
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mt-auto border-t border-border/60 pt-4">
                <Button
                  type="button"
                  disabled={saveBrandingMutation.isPending}
                  onClick={() => {
                    setSuccess(null);
                    saveBrandingMutation.mutate();
                  }}
                >
                  {saveBrandingMutation.isPending ? "Saving..." : "Save branding"}
                </Button>
              </div>
            </section>

            <section className="admin-card flex h-full flex-col space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Email / SMTP</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Used for verification and password-reset emails. Settings are saved in MongoDB;
                    the password is encrypted and never returned to the browser.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    settings.smtpReady
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-200"
                  }`}
                >
                  {settings.smtpReady
                    ? `Ready (${settings.source.smtp})`
                    : "Not configured"}
                </span>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={smtpEnabled}
                  onChange={(e) => setSmtpEnabled(e.target.checked)}
                />
                Use SMTP settings from this panel
              </label>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="smtpHost">SMTP host</Label>
                  <Input
                    id="smtpHost"
                    placeholder="smtp.gmail.com"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">Port</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value) || 587)}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={smtpSecure}
                      onChange={(e) => setSmtpSecure(e.target.checked)}
                    />
                    Secure (TLS / port 465)
                  </label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpUser">Username</Label>
                  <Input
                    id="smtpUser"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">
                    Password {settings.smtp.passwordSet ? "(saved — leave blank to keep)" : ""}
                  </Label>
                  <Input
                    id="smtpPassword"
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={settings.smtp.passwordSet ? "••••••••" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fromName">From name</Label>
                  <Input
                    id="fromName"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    placeholder={siteName || "AmarPin"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fromEmail">From email</Label>
                  <Input
                    id="fromEmail"
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="noreply@yourdomain.com"
                  />
                </div>
              </div>

              <div className="mt-auto space-y-4 border-t border-border/60 pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="testTo">Send test email to</Label>
                    <Input
                      id="testTo"
                      type="email"
                      value={testTo}
                      onChange={(e) => setTestTo(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={testMutation.isPending || !testTo.trim()}
                    onClick={() => testMutation.mutate()}
                  >
                    {testMutation.isPending ? "Saving & sending..." : "Save & send test"}
                  </Button>
                </div>
                <Button
                  type="button"
                  disabled={saveSmtpMutation.isPending}
                  onClick={() => {
                    setSuccess(null);
                    saveSmtpMutation.mutate();
                  }}
                >
                  {saveSmtpMutation.isPending ? "Saving..." : "Save SMTP"}
                </Button>
              </div>
            </section>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
