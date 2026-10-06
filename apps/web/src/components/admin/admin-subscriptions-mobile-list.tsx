"use client";

import { SubscriptionStatus, type AdminSubscriptionRow } from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/subscription-api";
import { cn } from "@/lib/utils";
import styles from "./admin-list-mobile.module.css";

function statusBadgeClass(status: string) {
  switch (status) {
    case SubscriptionStatus.Active:
    case SubscriptionStatus.Trial:
      return "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30";
    case SubscriptionStatus.Pending:
      return "bg-amber-500/15 text-amber-400 ring-amber-500/30";
    case SubscriptionStatus.Suspended:
      return "bg-red-500/15 text-red-400 ring-red-500/30";
    case SubscriptionStatus.Cancelled:
      return "bg-orange-500/15 text-orange-400 ring-orange-500/30";
    case SubscriptionStatus.Expired:
      return "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30";
    default:
      return "bg-muted text-muted-foreground ring-border";
  }
}

function UsageMeter({ used, max, label }: { used: number; max: number; label: string }) {
  const ratio = max > 0 ? Math.min(used / max, 1) : 0;
  const atLimit = used >= max;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-1 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium tabular-nums", atLimit && "text-amber-400")}>
          {used}/{max}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", atLimit ? "bg-amber-500" : "bg-primary/70")}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

export function AdminSubscriptionsMobileList({
  items,
  canManage,
  onManage,
  onActivate,
  onSuspend,
  onUnsuspend,
  onDelete,
}: {
  items: AdminSubscriptionRow[];
  canManage: boolean;
  onManage: (item: AdminSubscriptionRow) => void;
  onActivate: (id: string) => void;
  onSuspend: (id: string) => void;
  onUnsuspend: (id: string) => void;
  onDelete: (item: AdminSubscriptionRow) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(styles.card, item.status === SubscriptionStatus.Suspended && "opacity-80")}
        >
          <div className={styles.cardHead}>
            <p className={styles.title}>{item.userDisplayName || "—"}</p>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[0.625rem] font-medium capitalize ring-1 ring-inset",
                statusBadgeClass(item.status),
              )}
            >
              {item.status}
            </span>
          </div>
          <p className={styles.subtitle}>{item.userEmail || item.userId}</p>
          <div className={styles.metaGrid}>
            <div className={styles.metaCell}>
              <p className={styles.metaLabel}>Plan</p>
              <p className={styles.metaValue}>
                {item.plan.name}
                <span className="block text-xs font-normal capitalize text-muted-foreground">{item.billingCycle}</span>
              </p>
            </div>
            <div className={styles.metaCell}>
              <p className={styles.metaLabel}>Billing</p>
              <p className={styles.metaValue}>
                {formatCents(item.priceCents, item.currency)}
                <span className="block text-xs font-normal text-muted-foreground">
                  {item.autoRenew ? "Auto-renew" : "Manual"}
                </span>
              </p>
            </div>
            <div className={styles.metaCell}>
              <p className={styles.metaLabel}>Period end</p>
              <p className={styles.metaValue}>{new Date(item.currentPeriodEnd).toLocaleDateString()}</p>
            </div>
            <div className={styles.metaCell}>
              <p className={styles.metaLabel}>Entitled</p>
              <p className={cn(styles.metaValue, !item.entitled && item.status !== SubscriptionStatus.Expired && "text-amber-500")}>
                {item.entitled ? "Yes" : "No"}
              </p>
            </div>
            <div className={styles.metaCell}>
              <UsageMeter used={item.deviceCount} max={item.maxDevices} label="Devices" />
            </div>
            <div className={styles.metaCell}>
              <UsageMeter used={item.streamCount} max={item.maxStreams} label="Streams" />
            </div>
          </div>
          {canManage ? (
            <div className={styles.actions}>
              <Button type="button" size="sm" variant="outline" className={styles.actionBtn} onClick={() => onManage(item)}>
                Manage
              </Button>
              {item.status === SubscriptionStatus.Pending ? (
                <Button type="button" size="sm" variant="secondary" className={styles.actionBtn} onClick={() => onActivate(item.id)}>
                  Activate
                </Button>
              ) : null}
              {item.status === SubscriptionStatus.Suspended ? (
                <Button type="button" size="sm" variant="secondary" className={styles.actionBtn} onClick={() => onUnsuspend(item.id)}>
                  Restore
                </Button>
              ) : item.status === SubscriptionStatus.Active ||
                item.status === SubscriptionStatus.Trial ||
                item.status === SubscriptionStatus.Cancelled ? (
                <Button type="button" size="sm" variant="secondary" className={styles.actionBtn} onClick={() => onSuspend(item.id)}>
                  Suspend
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className={cn(styles.actionBtn, "col-span-2")}
                onClick={() => onDelete(item)}
              >
                Delete
              </Button>
            </div>
          ) : (
            <p className="px-3 pb-3 text-xs text-muted-foreground">View only</p>
          )}
        </li>
      ))}
    </ul>
  );
}
