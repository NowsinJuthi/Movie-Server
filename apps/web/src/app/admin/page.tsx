"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminDashboardView } from "@/components/admin/admin-dashboard-view";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { licenseApi } from "@/lib/license-api";
import { libraryApi } from "@/lib/library-api";
import dash from "@/components/admin/admin-dashboard.module.css";

export default function AdminDashboardPage() {
  const query = useQuery({ queryKey: ["admin-dashboard"], queryFn: adminApi.dashboard });
  const licenseQuery = useQuery({ queryKey: ["license-status"], queryFn: licenseApi.status });
  const librariesQuery = useQuery({ queryKey: ["admin-libraries"], queryFn: libraryApi.list });
  const metricsQuery = useQuery({
    queryKey: ["admin-server-metrics"],
    queryFn: adminApi.serverMetrics,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });

  const data = query.data;
  const license = licenseQuery.data;
  const libraries = (librariesQuery.data?.libraries ?? []).filter((library) => library.enabled);
  const error = query.error instanceof ApiError ? query.error.message : null;
  const serverMetricsError =
    metricsQuery.error instanceof ApiError ? metricsQuery.error.message : null;

  return (
    <AdminPage
      title="Dashboard"
      description="Live counts from MongoDB. Streaming slots are read from Redis."
      error={error}
    >
      {!data ? (
        <p className={dash.loading}>Loading metrics...</p>
      ) : (
        <AdminDashboardView
          data={data}
          libraries={libraries}
          license={license}
          serverMetrics={metricsQuery.data}
          serverMetricsError={serverMetricsError}
        />
      )}
    </AdminPage>
  );
}
