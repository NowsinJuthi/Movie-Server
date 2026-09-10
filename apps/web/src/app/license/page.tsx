"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { ApiError } from "@/lib/api";
import { licenseApi } from "@/lib/license-api";
import { LicenseContactPanel } from "@/components/license/license-contact-panel";
import { useBranding } from "@/components/branding/site-brand";
import { brandingAssetSrc } from "@/lib/settings-api";
import styles from "@/components/license/license-page.module.css";

const schema = z.object({
  licenseKey: z.string().min(20, "Enter a valid license key."),
});

type FormValues = z.infer<typeof schema>;

export default function LicensePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { siteName, logoUrl } = useBranding();
  const logoSrc = brandingAssetSrc(logoUrl);
  const [formError, setFormError] = useState<string | null>(null);
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
      await queryClient.invalidateQueries({ queryKey: ["license-status"] });
      if (data.status.ok) {
        router.replace("/");
        router.refresh();
      }
    },
    onError: (error: unknown) => {
      setFormError(error instanceof ApiError ? error.message : "Unable to activate license.");
    },
  });

  const status = statusQuery.data;
  const locked = status?.locked === true;
  const trial = status?.trial === true && !status.licensed;
  const title = locked ? "License required" : trial ? "Trial active" : "Product license";
  const description = locked
    ? `Your free trial has ended. Activate a license key to unlock ${siteName}.`
    : status?.message || `View trial status or activate a license key for ${siteName}.`;

  const kickerClass = locked
    ? `${styles.kicker} ${styles.kickerLocked}`
    : trial
      ? `${styles.kicker} ${styles.kickerTrial}`
      : styles.kicker;

  const iconClass = locked
    ? `${styles.heroIcon} ${styles.heroIconLocked}`
    : trial
      ? `${styles.heroIcon} ${styles.heroIconTrial}`
      : styles.heroIcon;

  return (
    <main className={styles.page}>
      <div className={`${styles.glow} ${styles.glowA}`} aria-hidden />
      <div className={`${styles.glow} ${styles.glowB}`} aria-hidden />

      <div className={styles.inner}>
        <header className={styles.topbar}>
          <Link href="/" className={styles.brand}>
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={siteName} className={styles.brandLogo} />
            ) : (
              <>
                <span className={styles.brandMark} aria-hidden>
                  <ShieldCheck />
                </span>
                <span className={styles.brandName}>{siteName}</span>
              </>
            )}
          </Link>
        </header>

        <div className={styles.grid}>
          <section className={styles.hero}>
            {statusQuery.isError ? (
              <div className={styles.alert}>
                {statusQuery.error instanceof ApiError
                  ? statusQuery.error.message
                  : "Unable to load license status."}
              </div>
            ) : null}

            {!status && !statusQuery.isError ? <div className={styles.skeleton} /> : null}

            {status ? (
              <>
                <div className={styles.heroHead}>
                  <div className={iconClass} aria-hidden>
                    {locked ? <Lock /> : trial ? <KeyRound /> : <ShieldCheck />}
                  </div>
                  <div>
                    <p className={kickerClass}>{status.mode}</p>
                    <h1 className={styles.title}>{title}</h1>
                    <p className={styles.subtitle}>{description}</p>
                  </div>
                </div>

                <div className={styles.metrics}>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Edition</span>
                    <span className={styles.metricValue}>{status.edition ?? "—"}</span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>
                      {status.licensed ? "Expires" : "Trial ends"}
                    </span>
                    <span className={styles.metricValue}>
                      {status.licensed
                        ? status.licenseExpiresAt
                          ? new Date(status.licenseExpiresAt).toLocaleDateString()
                          : "Lifetime"
                        : new Date(status.trialEndsAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>
                      {status.licensed ? "Status" : "Days left"}
                    </span>
                    <span className={styles.metricValue}>
                      {status.licensed ? "Active" : status.trialDaysRemaining}
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Access</span>
                    <span className={styles.metricValue}>
                      {status.ok ? "Unlocked" : "Locked"}
                    </span>
                  </div>
                </div>

                <p className={styles.installId}>Install ID · {status.installId}</p>
              </>
            ) : null}

            <form
              className={styles.activate}
              onSubmit={form.handleSubmit((values) => {
                setFormError(null);
                mutation.mutate(values);
              })}
            >
              <div className={styles.activateHead}>
                <h2 className={styles.activateTitle}>Activate license key</h2>
                <p className={styles.activateHint}>
                  Paste your signed key (starts with <code>CV1.</code>). Verification happens on
                  the server — keys cannot be forged in the browser.
                </p>
              </div>

              {formError ? <div className={styles.alert}>{formError}</div> : null}

              <div className={styles.field}>
                <label className={styles.label} htmlFor="licenseKey">
                  License key
                </label>
                <input
                  id="licenseKey"
                  className={styles.input}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="CV1.••••••••.••••••••"
                  {...form.register("licenseKey")}
                />
                {form.formState.errors.licenseKey ? (
                  <p className={styles.fieldError}>{form.formState.errors.licenseKey.message}</p>
                ) : null}
              </div>

              <button className={styles.submit} type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Activating..." : "Activate license"}
              </button>
            </form>
          </section>

          <aside className={styles.side}>
            <LicenseContactPanel />
            <div className={styles.note}>
              <h3 className={styles.noteTitle}>Already have a key?</h3>
              <p className={styles.noteBody}>
                After activation the full product unlocks immediately. Keep your install ID handy
                if you contact support about renewals.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
