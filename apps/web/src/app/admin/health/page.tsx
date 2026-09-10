"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminPage } from "@/components/admin/admin-page";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

export default function AdminHealthPage() {
  const query = useQuery({ queryKey: ["admin-health"], queryFn: adminApi.health, refetchInterval: 20_000 });
  const error = query.error instanceof ApiError ? query.error.message : null;
  const data = query.data;

  return (
    <AdminPage title="System health" description="MongoDB, Redis, and worker availability. The public /health endpoint remains unauthenticated for probes." error={error}>
      {!data ? (
        <p className="text-sm text-muted-foreground">Checking services...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HealthCard label="Overall" value={data.status} ok={data.status === "ok"} />
          <HealthCard label="MongoDB" value={data.mongo} ok={data.mongo === "up"} />
          <HealthCard label="Redis" value={data.redis} ok={data.redis === "up"} />
          <HealthCard label="Queues" value={data.queues.enabled ? data.queues.names.join(", ") : "disabled"} ok={data.status === "ok"} />
          <HealthCard label="Uptime" value={`${Math.floor(data.uptimeSeconds / 60)} min`} ok />
        </div>
      )}
    </AdminPage>
  );
}

function HealthCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-xl font-semibold capitalize ${ok ? "" : "text-destructive"}`}>{value}</p>
    </div>
  );
}
