"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

export default function AdminJobsPage() {
  const query = useQuery({ queryKey: ["admin-jobs"], queryFn: adminApi.jobs, refetchInterval: 15_000 });
  const error = query.error instanceof ApiError ? query.error.message : null;

  return (
    <AdminPage
      title="Background jobs"
      description={
        query.data?.enabled
          ? "BullMQ queue depth plus recent media scans stored in MongoDB."
          : "Queues are disabled in this environment. Scan history below still comes from MongoDB."
      }
      error={error}
    >
      <h2 className="mb-3 text-lg font-medium">Queues</h2>
      <AdminTable columns={["Queue", "Waiting", "Active", "Completed", "Failed", "Delayed"]} empty="No live workers attached.">
        {(query.data?.queues ?? []).map((item) => (
          <tr key={item.name}>
            <AdminTd>{item.name}{item.paused ? " (paused)" : ""}</AdminTd>
            <AdminTd>{item.waiting}</AdminTd>
            <AdminTd>{item.active}</AdminTd>
            <AdminTd>{item.completed}</AdminTd>
            <AdminTd>{item.failed}</AdminTd>
            <AdminTd>{item.delayed}</AdminTd>
          </tr>
        ))}
      </AdminTable>
      <h2 className="mb-3 mt-8 text-lg font-medium">Recent scans</h2>
      <AdminTable columns={["Job", "Status", "Progress", "Started", "Finished"]}>
        {(query.data?.recent ?? []).map((item) => (
          <tr key={item.id}>
            <AdminTd>{item.name}</AdminTd>
            <AdminTd>{item.status}</AdminTd>
            <AdminTd>{item.progress == null ? "—" : `${item.progress}%`}</AdminTd>
            <AdminTd>{new Date(item.createdAt).toLocaleString()}</AdminTd>
            <AdminTd>{item.finishedAt ? new Date(item.finishedAt).toLocaleString() : "—"}</AdminTd>
          </tr>
        ))}
      </AdminTable>
    </AdminPage>
  );
}
