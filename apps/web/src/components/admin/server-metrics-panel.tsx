"use client";

import { useQuery } from "@tanstack/react-query";
import { Cpu, HardDrive, MemoryStick } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import styles from "@/components/admin/admin-ui.module.css";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 100 || unit === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

function MetricBar({
  label,
  percent,
  detail,
  icon: Icon,
}: {
  label: string;
  percent: number;
  detail: string;
  icon: typeof Cpu;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={styles.serverMetric}>
      <div className={styles.serverMetricHead}>
        <span className={styles.serverMetricLabel}>
          <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          {label}
        </span>
        <span className={styles.serverMetricDetail}>{detail}</span>
      </div>
      <div className={styles.serverMetricTrack} aria-hidden>
        <div className={styles.serverMetricFill} style={{ width: `${clamped}%` }} />
      </div>
      <p className={styles.serverMetricPercent}>{clamped.toFixed(1)}%</p>
    </div>
  );
}

export function ServerMetricsPanel() {
  const query = useQuery({
    queryKey: ["admin-server-metrics"],
    queryFn: adminApi.serverMetrics,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });

  const error = query.error instanceof ApiError ? query.error.message : null;
  const data = query.data;

  return (
    <section className={styles.panel} aria-live="polite">
      <div className={styles.panelHead}>
        <div className="min-w-0 flex-1">
          <p className={styles.panelEyebrow}>
            <Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Server
          </p>
          <h2 className={styles.panelTitle}>Live CPU, RAM &amp; storage</h2>
          <p className={styles.panelDesc}>Updates every few seconds from the API host.</p>
        </div>
      </div>
      <div className={styles.panelBody}>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!data && !error ? <p className={styles.loading}>Reading server metrics…</p> : null}
        {data ? (
          <div className={styles.serverMetricGrid}>
            <MetricBar
              label="CPU"
              icon={Cpu}
              percent={data.cpu.usagePercent}
              detail={`${data.cpu.cores} cores · load ${data.cpu.loadAverage.map((v) => v.toFixed(2)).join(" / ")}`}
            />
            <MetricBar
              label="Memory"
              icon={MemoryStick}
              percent={data.memory.usedPercent}
              detail={`${formatBytes(data.memory.usedBytes)} / ${formatBytes(data.memory.totalBytes)}`}
            />
            {data.storage ? (
              <MetricBar
                label="Storage"
                icon={HardDrive}
                percent={data.storage.usedPercent}
                detail={`${formatBytes(data.storage.usedBytes)} / ${formatBytes(data.storage.totalBytes)} · ${data.storage.path}`}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Storage metrics unavailable on this host.</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
