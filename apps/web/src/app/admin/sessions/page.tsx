"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { adminSessionApi } from "@/lib/admin-session-api";
import { ApiError } from "@/lib/api";

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminSessionsPage() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: adminSessionApi.monitor,
    refetchInterval: 15_000,
  });

  const revoke = useMutation({
    mutationFn: adminSessionApi.revokeSession,
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
    },
  });

  if (!query.data && !query.error) {
    return (
      <AdminPage title="Sessions & streams" description="Live auth sessions, concurrent streams, and flagged activity. Tokens are never shown.">
        <p className="text-sm text-muted-foreground">Loading sessions...</p>
      </AdminPage>
    );
  }

  const error =
    query.error instanceof ApiError
      ? query.error.message
      : revoke.error instanceof ApiError
        ? revoke.error.message
        : null;

  return (
    <AdminPage title="Sessions & streams" description="Live auth sessions, concurrent streams, and flagged activity. Tokens are never shown." error={error}>

        <section>
          <h2 className="mb-3 text-xl font-medium">Suspicious activity</h2>
          {(query.data?.suspicious ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No flagged sessions in the last 7 days.</p>
          ) : (
            <SessionTable
              rows={query.data?.suspicious ?? []}
              onRevoke={(id) => setPending(id)}
              pending={revoke.isPending}
            />
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl font-medium">Active playback</h2>
          {(query.data?.streams ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No live streams.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Device</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Quality</th>
                    <th className="px-4 py-3">Heartbeat</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data?.streams.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-4 py-3">{item.userEmail || item.userId}</td>
                      <td className="px-4 py-3">{item.deviceName || item.deviceKey}</td>
                      <td className="px-4 py-3">
                        {item.mediaType} {item.mediaId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">{item.quality}</td>
                      <td className="px-4 py-3">{formatTime(item.lastHeartbeatAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl font-medium">Auth sessions</h2>
          <SessionTable
            rows={query.data?.sessions ?? []}
            onRevoke={(id) => setPending(id)}
            pending={revoke.isPending}
          />
        </section>
        <ConfirmDialog
          open={Boolean(pending)}
          title="Revoke this session?"
          description="The user will be signed out on that device. Active streams on the same session stop after the next heartbeat."
          confirmLabel="Revoke"
          pending={revoke.isPending}
          onClose={() => setPending(null)}
          onConfirm={() => pending && revoke.mutate(pending)}
        />
    </AdminPage>
  );
}

function SessionTable({
  rows,
  onRevoke,
  pending,
}: {
  rows: {
    id: string;
    userEmail?: string;
    deviceName: string | null;
    deviceType: string | null;
    lastActiveAt: string;
    suspicious: boolean;
    flags: string[];
  }[];
  onRevoke: (id: string) => void;
  pending: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No sessions.</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary text-muted-foreground">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Device</th>
            <th className="px-4 py-3">Last active</th>
            <th className="px-4 py-3">Flags</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className="px-4 py-3">{item.userEmail ?? "—"}</td>
              <td className="px-4 py-3">
                {item.deviceName || item.deviceType || "Unknown"}
              </td>
              <td className="px-4 py-3">{formatTime(item.lastActiveAt)}</td>
              <td className="px-4 py-3">
                {item.suspicious ? item.flags.join(", ") || "flagged" : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => onRevoke(item.id)}>
                  Revoke
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
