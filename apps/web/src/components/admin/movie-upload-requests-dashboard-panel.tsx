"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Clapperboard } from "lucide-react";
import type { AdminDashboard } from "@movie-server/shared";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { useAdminPermissions } from "@/hooks/use-admin-permissions";
import styles from "./admin-ui.module.css";

export function MovieUploadRequestsDashboardPanel({
  movieUploadRequests,
}: {
  movieUploadRequests: AdminDashboard["movieUploadRequests"];
}) {
  const queryClient = useQueryClient();
  const { can } = useAdminPermissions();
  const canManage = can("manage_home_curation");

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => adminApi.setMovieUploadRequestFeature(enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["site-features"] });
    },
  });

  const toggleError =
    toggleMutation.error instanceof ApiError ? toggleMutation.error.message : null;

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div className="min-w-0 flex-1">
          <p className={styles.panelEyebrow}>
            <Clapperboard className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Members
          </p>
          <h2 className={styles.panelTitle}>Movie upload requests</h2>
          <p className={styles.panelDesc}>
            Let viewers ask for titles from the site header. {movieUploadRequests.pending} pending
            {movieUploadRequests.enabled ? " · page is live" : " · page is hidden"}.
          </p>
          {toggleError ? <p className="mt-2 text-sm text-destructive">{toggleError}</p> : null}
        </div>
        <Link href="/admin/movie-upload-requests" className={styles.panelAction}>
          Manage requests
          <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden />
        </Link>
      </div>
      {canManage ? (
        <div className={styles.panelBody}>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={movieUploadRequests.enabled}
              disabled={toggleMutation.isPending}
              onChange={(e) => toggleMutation.mutate(e.target.checked)}
            />
            <span>
              Show <strong>Request movie</strong> in the site header and allow submissions
            </span>
          </label>
        </div>
      ) : null}
    </section>
  );
}
