"use client";

import type { AdminDashboard } from "@movie-server/shared";
import dash from "./admin-dashboard.module.css";

function formatPercent(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 1000) / 10}%`;
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, (part / total) * 100);
}

export function CatalogBars({ data }: { data: AdminDashboard }) {
  const rows = [
    { label: "Movies", value: data.catalog.movies, fill: dash.barFill! },
    { label: "TV series", value: data.catalog.series, fill: dash.barFillSoft! },
    { label: "Episodes", value: data.catalog.episodes, fill: dash.barFillDeep! },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className={dash.barRow}>
      {rows.map((row) => (
        <div key={row.label} className={dash.barItem}>
          <div className={dash.barHead}>
            <span className={dash.barLabel}>{row.label}</span>
            <span className={dash.barValue}>{row.value.toLocaleString()}</span>
          </div>
          <div className={dash.barTrack} aria-hidden>
            <div className={row.fill} style={{ width: `${pct(row.value, max)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SubscriptionStack({ data }: { data: AdminDashboard }) {
  const { active, trial, suspended, canceled } = data.subscriptions;
  const total = Math.max(active + trial + suspended + canceled, 1);
  const segments = [
    { label: "Active", value: active, color: "var(--primary)" },
    { label: "Trial", value: trial, color: "var(--brand-soft)" },
    { label: "Suspended", value: suspended, color: "var(--brand-deep)" },
    { label: "Canceled", value: canceled, color: "color-mix(in oklch, var(--muted-foreground) 55%, transparent)" },
  ].filter((s) => s.value > 0);

  return (
    <>
      <div className={dash.stackBar} role="img" aria-label="Subscription status distribution">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={dash.stackSegment}
            style={{ flexGrow: seg.value, background: seg.color }}
            title={`${seg.label}: ${seg.value}`}
          />
        ))}
      </div>
      <ul className={dash.legend}>
        {segments.map((seg) => (
          <li key={seg.label} className={dash.legendItem}>
            <span className={dash.legendSwatch} style={{ background: seg.color }} />
            {seg.label}{" "}
            <strong className="font-semibold text-foreground">{seg.value}</strong>
            <span className="opacity-80"> ({formatPercent(seg.value, total)})</span>
          </li>
        ))}
      </ul>
      {segments.length === 0 ? (
        <p className={dash.emptyChart}>No subscription records yet.</p>
      ) : null}
    </>
  );
}

export function UsersActiveRing({ data }: { data: AdminDashboard }) {
  const active = data.users.active;
  const total = Math.max(data.users.total, 1);
  const activePct = pct(active, total);
  const r = 40;
  const c = 2 * Math.PI * r;
  const strokeLen = (activePct / 100) * c;

  return (
    <div className={dash.ringBlock}>
      <svg className={dash.ringSvg} viewBox="0 0 96 96" role="img" aria-label={`${activePct.toFixed(0)} percent active users`}>
        <circle
          cx={48}
          cy={48}
          r={r}
          fill="none"
          stroke="color-mix(in oklch, var(--muted) 55%, transparent)"
          strokeWidth={9}
        />
        <circle
          cx={48}
          cy={48}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={9}
          strokeDasharray={`${strokeLen} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
        <text x={48} y={44} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10} fontWeight={600}>
          Active
        </text>
        <text x={48} y={58} textAnchor="middle" fill="var(--foreground)" fontSize={16} fontWeight={700}>
          {activePct.toFixed(0)}%
        </text>
      </svg>
      <div className={dash.statList} style={{ width: "100%" }}>
        <div className={dash.statRow}>
          <span className={dash.statRowLabel}>Active users</span>
          <span className={dash.statRowValue}>{active.toLocaleString()}</span>
        </div>
        <div className={dash.statRow}>
          <span className={dash.statRowLabel}>Total accounts</span>
          <span className={dash.statRowValue}>{data.users.total.toLocaleString()}</span>
        </div>
        <div className={dash.statRow}>
          <span className={dash.statRowLabel}>Admins</span>
          <span className={dash.statRowValue}>{data.users.admins}</span>
        </div>
      </div>
    </div>
  );
}

export function BillingSnapshot({ data }: { data: AdminDashboard }) {
  return (
    <div className={dash.statList}>
      <div className={dash.statRow}>
        <span className={dash.statRowLabel}>Successful payments</span>
        <span className={dash.statRowValue}>{data.billing.successfulPayments.toLocaleString()}</span>
      </div>
      <div className={dash.statRow}>
        <span className={dash.statRowLabel}>Refunded</span>
        <span className={dash.statRowValue}>{data.billing.refunded.toLocaleString()}</span>
      </div>
      <div className={dash.statRow}>
        <span className={dash.statRowLabel}>Active plans</span>
        <span className={dash.statRowValue}>{data.subscriptions.active.toLocaleString()}</span>
      </div>
      <div className={dash.statRow}>
        <span className={dash.statRowLabel}>Trial</span>
        <span className={dash.statRowValue}>{data.subscriptions.trial.toLocaleString()}</span>
      </div>
    </div>
  );
}

export function LibrarySnapshot({ data }: { data: AdminDashboard }) {
  return (
    <div className={dash.statList}>
      <div className={dash.statRow}>
        <span className={dash.statRowLabel}>Libraries</span>
        <span className={dash.statRowValue}>{data.library.libraries}</span>
      </div>
      <div className={dash.statRow}>
        <span className={dash.statRowLabel}>Unmatched items</span>
        <span className={dash.statRowValue}>{data.library.unmatched.toLocaleString()}</span>
      </div>
      <div className={dash.statRow}>
        <span className={dash.statRowLabel}>Missing files</span>
        <span className={dash.statRowValue}>{data.library.missing.toLocaleString()}</span>
      </div>
      <div className={dash.statRow}>
        <span className={dash.statRowLabel}>Scans running</span>
        <span className={dash.statRowValue}>{data.scans.running}</span>
      </div>
    </div>
  );
}

export function ServerMetricBar({
  label,
  percent,
  detail,
}: {
  label: string;
  percent: number;
  detail: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const tone =
    clamped >= 90 ? dash.barFillDeep! : clamped >= 75 ? dash.barFill! : dash.barFillSoft!;

  return (
    <div className={dash.serverMetric}>
      <div className={dash.serverMetricHead}>
        <span className={dash.serverMetricName}>{label}</span>
        <span className={dash.serverMetricPct}>{clamped.toFixed(1)}%</span>
      </div>
      <div className={dash.barTrack} aria-hidden>
        <div className={tone} style={{ width: `${clamped}%` }} />
      </div>
      <p className={dash.serverMetricDetail}>{detail}</p>
    </div>
  );
}
