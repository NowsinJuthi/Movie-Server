"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminMetricGrid, AdminStatCard } from "@/components/admin/admin-ui";
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
        <AdminMetricGrid variant="lg4">
          <AdminStatCard label="Overall" value={data.status} valueClassName={data.status === "ok" ? "" : "text-destructive capitalize"} />
          <AdminStatCard label="MongoDB" value={data.mongo} valueClassName={data.mongo === "up" ? "capitalize" : "text-destructive capitalize"} />
          <AdminStatCard label="Redis" value={data.redis} valueClassName={data.redis === "up" ? "capitalize" : "text-destructive capitalize"} />
          <AdminStatCard
            label="Queues"
            value={data.queues.enabled ? data.queues.names.join(", ") : "disabled"}
            valueClassName="text-base sm:text-xl capitalize"
          />
          <AdminStatCard label="Uptime" value={`${Math.floor(data.uptimeSeconds / 60)} min`} />
        </AdminMetricGrid>
      )}
    </AdminPage>
  );
}
