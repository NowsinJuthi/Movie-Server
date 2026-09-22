"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ChevronRight,
  Clapperboard,
  CreditCard,
  Film,
  HardDrive,
  KeyRound,
  Menu,
  MonitorPlay,
  Tv,
  Users,
  Wallet,
} from "lucide-react";
import type { AdminDashboard, AdminServerMetrics, LicenseStatusResponse } from "@movie-server/shared";
import { MovieUploadRequestsDashboardPanel } from "@/components/admin/movie-upload-requests-dashboard-panel";
import styles from "@/components/admin/admin-ui.module.css";
import dash from "@/components/admin/admin-dashboard.module.css";
import {
  BillingSnapshot,
  CatalogBars,
  LibrarySnapshot,
  ServerMetricBar,
  SubscriptionStack,
  UsersActiveRing,
} from "@/components/admin/admin-dashboard-charts";

type LibraryRow = {
  id: string;
  name: string;
  kind: string;
  itemCount: number;
  imageUrl?: string | null;
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 100 || unit === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

type KpiProps = {
  href: string;
  label: string;
  value: number;
  meta: string;
  icon: ReactNode;
  highlight?: boolean;
  badge?: string;
};

function KpiCard({ href, label, value, meta, icon, highlight, badge }: KpiProps) {
  return (
    <Link
      href={href}
      className={`${dash.kpiCard} ${highlight ? dash.kpiCardHighlight : ""}`}
    >
      <div className={dash.kpiTop}>
        <span className={dash.kpiLabel}>{label}</span>
        <span className={dash.kpiIcon}>{icon}</span>
      </div>
      <p className={dash.kpiValue}>{value.toLocaleString()}</p>
      <p className={dash.kpiMeta}>{meta}</p>
      {badge ? <span className={dash.kpiBadge}>{badge}</span> : null}
    </Link>
  );
}

export function AdminDashboardView({
  data,
  libraries,
  license,
  serverMetrics,
  serverMetricsError,
}: {
  data: AdminDashboard;
  libraries: LibraryRow[];
  license: LicenseStatusResponse | undefined;
  serverMetrics: AdminServerMetrics | undefined;
  serverMetricsError: string | null;
}) {
  const uploadBadge =
    data.movieUploadRequests.pending > 0
      ? `${data.movieUploadRequests.pending} pending`
      : data.movieUploadRequests.enabled
        ? "Live in header"
        : "Hidden";

  return (
    <div className={dash.dashboard}>
      <section className={dash.section} aria-labelledby="dash-kpi-heading">
        <div className={dash.sectionHead}>
          <h2 id="dash-kpi-heading" className={dash.sectionTitle}>
            At a glance
          </h2>
          <span className={dash.sectionHint}>Live from MongoDB &amp; Redis</span>
        </div>
        <div className={dash.kpiGridPrimary}>
          <KpiCard
            href="/admin/sessions"
            label="Live sessions"
            value={data.live.sessions}
            meta={`${data.live.streams} streams in use`}
            icon={<MonitorPlay className="h-4 w-4" aria-hidden />}
            highlight
          />
          <KpiCard
            href="/admin/subscriptions"
            label="Active subscriptions"
            value={data.subscriptions.active}
            meta={`${data.subscriptions.trial} trial · ${data.subscriptions.suspended} suspended`}
            icon={<Wallet className="h-4 w-4" aria-hidden />}
            highlight
          />
          <KpiCard
            href="/admin/users"
            label="Users"
            value={data.users.total}
            meta={`${data.users.active} active · ${data.users.admins} admins`}
            icon={<Users className="h-4 w-4" aria-hidden />}
          />
          <KpiCard
            href="/admin/movies"
            label="Movies in catalog"
            value={data.catalog.movies}
            meta={`${data.catalog.series} series · ${data.catalog.episodes} episodes`}
            icon={<Film className="h-4 w-4" aria-hidden />}
          />
        </div>
        <div className={dash.kpiGrid}>
          <KpiCard
            href="/admin/profiles"
            label="Profiles"
            value={data.profiles}
            meta="Viewer profiles across accounts"
            icon={<Users className="h-4 w-4" aria-hidden />}
          />
          <KpiCard
            href="/admin/billing"
            label="Payments"
            value={data.billing.successfulPayments}
            meta={`${data.billing.refunded} refunded`}
            icon={<CreditCard className="h-4 w-4" aria-hidden />}
          />
          <KpiCard
            href="/admin/movie-upload-requests"
            label="Upload requests"
            value={data.movieUploadRequests.pending}
            meta="Member title requests"
            icon={<Clapperboard className="h-4 w-4" aria-hidden />}
            badge={uploadBadge}
          />
          <KpiCard
            href="/admin/jobs"
            label="Library scans"
            value={data.scans.running}
            meta={data.scans.lastStatus ? `Last: ${data.scans.lastStatus}` : "No scans yet"}
            icon={<HardDrive className="h-4 w-4" aria-hidden />}
          />
        </div>
      </section>

      <section className={dash.section} aria-labelledby="dash-analytics-heading">
        <div className={dash.sectionHead}>
          <h2 id="dash-analytics-heading" className={dash.sectionTitle}>
            Analytics
          </h2>
          <span className={dash.sectionHint}>Current totals — no mock trends</span>
        </div>
        <div className={dash.analyticsRow}>
          <article className={dash.card}>
            <h3 className={dash.cardTitle}>Catalog composition</h3>
            <p className={dash.cardDesc}>Relative size of movies, series, and episodes.</p>
            <div className={dash.cardBody}>
              <CatalogBars data={data} />
            </div>
            <div className={dash.cardFooter}>
              <Link href="/admin/movies" className={dash.cardLink}>
                Manage catalog →
              </Link>
            </div>
          </article>
          <article className={dash.card}>
            <h3 className={dash.cardTitle}>Subscriptions</h3>
            <p className={dash.cardDesc}>Share of accounts by billing state.</p>
            <div className={dash.cardBody}>
              <SubscriptionStack data={data} />
            </div>
            <div className={dash.cardFooter}>
              <Link href="/admin/subscriptions" className={dash.cardLink}>
                View subscriptions →
              </Link>
            </div>
          </article>
        </div>
        <div className={`${dash.analyticsRow} ${dash.analyticsRowTriple}`}>
          <article className={dash.card}>
            <h3 className={dash.cardTitle}>User activity</h3>
            <p className={dash.cardDesc}>Active accounts vs total registered users.</p>
            <div className={dash.cardBody}>
              <UsersActiveRing data={data} />
            </div>
          </article>
          <article className={dash.card}>
            <h3 className={dash.cardTitle}>Billing</h3>
            <p className={dash.cardDesc}>Payment and plan snapshot.</p>
            <div className={dash.cardBody}>
              <BillingSnapshot data={data} />
            </div>
            <div className={dash.cardFooter}>
              <Link href="/admin/billing" className={dash.cardLink}>
                Open billing →
              </Link>
            </div>
          </article>
          <article className={dash.card}>
            <h3 className={dash.cardTitle}>Libraries &amp; scans</h3>
            <p className={dash.cardDesc}>Import health and background jobs.</p>
            <div className={dash.cardBody}>
              <LibrarySnapshot data={data} />
            </div>
            <div className={dash.cardFooter}>
              <Link href="/admin/libraries" className={dash.cardLink}>
                Media libraries →
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className={dash.card} aria-live="polite">
        <div className={dash.sectionHead}>
          <div>
            <p className={styles.panelEyebrow}>
              <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Server
            </p>
            <h3 className={dash.cardTitle}>CPU, memory &amp; storage</h3>
            <p className={dash.cardDesc}>Refreshes every few seconds from the API host.</p>
          </div>
        </div>
        {serverMetricsError ? <p className="mt-3 text-sm text-destructive">{serverMetricsError}</p> : null}
        {!serverMetrics && !serverMetricsError ? (
          <p className={`${dash.loading} mt-3`}>Reading server metrics…</p>
        ) : null}
        {serverMetrics ? (
          <div className={`${dash.serverGrid} ${dash.cardBody}`}>
            <ServerMetricBar
              label="CPU"
              percent={serverMetrics.cpu.usagePercent}
              detail={`${serverMetrics.cpu.cores} cores · load ${serverMetrics.cpu.loadAverage.map((v) => v.toFixed(2)).join(" / ")}`}
            />
            <ServerMetricBar
              label="Memory"
              percent={serverMetrics.memory.usedPercent}
              detail={`${formatBytes(serverMetrics.memory.usedBytes)} / ${formatBytes(serverMetrics.memory.totalBytes)}`}
            />
            {serverMetrics.storage ? (
              <ServerMetricBar
                label="Storage"
                percent={serverMetrics.storage.usedPercent}
                detail={`${formatBytes(serverMetrics.storage.usedBytes)} / ${formatBytes(serverMetrics.storage.totalBytes)} · ${serverMetrics.storage.path}`}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Storage metrics unavailable on this host.</p>
            )}
          </div>
        ) : null}
      </section>

      <section className={dash.section} aria-labelledby="dash-actions-heading">
        <div className={dash.sectionHead}>
          <h2 id="dash-actions-heading" className={dash.sectionTitle}>
            Quick actions
          </h2>
        </div>
        <div className={dash.management}>
          <MovieUploadRequestsDashboardPanel movieUploadRequests={data.movieUploadRequests} />

          <Link href="/admin/slider" className={`${dash.managementPanel} ${dash.managementPanelInteractive}`}>
            <div className={styles.panelHead}>
              <div className="min-w-0 flex-1">
                <p className={styles.panelEyebrow}>
                  <Film className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Discovery
                </p>
                <h2 className={styles.panelTitle}>Home slider</h2>
                <p className={styles.panelDesc}>Choose up to 6 movies for the home page hero slider.</p>
              </div>
              <span className={styles.panelAction}>
                Open slider
                <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden />
              </span>
            </div>
          </Link>

          <section className={dash.managementPanel}>
            <div className={styles.panelHead}>
              <div className="min-w-0 flex-1">
                <p className={styles.panelEyebrow}>
                  <Menu className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Menu
                </p>
                <h2 className={styles.panelTitle}>Media library menus</h2>
                <p className={styles.panelDesc}>Each enabled library name shows here as a menu item.</p>
              </div>
              <Link href="/admin/menu" className={styles.panelAction}>
                Open menu
                <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className={styles.panelBody}>
              {libraries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No libraries yet.{" "}
                  <Link href="/admin/libraries" className="text-primary underline-offset-4 hover:underline">
                    Add a media library
                  </Link>{" "}
                  and its name will appear in Menu.
                </p>
              ) : (
                <div className={styles.libraryGrid}>
                  {libraries.map((library) => {
                    const Icon = library.kind === "tv" ? Tv : Film;
                    return (
                      <Link key={library.id} href={`/admin/menu/${library.id}`} className={styles.libraryTile}>
                        <span className={styles.libraryIcon}>
                          {library.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={library.imageUrl} alt="" className="h-full w-full rounded-md object-cover" />
                          ) : (
                            <Icon className="h-4 w-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={styles.libraryName}>{library.name}</span>
                          <span className={styles.libraryMeta}>
                            {library.kind} · {library.itemCount} items
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {license ? (
            <Link
              href="/admin/license"
              className={`${dash.managementPanel} ${dash.managementPanelInteractive} ${license.locked ? styles.panelLicenseLocked : ""}`}
            >
              <div className={styles.panelHead}>
                <div className="min-w-0 flex-1">
                  <p className={styles.panelEyebrow}>
                    <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Product license
                  </p>
                  <p className={`${styles.panelTitle} capitalize`}>
                    {license.mode}
                    {license.edition ? ` · ${license.edition}` : ""}
                  </p>
                  <p className={styles.panelDesc}>{license.message}</p>
                </div>
                <span className={styles.panelAction}>
                  Manage
                  <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden />
                </span>
              </div>
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
