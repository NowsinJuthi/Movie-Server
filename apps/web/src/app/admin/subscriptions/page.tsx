"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BILLING_CYCLES,
  SUBSCRIPTION_STATUSES,
  SubscriptionStatus,
  type AdminSubscriptionRow,
} from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { AdminSelect } from "@/components/admin/admin-filters";
import { AdminUserSearch } from "@/components/admin/admin-user-search";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  EditSubscriptionDialog,
  buildPatchPayload,
  type EditSubscriptionFormValues,
} from "@/components/admin/edit-subscription-dialog";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { formatCents } from "@/lib/subscription-api";
import { cn } from "@/lib/utils";
import { useAdminPermissions } from "@/hooks/use-admin-permissions";

const GRANT_STATUSES = [
  SubscriptionStatus.Active,
  SubscriptionStatus.Trial,
  SubscriptionStatus.Pending,
] as const;

function statusBadgeClass(status: string) {
  switch (status) {
    case SubscriptionStatus.Active:
    case SubscriptionStatus.Trial:
      return "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30";
    case SubscriptionStatus.Pending:
      return "bg-amber-500/15 text-amber-400 ring-amber-500/30";
    case SubscriptionStatus.Suspended:
      return "bg-red-500/15 text-red-400 ring-red-500/30";
    case SubscriptionStatus.Cancelled:
      return "bg-orange-500/15 text-orange-400 ring-orange-500/30";
    case SubscriptionStatus.Expired:
      return "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30";
    default:
      return "bg-muted text-muted-foreground ring-border";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        statusBadgeClass(status),
      )}
    >
      {status}
    </span>
  );
}

