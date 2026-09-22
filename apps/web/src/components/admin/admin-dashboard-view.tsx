"use client";

import Link from "next/link";
import {
  Activity,
  ChevronRight,
  Film,
  KeyRound,
  Menu,
  MessageSquarePlus,
  Tv,
  Users,
} from "lucide-react";
import type { AdminDashboard } from "@movie-server/shared";
import type { AdminServerMetrics } from "@movie-server/shared";
import type { LicenseStatusResponse } from "@movie-server/shared";
import { MovieUploadRequestsDashboardPanel } from "@/components/admin/movie-upload-requests-dashboard-panel";
import styles from "@/components/admin/admin-ui.module.css";
import dash from "@/components/admin/admin-dashboard.module.css";
import {
  CatalogCompareChart,
  CatalogDonutChart,
  KeyMetricsBarChart,
  MetricRing,
  SubscriptionAreaChart,
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

function userActivePercent(data: AdminDashboard): string {
  if (data.users.total <= 0) return "—";
  return `${Math.round((data.users.active / data.users.total) * 100)}%`;
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
  return (
    <div className={dash.dashboard}>
      <div className={dash.heroRow}>
        <Link href="/admin/sessions" className={`${dash.heroCard} ${dash.heroCardA}`}>
          <p className={dash.heroLabel}>Live sessions</p>
          <p className={dash.heroValue}>{data.live.sessions.toLocaleString()}</p>
          <p className={dash.heroHint}>
            {data.live.streams} active streams · Redis-backed slots
          </p>
        </Link>
        <Link href="/admin/subscriptions" className={`${dash.heroCard} ${dash.heroCardB}`}>
          <p className={dash.heroLabel}>Active subscriptions</p>
          <p className={dash.heroValue}>{data.subscriptions.active.toLocaleString()}</p>
          <p className={dash.heroHint}>
            {data.subscriptions.trial} trial · {data.subscriptions.suspended} suspended
          </p>
        </Link>
        <div className={dash.heroMiniStack}>
          <Link href="/admin/users" className={dash.miniStat}>
            <span className={dash.miniStatLeft}>
              <span className={dash.miniIcon}>
                <Users className="h-4 w-4" aria-hidden />
              </span>
              <span>
                <span className={dash.miniTitle}>Users</span>
                <span className={dash.miniSub}>
                  {data.users.active} active · {data.users.admins} admins
                </span>
              </span>
            </span>
            <span className={dash.badge}>{userActivePercent(data)}</span>
          </Link>
          <Link href="/admin/movie-upload-requests" className={dash.miniStat}>
            <span className={dash.miniStatLeft}>
              <span className={dash.miniIcon}>
                <MessageSquarePlus className="h-4 w-4" aria-hidden />
              </span>
              <span>
                <span className={dash.miniTitle}>Upload requests</span>
                <span className={dash.miniSub}>
                  {data.movieUploadRequests.pending} pending
                  {data.movieUploadRequests.enabled ? " · live" : " · hidden"}
                </span>
              </span>
            </span>
            <span className={data.movieUploadRequests.pending > 0 ? dash.badge : dash.badgeMuted}>
              {data.movieUploadRequests.pending}
            </span>
          </Link>
        </div>
      </div>

      <div className={dash.chartGrid}>
        <section className={dash.chartCard}>
          <div className={dash.chartHead}>
            <div>
              <h2 className={dash.chartTitle}>Movies vs series (relative scale)</h2>
              <p className={dash.chartDesc}>Visual comparison; totals shown in the legend.</p>
            </div>
          </div>
          <CatalogCompareChart data={data} />
          <p className={dash.chartFooter}>
            <Link href="/admin/movies" className={dash.chartLink}>
              Open catalog
            </Link>
          </p>
        </section>
        <section className={dash.chartCard}>
          <div className={dash.chartHead}>
            <div>
              <h2 className={dash.chartTitle}>Subscription mix</h2>
              <p className={dash.chartDesc}>Active, trial, and suspended accounts.</p>
            </div>
          </div>
          <SubscriptionAreaChart data={data} />
          <p className={dash.chartFooter}>
            <Link href="/admin/subscriptions" className={dash.chartLink}>
              View subscriptions
            </Link>
          </p>
        </section>
      </div>

      <div className={dash.chartGridBottom}>
        <section className={dash.chartCard}>
          <h2 className={dash.chartTitle}>Catalog by type</h2>
          <CatalogDonutChart data={data} />
        </section>
        <section className={dash.chartCard}>
          <h2 className={dash.chartTitle}>Active vs total users</h2>
          <UsersActiveRing data={data} />
        </section>
        <section className={dash.chartCard}>
          <h2 className={dash.chartTitle}>Key metrics</h2>
          <KeyMetricsBarChart data={data} />
        </section>
      </div>

      <div className={dash.statTiles}>
        <Link href="/admin/profiles" className={dash.statTile}>
          <span className={dash.statTileLabel}>Profiles</span>
          <span className={dash.statTileValue}>{data.profiles}</span>
        </Link>
        <Link href="/admin/billing" className={dash.statTile}>
          <span className={dash.statTileLabel}>Payments</span>
          <span className={dash.statTileValue}>{data.billing.successfulPayments}</span>
          <span className={dash.statTileHint}>{data.billing.refunded} refunded</span>
        </Link>
        <Link href="/admin/libraries" className={dash.statTile}>
          <span className={dash.statTileLabel}>Library gaps</span>
          <span className={dash.statTileValue}>{data.library.unmatched}</span>
          <span className={dash.statTileHint}>
            {data.library.missing} missing · {data.library.libraries} libraries
          </span>
        </Link>
        <Link href="/admin/jobs" className={dash.statTile}>
          <span className={dash.statTileLabel}>Scans</span>
          <span className={dash.statTileValue}>{data.scans.running}</span>
          <span className={dash.statTileHint}>
            {data.scans.lastStatus ? `Last: ${data.scans.lastStatus}` : "No scans yet"}
          </span>
        </Link>
      </div>

      <section className={dash.chartCard} aria-live="polite">
        <div className={dash.chartHead}>
          <div>
            <p className={styles.panelEyebrow}>
              <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Server
            </p>
            <h2 className={dash.chartTitle}>Live CPU, RAM &amp; storage</h2>
            <p className={dash.chartDesc}>Updates every few seconds from the API host.</p>
          </div>
        </div>
        {serverMetricsError ? <p className="text-sm text-destructive">{serverMetricsError}</p> : null}
        {!serverMetrics && !serverMetricsError ? (
          <p className={dash.loading}>Reading server metrics…</p>
        ) : null}
        {serverMetrics ? (
          <div className={dash.serverRings}>
            <MetricRing
              label="CPU"
              percent={serverMetrics.cpu.usagePercent}
              detail={`${serverMetrics.cpu.cores} cores · load ${serverMetrics.cpu.loadAverage.map((v) => v.toFixed(2)).join(" / ")}`}
            />
            <MetricRing
              label="Memory"
              percent={serverMetrics.memory.usedPercent}
              detail={`${formatBytes(serverMetrics.memory.usedBytes)} / ${formatBytes(serverMetrics.memory.totalBytes)}`}
            />
            {serverMetrics.storage ? (
              <MetricRing
                label="Storage"
                percent={serverMetrics.storage.usedPercent}
                detail={`${formatBytes(serverMetrics.storage.usedBytes)} / ${formatBytes(serverMetrics.storage.totalBytes)}`}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Storage metrics unavailable on this host.</p>
            )}
          </div>
        ) : null}
      </section>

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
    </div>
  );
}
