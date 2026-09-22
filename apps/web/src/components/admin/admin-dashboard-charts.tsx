"use client";

import type { AdminDashboard } from "@movie-server/shared";
import dash from "./admin-dashboard.module.css";

const CHART_PRIMARY = "var(--primary)";
const CHART_SOFT = "var(--brand-soft)";
const CHART_DEEP = "var(--brand-deep)";
const CHART_MUTED = "color-mix(in oklch, var(--primary) 45%, var(--muted-foreground))";

function formatPercent(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 1000) / 10}%`;
}

export function CatalogCompareChart({ data }: { data: AdminDashboard }) {
  const movies = data.catalog.movies;
  const series = data.catalog.series;
  const max = Math.max(movies, series, data.live.sessions, data.live.streams, 1);
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const w = 320;
  const h = 140;
  const padX = 28;
  const padY = 18;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  const seriesPoints = (base: number) =>
    labels.map((_, i) => {
      const t = i / (labels.length - 1);
      const wave = 0.82 + 0.18 * Math.sin(i * 1.1);
      return base * wave * (0.92 + t * 0.08);
    });

  const lineA = seriesPoints(movies);
  const lineB = seriesPoints(series);

  const toPath = (values: number[], dashed?: boolean) => {
    const pts = values.map((v, i) => {
      const x = padX + (i / (values.length - 1)) * innerW;
      const y = padY + innerH - (v / max) * innerH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return (
      <path
        d={pts.join(" ")}
        fill="none"
        stroke={dashed ? CHART_MUTED : CHART_PRIMARY}
        strokeWidth={2.25}
        strokeDasharray={dashed ? "5 6" : undefined}
        strokeLinecap="round"
      />
    );
  };

  const peak = Math.max(...lineA, ...lineB);

  return (
    <div className={dash.chartBodyTall}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img" aria-label="Catalog scale chart">
        {[0.25, 0.5, 0.75, 1].map((g) => {
          const y = padY + innerH * (1 - g);
          return (
            <line
              key={g}
              x1={padX}
              x2={w - padX}
              y1={y}
              y2={y}
              stroke="color-mix(in oklch, var(--border) 85%, transparent)"
              strokeWidth={1}
            />
          );
        })}
        {toPath(lineA)}
        {toPath(lineB, true)}
        <text x={padX} y={h - 4} fill="var(--muted-foreground)" fontSize={9}>
          Movies {movies} · Series {series}
        </text>
        <text x={w - padX - 52} y={padY + 8} fill={CHART_PRIMARY} fontSize={9} fontWeight={600}>
          peak ≈ {Math.round(peak)}
        </text>
      </svg>
      <div className={dash.legendRow}>
        <span className={dash.legendItem}>
          <span className={dash.legendDot} style={{ background: CHART_PRIMARY }} />
          Movies (scale)
        </span>
        <span className={dash.legendItem}>
          <span className={dash.legendDot} style={{ background: CHART_MUTED }} />
          Series (scale)
        </span>
      </div>
    </div>
  );
}

export function SubscriptionAreaChart({ data }: { data: AdminDashboard }) {
  const { active, trial, suspended } = data.subscriptions;
  const total = Math.max(active + trial + suspended, 1);
  const w = 280;
  const h = 120;
  const layers = [
    { value: active, color: CHART_PRIMARY },
    { value: trial, color: CHART_SOFT },
    { value: suspended, color: CHART_DEEP },
  ];

  let offset = 0;
  const areas = layers.map((layer) => {
    const hPart = (layer.value / total) * h;
    const y = h - offset - hPart;
    offset += hPart;
    const path = `M 0 ${h} L 0 ${y + hPart * 0.35} Q ${w * 0.35} ${y} ${w * 0.55} ${y + hPart * 0.2} T ${w} ${y + hPart * 0.45} L ${w} ${h} Z`;
    return (
      <path
        key={layer.color}
        d={path}
        fill={layer.color}
        fillOpacity={0.35}
        stroke={layer.color}
        strokeWidth={1}
        strokeOpacity={0.5}
      />
    );
  });

  return (
    <div className={dash.chartBody}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img" aria-label="Subscription mix">
        <defs>
          <linearGradient id="subAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_SOFT} stopOpacity={0.5} />
            <stop offset="100%" stopColor={CHART_DEEP} stopOpacity={0.15} />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={w} height={h} fill="url(#subAreaGrad)" opacity={0.25} rx={8} />
        {areas}
        <text x={12} y={22} fill="var(--foreground)" fontSize={11} fontWeight={600}>
          {active} active
        </text>
      </svg>
      <div className={dash.legendRow}>
        <span className={dash.legendItem}>
          <span className={dash.legendDot} /> Active {formatPercent(active, total)}
        </span>
        <span className={dash.legendItem}>
          <span className={dash.legendDot} style={{ background: CHART_SOFT }} /> Trial{" "}
          {formatPercent(trial, total)}
        </span>
        <span className={dash.legendItem}>
          <span className={dash.legendDot} style={{ background: CHART_DEEP }} /> Suspended{" "}
          {formatPercent(suspended, total)}
        </span>
      </div>
    </div>
  );
}

export function CatalogDonutChart({ data }: { data: AdminDashboard }) {
  const segments = [
    { label: "Movies", value: data.catalog.movies, color: CHART_PRIMARY },
    { label: "Series", value: data.catalog.series, color: CHART_SOFT },
    { label: "Episodes", value: data.catalog.episodes, color: CHART_DEEP },
  ];
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className={dash.chartBodyShort}>
      <div className="flex items-center justify-center gap-4">
        <svg width={120} height={120} viewBox="0 0 120 120" role="img" aria-label="Catalog by type">
          <circle cx={60} cy={60} r={r} fill="none" stroke="color-mix(in oklch, var(--muted) 50%, transparent)" strokeWidth={14} />
          {segments.map((seg) => {
            const frac = seg.value / total;
            const dash = `${c * frac} ${c}`;
            const rot = (acc / total) * 360 - 90;
            acc += seg.value;
            return (
              <circle
                key={seg.label}
                cx={60}
                cy={60}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={14}
                strokeDasharray={dash}
                strokeLinecap="round"
                transform={`rotate(${rot} 60 60)`}
              />
            );
          })}
          <text x={60} y={58} textAnchor="middle" fill="var(--foreground)" fontSize={13} fontWeight={700}>
            {total}
          </text>
          <text x={60} y={72} textAnchor="middle" fill="var(--muted-foreground)" fontSize={8}>
            items
          </text>
        </svg>
        <ul className="space-y-2 text-xs">
          {segments.map((seg) => (
            <li key={seg.label} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: seg.color }} />
              <span className="font-medium">{seg.label}</span>
              <span className="text-muted-foreground">{seg.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function UsersActiveRing({ data }: { data: AdminDashboard }) {
  const active = data.users.active;
  const other = Math.max(data.users.total - active, 0);
  const total = Math.max(data.users.total, 1);
  const activePct = (active / total) * 100;
  const r = 46;
  const c = 2 * Math.PI * r;
  const activeDash = (activePct / 100) * c;

  return (
    <div className={dash.chartBodyShort}>
      <div className="flex flex-col items-center">
        <svg width={130} height={130} viewBox="0 0 130 130" role="img" aria-label="Active users share">
          <circle
            cx={65}
            cy={65}
            r={r}
            fill="none"
            stroke="color-mix(in oklch, var(--brand-deep) 55%, transparent)"
            strokeWidth={16}
            strokeDasharray={`${c - activeDash} ${c}`}
            strokeDashoffset={0}
            transform="rotate(-90 65 65)"
          />
          <circle
            cx={65}
            cy={65}
            r={r}
            fill="none"
            stroke={CHART_PRIMARY}
            strokeWidth={16}
            strokeDasharray={`${activeDash} ${c}`}
            strokeLinecap="round"
            transform="rotate(-90 65 65)"
          />
          <text x={65} y={62} textAnchor="middle" fill="var(--foreground)" fontSize={11} fontWeight={600}>
            Active
          </text>
          <text x={65} y={78} textAnchor="middle" fill="var(--primary)" fontSize={14} fontWeight={700}>
            {active.toLocaleString()}
          </text>
        </svg>
        <div className={dash.legendRow}>
          <span className={dash.legendItem}>
            <span className={dash.legendDot} /> {formatPercent(active, total)} active
          </span>
          <span className={dash.legendItem}>
            <span className={dash.legendDot} style={{ background: CHART_DEEP }} /> {other} other
          </span>
        </div>
      </div>
    </div>
  );
}

const METRIC_BAR_LABELS = ["Users", "Movies", "Subs", "Sessions", "Payments", "Scans"] as const;

export function KeyMetricsBarChart({ data }: { data: AdminDashboard }) {
  const values = [
    data.users.total,
    data.catalog.movies,
    data.subscriptions.active,
    data.live.sessions,
    data.billing.successfulPayments,
    data.scans.running,
  ];
  const max = Math.max(...values, 1);
  const w = 280;
  const h = 110;
  const barW = 32;
  const gap = (w - barW * values.length) / (values.length + 1);

  return (
    <div className={dash.chartBodyShort}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img" aria-label="Key metrics bars">
        {values.map((v, i) => {
          const barH = (v / max) * (h - 24);
          const x = gap + i * (barW + gap);
          const y = h - 16 - barH;
          return (
            <g key={METRIC_BAR_LABELS[i]}>
              <defs>
                <linearGradient id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_SOFT} />
                  <stop offset="100%" stopColor={CHART_DEEP} />
                </linearGradient>
              </defs>
              <rect x={x} y={y} width={barW} height={barH} rx={6} fill={`url(#barGrad${i})`} opacity={0.92} />
              <text x={x + barW / 2} y={h - 4} textAnchor="middle" fill="var(--muted-foreground)" fontSize={7}>
                {METRIC_BAR_LABELS[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function MetricRing({
  label,
  percent,
  detail,
}: {
  label: string;
  percent: number;
  detail: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 36;
  const c = 2 * Math.PI * r;
  const strokeLen = (clamped / 100) * c;

  return (
    <div className={dash.ringWrap}>
      <svg width={96} height={96} viewBox="0 0 96 96" aria-hidden>
        <circle
          cx={48}
          cy={48}
          r={r}
          fill="none"
          stroke="color-mix(in oklch, var(--muted) 55%, transparent)"
          strokeWidth={10}
        />
        <circle
          cx={48}
          cy={48}
          r={r}
          fill="none"
          stroke={CHART_PRIMARY}
          strokeWidth={10}
          strokeDasharray={`${strokeLen} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
        <text x={48} y={52} textAnchor="middle" fill="var(--foreground)" fontSize={12} fontWeight={700}>
          {clamped.toFixed(0)}%
        </text>
      </svg>
      <p className={dash.ringLabel}>{label}</p>
      <p className={dash.ringDetail}>{detail}</p>
    </div>
  );
}
