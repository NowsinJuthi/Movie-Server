"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Film, Menu, Tv } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { licenseApi } from "@/lib/license-api";
import { libraryApi } from "@/lib/library-api";

export default function AdminDashboardPage() {
  const query = useQuery({ queryKey: ["admin-dashboard"], queryFn: adminApi.dashboard });
  const licenseQuery = useQuery({ queryKey: ["license-status"], queryFn: licenseApi.status });
  const librariesQuery = useQuery({ queryKey: ["admin-libraries"], queryFn: libraryApi.list });
  const data = query.data;
  const license = licenseQuery.data;
  const libraries = (librariesQuery.data?.libraries ?? []).filter((library) => library.enabled);
  const error = query.error instanceof ApiError ? query.error.message : null;

  return (
    <AdminPage title="Dashboard" description="Live counts from MongoDB. Streaming slots are read from Redis." error={error}>
      {license ? (
        <Link
          href="/admin/license"
          className={`mb-4 block rounded-xl border p-5 ${
            license.locked
              ? "border-destructive/50 bg-destructive/10"
              : "border-border bg-card hover:border-primary/40"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Product license</p>
              <p className="mt-1 text-lg font-semibold capitalize">
                {license.mode}
                {license.edition ? ` · ${license.edition}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{license.message}</p>
            </div>
            <span className="text-sm text-primary underline-offset-4 hover:underline">Manage license →</span>
          </div>
        </Link>
      ) : null}

      <section className="mb-4 rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Menu className="h-4 w-4" />
              Menu
            </p>
            <h2 className="mt-1 text-lg font-semibold">Media library menus</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each enabled library name shows here as a menu item.
            </p>
          </div>
          <Link href="/admin/menu" className="text-sm text-primary underline-offset-4 hover:underline">
            Open menu →
          </Link>
        </div>

        {libraries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No libraries yet.{" "}
            <Link href="/admin/libraries" className="text-primary underline-offset-4 hover:underline">
              Add a media library
            </Link>{" "}
            and its name will appear in Menu.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {libraries.map((library) => {
              const Icon = library.kind === "tv" ? Tv : Film;
              return (
                <Link
                  key={library.id}
                  href={`/admin/menu/${library.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border/80 bg-background/40 px-3 py-3 hover:border-primary/40"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                    {library.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={library.imageUrl} alt="" className="h-9 w-9 rounded-md object-cover" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{library.name}</span>
                    <span className="block text-xs capitalize text-muted-foreground">
                      {library.kind} · {library.itemCount} items
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {!data ? (
        <p className="text-sm text-muted-foreground">Loading metrics...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat href="/admin/users" label="Users" value={data.users.total} hint={`${data.users.active} active · ${data.users.admins} admins`} />
          <Stat href="/admin/profiles" label="Profiles" value={data.profiles} />
          <Stat href="/admin/movies" label="Movies" value={data.catalog.movies} hint={`${data.catalog.series} series · ${data.catalog.episodes} episodes`} />
          <Stat href="/admin/subscriptions" label="Active subs" value={data.subscriptions.active} hint={`${data.subscriptions.trial} trial · ${data.subscriptions.suspended} suspended`} />
          <Stat href="/admin/billing" label="Payments" value={data.billing.successfulPayments} hint={`${data.billing.refunded} refunded`} />
          <Stat href="/admin/libraries" label="Library gaps" value={data.library.unmatched} hint={`${data.library.missing} missing · ${data.library.libraries} libraries`} />
          <Stat href="/admin/sessions" label="Live sessions" value={data.live.sessions} hint={`${data.live.streams} streams`} />
          <Stat href="/admin/jobs" label="Scans running" value={data.scans.running} hint={data.scans.lastStatus ? `Last: ${data.scans.lastStatus}` : "No scans yet"} />
        </div>
      )}
    </AdminPage>
  );
}

function Stat({ href, label, value, hint }: { href: string; label: string; value: number; hint?: string }) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-card p-5 hover:border-primary/40">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Link>
  );
}
