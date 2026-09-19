"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, Film, KeyRound, Menu, Tv } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminMetricGrid, AdminStatCard } from "@/components/admin/admin-ui";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { licenseApi } from "@/lib/license-api";
import { libraryApi } from "@/lib/library-api";
import styles from "@/components/admin/admin-ui.module.css";

export default function AdminDashboardPage() {
  const query = useQuery({ queryKey: ["admin-dashboard"], queryFn: adminApi.dashboard });
  const licenseQuery = useQuery({ queryKey: ["license-status"], queryFn: licenseApi.status });
  const librariesQuery = useQuery({ queryKey: ["admin-libraries"], queryFn: libraryApi.list });
  const data = query.data;
  const license = licenseQuery.data;
  const libraries = (librariesQuery.data?.libraries ?? []).filter((library) => library.enabled);
  const error = query.error instanceof ApiError ? query.error.message : null;

  return (
    <AdminPage
      title="Dashboard"
      description="Live counts from MongoDB. Streaming slots are read from Redis."
      error={error}
    >
      {!data ? (
        <p className={styles.loading}>Loading metrics...</p>
      ) : (
        <AdminMetricGrid>
          <AdminStatCard href="/admin/users" label="Users" value={data.users.total} hint={`${data.users.active} active · ${data.users.admins} admins`} />
          <AdminStatCard href="/admin/profiles" label="Profiles" value={data.profiles} />
          <AdminStatCard
            href="/admin/movies"
            label="Movies"
            value={data.catalog.movies}
            hint={`${data.catalog.series} series · ${data.catalog.episodes} episodes`}
          />
          <AdminStatCard
            href="/admin/subscriptions"
            label="Active subs"
            value={data.subscriptions.active}
            hint={`${data.subscriptions.trial} trial · ${data.subscriptions.suspended} suspended`}
          />
          <AdminStatCard
            href="/admin/billing"
            label="Payments"
            value={data.billing.successfulPayments}
            hint={`${data.billing.refunded} refunded`}
          />
          <AdminStatCard
            href="/admin/libraries"
            label="Library gaps"
            value={data.library.unmatched}
            hint={`${data.library.missing} missing · ${data.library.libraries} libraries`}
          />
          <AdminStatCard
            href="/admin/sessions"
            label="Live sessions"
            value={data.live.sessions}
            hint={`${data.live.streams} streams`}
          />
          <AdminStatCard
            href="/admin/jobs"
            label="Scans running"
            value={data.scans.running}
            hint={data.scans.lastStatus ? `Last: ${data.scans.lastStatus}` : "No scans yet"}
          />
        </AdminMetricGrid>
      )}

      <Link href="/admin/slider" className={`${styles.panel} ${styles.panelInteractive}`}>
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

      <section className={styles.panel}>
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
          className={`${styles.panel} ${styles.panelInteractive} ${license.locked ? styles.panelLicenseLocked : ""}`}
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
    </AdminPage>
  );
}