function UsageMeter({ used, max, label }: { used: number; max: number; label: string }) {
  const ratio = max > 0 ? Math.min(used / max, 1) : 0;
  const atLimit = used >= max;
  return (
    <div className="min-w-[88px]">
      <div className="flex items-baseline justify-between gap-1 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium tabular-nums", atLimit && "text-amber-400")}>
          {used}/{max}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", atLimit ? "bg-amber-500" : "bg-primary/70")}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function AdminSubscriptionsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { can } = useAdminPermissions();
  const canManage = can("manage_subscriptions");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterUserQuery, setFilterUserQuery] = useState("");
  const [status, setStatus] = useState("");
  const [grant, setGrant] = useState<{
    userId: string;
    planSlug: string;
    billingCycle: string;
    status: string;
  }>({
    userId: "",
    planSlug: "standard",
    billingCycle: "monthly",
    status: SubscriptionStatus.Active,
  });
  const [grantUserQuery, setGrantUserQuery] = useState("");
  const [pending, setPending] = useState<{
    id: string;
    action: "suspend" | "unsuspend" | "activate" | "delete";
    label?: string;
  } | null>(null);
  const [editSub, setEditSub] = useState<AdminSubscriptionRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const userId = searchParams.get("userId")?.trim();
    if (userId) {
      setFilterUserId(userId);
      setFilterUserQuery(`User ${userId.slice(-6)}`);
    }
  }, [searchParams]);

  const query = useQuery({
    queryKey: ["admin-subs", filterUserId, status],
    queryFn: () =>
      adminApi.subscriptions({ userId: filterUserId || undefined, status: status || undefined }),
  });
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: adminApi.plans });

  const selectedPlan = useMemo(
    () => (plans.data?.plans ?? []).find((plan) => plan.slug === grant.planSlug),
    [plans.data?.plans, grant.planSlug],
  );

  const stats = useMemo(() => {
    const rows = query.data?.subscriptions ?? [];
    return {
      total: rows.length,
      active: rows.filter((row) => row.status === SubscriptionStatus.Active).length,
      trial: rows.filter((row) => row.status === SubscriptionStatus.Trial).length,
      pending: rows.filter((row) => row.status === SubscriptionStatus.Pending).length,
      suspended: rows.filter((row) => row.status === SubscriptionStatus.Suspended).length,
      atDeviceLimit: rows.filter((row) => row.deviceCount >= row.maxDevices).length,
    };
  }, [query.data?.subscriptions]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-subs"] });

  const grantMut = useMutation({
    mutationFn: () => adminApi.grantSubscription(grant),
    onSuccess: () => {
      setFormError(null);
      void refresh();
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : "Unable to grant subscription.");
    },
  });

  const actionMut = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: "suspend" | "unsuspend" | "activate" | "delete";
    }) => {
      if (action === "suspend") return adminApi.suspendSubscription(id, "admin_panel");
      if (action === "unsuspend") return adminApi.unsuspendSubscription(id);
      if (action === "delete") {
        await adminApi.deleteSubscription(id);
        return null;
      }
      return adminApi.activateSubscription(id);
    },
    onSuccess: () => {
      setPending(null);
      void refresh();
    },
  });

  const patchMut = useMutation({
    mutationFn: ({ id, values }: { id: string; values: EditSubscriptionFormValues }) =>
      adminApi.patchSubscription(id, buildPatchPayload(values)),
    onSuccess: async () => {
      setFormError(null);
      setEditSub(null);
      await refresh();
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : "Unable to update subscription.");
    },
  });

  const error =
    query.error instanceof ApiError
      ? query.error.message
      : grantMut.error instanceof ApiError
        ? grantMut.error.message
        : actionMut.error instanceof ApiError
          ? actionMut.error.message
          : null;

  return (
    <AdminPage
      title="Subscriptions"
      description="Grant access, monitor device and stream usage, and manage billing status. Limits are enforced on playback."
      error={error}
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Listed" value={stats.total} hint="Up to 200 recent rows" />
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Trial" value={stats.trial} />
        <StatCard label="Pending" value={stats.pending} />
        <StatCard label="At device limit" value={stats.atDeviceLimit} hint={`${stats.suspended} suspended`} />
      </div>

      {canManage ? (
      <section className="mb-8 rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-medium">Grant complimentary access</h2>
          <p className="text-sm text-muted-foreground">
            Replaces the user&apos;s current subscription. Device and stream limits follow the selected plan.
          </p>
        </div>
        <form
          className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!grant.userId) return;
            grantMut.mutate();
          }}
        >
          <AdminUserSearch
            value={grantUserQuery}
            onChange={setGrantUserQuery}
            onSelectUser={(user) => {
              setGrant({ ...grant, userId: user.id });
              setGrantUserQuery(`${user.displayName} (${user.email})`);
            }}
            placeholder="Search subscriber"
            className="max-w-none xl:col-span-2"
          />
          <select
            className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
            value={grant.planSlug}
            onChange={(event) => setGrant({ ...grant, planSlug: event.target.value })}
          >
            {(plans.data?.plans ?? []).map((plan) => (
              <option key={plan.id} value={plan.slug}>
                {plan.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
            value={grant.billingCycle}
            onChange={(event) => setGrant({ ...grant, billingCycle: event.target.value })}
          >
            {BILLING_CYCLES.map((cycle) => (
              <option key={cycle} value={cycle}>
                {cycle}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
            value={grant.status}
            onChange={(event) => setGrant({ ...grant, status: event.target.value })}
          >
            {GRANT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="flex items-end md:col-span-2 xl:col-span-5">
            <Button disabled={grantMut.isPending || !grant.userId} className="w-full sm:w-auto">
              {grantMut.isPending ? "Granting..." : "Grant subscription"}
            </Button>
          </div>
        </form>
        {selectedPlan ? (
          <div className="border-t border-border/60 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedPlan.name}</span>
            {" · "}
            {formatCents(
              grant.billingCycle === "yearly" ? selectedPlan.yearlyPriceCents : selectedPlan.monthlyPriceCents,
              selectedPlan.currency,
            )}
            /{grant.billingCycle === "yearly" ? "yr" : "mo"}
            {" · "}
            {selectedPlan.maxDevices} device{selectedPlan.maxDevices === 1 ? "" : "s"}
            {" · "}
            {selectedPlan.maxStreams} stream{selectedPlan.maxStreams === 1 ? "" : "s"}
            {" · "}
            up to {selectedPlan.maxVideoQuality.toUpperCase()}
          </div>
        ) : null}
        {formError ? <p className="px-4 pb-3 text-sm text-destructive">{formError}</p> : null}
      </section>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <p className="mb-1.5 text-xs text-muted-foreground">Filter by subscriber</p>
          <AdminUserSearch
            value={filterUserQuery}
            onChange={(value) => {
              setFilterUserQuery(value);
              if (!value.trim()) setFilterUserId("");
            }}
            onSelectUser={(user) => {
              setFilterUserId(user.id);
              setFilterUserQuery(`${user.displayName} (${user.email})`);
            }}
            placeholder="Name or email"
            className="max-w-none"
          />
        </div>
        <AdminSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "All statuses" },
            ...SUBSCRIPTION_STATUSES.map((item) => ({ value: item, label: item })),
          ]}
        />
        {filterUserId || status ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterUserId("");
              setFilterUserQuery("");
              setStatus("");
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <AdminTable
        columns={[
          "Subscriber",
          "Plan",
          "Status",
          "Billing",
          "Period end",
          "Devices",
          "Streams",
          "Actions",
        ]}
      >
        {(query.data?.subscriptions ?? []).map((item) => (
          <tr key={item.id} className={item.status === SubscriptionStatus.Suspended ? "opacity-80" : undefined}>
            <AdminTd>
              <div className="min-w-[160px]">
                <p className="font-medium">{item.userDisplayName || "—"}</p>
                <p className="text-xs text-muted-foreground">{item.userEmail || item.userId}</p>
              </div>
            </AdminTd>
            <AdminTd>
              <div>
                <p>{item.plan.name}</p>
                <p className="text-xs capitalize text-muted-foreground">{item.billingCycle}</p>
              </div>
            </AdminTd>
            <AdminTd>
              <div className="space-y-1">
                <StatusBadge status={item.status} />
                {item.cancelAtPeriodEnd ? (
                  <p className="text-xs text-muted-foreground">Cancels at period end</p>
                ) : null}
                {!item.entitled && item.status !== SubscriptionStatus.Expired ? (
                  <p className="text-xs text-amber-500">Not entitled</p>
                ) : null}
              </div>
            </AdminTd>
            <AdminTd>
              <div>
                <p>{formatCents(item.priceCents, item.currency)}</p>
                <p className="text-xs text-muted-foreground">{item.autoRenew ? "Auto-renew" : "Manual"}</p>
              </div>
            </AdminTd>
            <AdminTd>
              <div className="text-sm">
                <p>{new Date(item.currentPeriodEnd).toLocaleDateString()}</p>
                {item.gracePeriodEndsAt ? (
                  <p className="text-xs text-muted-foreground">
                    Grace: {new Date(item.gracePeriodEndsAt).toLocaleDateString()}
                  </p>
                ) : null}
              </div>
            </AdminTd>
            <AdminTd>
              <UsageMeter used={item.deviceCount} max={item.maxDevices} label="Devices" />
            </AdminTd>
            <AdminTd>
              <UsageMeter used={item.streamCount} max={item.maxStreams} label="Streams" />
            </AdminTd>
            <AdminTd>
              {canManage ? (
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setEditSub(item)}>
                    Manage
                  </Button>
                  {item.status === SubscriptionStatus.Pending ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPending({ id: item.id, action: "activate" })}
                    >
                      Activate
                    </Button>
                  ) : null}
                  {item.status === SubscriptionStatus.Suspended ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPending({ id: item.id, action: "unsuspend" })}
                    >
                      Restore
                    </Button>
                  ) : item.status === SubscriptionStatus.Active ||
                    item.status === SubscriptionStatus.Trial ||
                    item.status === SubscriptionStatus.Cancelled ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPending({ id: item.id, action: "suspend" })}
                    >
                      Suspend
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      setPending({
                        id: item.id,
                        action: "delete",
                        label: item.userDisplayName || item.userEmail || item.plan.name,
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">View only</span>
              )}
            </AdminTd>
          </tr>
        ))}
      </AdminTable>

      {!query.isLoading && (query.data?.subscriptions ?? []).length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">No subscriptions match these filters.</p>
      ) : null}

      <ConfirmDialog
        open={Boolean(pending)}
        title={
          pending?.action === "suspend"
            ? "Suspend this subscription?"
            : pending?.action === "activate"
              ? "Activate this subscription?"
              : pending?.action === "delete"
                ? "Delete this subscription?"
                : "Restore this subscription?"
        }
        description={
          pending?.action === "suspend"
            ? "Playback will stop after the grace period unless payment is restored."
            : pending?.action === "activate"
              ? "Marks payment as received and starts the billing period immediately."
              : pending?.action === "delete"
                ? `Removes the subscription record for ${pending?.label ?? "this subscriber"}. They lose access immediately unless you grant a new plan. This cannot be undone.`
                : "Clears suspension and restores full access."
        }
        confirmLabel={
          pending?.action === "suspend"
            ? "Suspend"
            : pending?.action === "activate"
              ? "Activate"
              : pending?.action === "delete"
                ? "Delete"
                : "Restore"
        }
        pending={actionMut.isPending}
        onClose={() => setPending(null)}
        onConfirm={() => pending && actionMut.mutate(pending)}
      />

      <EditSubscriptionDialog
        open={Boolean(editSub)}
        subscription={editSub}
        pending={patchMut.isPending}
        error={formError}
        onClose={() => {
          setEditSub(null);
          setFormError(null);
        }}
        onSubmit={(values) => editSub && patchMut.mutate({ id: editSub.id, values })}
      />
    </AdminPage>
  );
}
