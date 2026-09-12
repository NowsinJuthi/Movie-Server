"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BILLING_CYCLES, SUBSCRIPTION_STATUSES } from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { AdminSearch, AdminSelect } from "@/components/admin/admin-filters";
import { AdminUserSearch } from "@/components/admin/admin-user-search";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { formatCents } from "@/lib/subscription-api";

export default function AdminSubscriptionsPage() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("");
  const [grant, setGrant] = useState({ userId: "", planSlug: "standard", billingCycle: "monthly" });
  const [grantUserQuery, setGrantUserQuery] = useState("");
  const [pending, setPending] = useState<{ id: string; action: "suspend" | "unsuspend" } | null>(null);

  const query = useQuery({
    queryKey: ["admin-subs", userId, status],
    queryFn: () => adminApi.subscriptions({ userId: userId || undefined, status: status || undefined }),
  });
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: adminApi.plans });
  const grantMut = useMutation({
    mutationFn: () => adminApi.grantSubscription(grant),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-subs"] }),
  });
  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "suspend" | "unsuspend" }) =>
      action === "suspend" ? adminApi.suspendSubscription(id, "admin_panel") : adminApi.unsuspendSubscription(id),
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-subs"] });
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
    <AdminPage title="Subscriptions" description="Grant complimentary access or suspend an account. Changes are enforced server-side." error={error}>
      <form
        className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4"
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
          placeholder="Search user name or email"
          className="max-w-none"
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
        <Button disabled={grantMut.isPending || !grant.userId}>
          {grantMut.isPending ? "Granting..." : "Grant plan"}
        </Button>
      </form>
      <div className="mb-4 flex flex-wrap gap-3">
        <AdminSearch value={userId} onChange={setUserId} placeholder="Filter by user id" />
        <AdminSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[{ value: "", label: "All" }, ...SUBSCRIPTION_STATUSES.map((item) => ({ value: item, label: item }))]}
        />
      </div>
      <AdminTable columns={["User", "Plan", "Status", "Price", "Period end", ""]}>
        {(query.data?.subscriptions ?? []).map((item) => (
          <tr key={item.id}>
            <AdminTd className="font-mono text-xs">{item.userId}</AdminTd>
            <AdminTd>{item.plan.name}</AdminTd>
            <AdminTd className="capitalize">{item.status}</AdminTd>
            <AdminTd>{formatCents(item.priceCents, item.currency)}</AdminTd>
            <AdminTd>{new Date(item.currentPeriodEnd).toLocaleDateString()}</AdminTd>
            <AdminTd>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPending({ id: item.id, action: item.status === "suspended" ? "unsuspend" : "suspend" })}
              >
                {item.status === "suspended" ? "Unsuspend" : "Suspend"}
              </Button>
            </AdminTd>
          </tr>
        ))}
      </AdminTable>
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.action === "suspend" ? "Suspend this subscription?" : "Restore this subscription?"}
        description="Playback access is enforced from this status on the next request."
        confirmLabel={pending?.action === "suspend" ? "Suspend" : "Unsuspend"}
        pending={actionMut.isPending}
        onClose={() => setPending(null)}
        onConfirm={() => pending && actionMut.mutate(pending)}
      />
    </AdminPage>
  );
}
