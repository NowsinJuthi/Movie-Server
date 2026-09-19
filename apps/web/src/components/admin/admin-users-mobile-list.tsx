"use client";

import Link from "next/link";
import {
  userRoleDisplayLabel,
  type AdminUserRow,
} from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import styles from "./admin-users-mobile.module.css";

function subscriptionStatusClass(status: string) {
  switch (status) {
    case "active":
    case "trial":
      return "text-emerald-400";
    case "pending":
      return "text-amber-400";
    case "suspended":
      return "text-red-400";
    case "cancelled":
      return "text-orange-400";
    default:
      return "text-muted-foreground";
  }
}

export function AdminUsersMobileList({
  items,
  currentUserId,
  canManageUsers,
  canViewSubscriptions,
  canManageSubscriptions,
  canManageRow,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  items: AdminUserRow[];
  currentUserId?: string;
  canManageUsers: boolean;
  canViewSubscriptions: boolean;
  canManageSubscriptions: boolean;
  canManageRow: (item: AdminUserRow) => boolean;
  onEdit: (item: AdminUserRow) => void;
  onToggleActive: (item: AdminUserRow) => void;
  onDelete: (item: AdminUserRow) => void;
}) {
  if (items.length === 0) {
    return <p className={styles.empty}>No users match your filters.</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const manageable = canManageRow(item);
        const isSelf = currentUserId === item.id;
        const roleLabel = userRoleDisplayLabel(item);

        return (
          <li key={item.id} className={styles.card}>
            <div className={styles.cardHead}>
              <p className={styles.name}>{item.displayName}</p>
              <span className={styles.roleBadge} title={roleLabel}>
                {roleLabel}
              </span>
            </div>
            <p className={styles.email}>{item.email}</p>

            <div className={styles.metaGrid}>
              <div className={styles.metaCell}>
                <p className={styles.metaLabel}>Verified</p>
                <p className={cn(styles.metaValue, !item.emailVerified && styles.metaValueMuted)}>
                  {item.emailVerified ? "Yes" : "No"}
                </p>
              </div>
              <div className={styles.metaCell}>
                <p className={styles.metaLabel}>Active</p>
                <p className={cn(styles.metaValue, !item.isActive && "text-amber-400")}>
                  {item.isActive ? "Yes" : "No"}
                </p>
              </div>
            </div>

            {canViewSubscriptions ? (
              item.subscription ? (
                <div className={styles.subBlock}>
                  <p className={styles.subPlan}>{item.subscription.planName}</p>
                  <p className={cn(styles.subStatus, subscriptionStatusClass(item.subscription.status))}>
                    {item.subscription.status}
                    {!item.subscription.entitled ? " · not entitled" : ""}
                  </p>
                  {canManageSubscriptions ? (
                    <Link
                      href={`/admin/subscriptions?userId=${encodeURIComponent(item.id)}`}
                      className={styles.subLink}
                    >
                      Manage subscription →
                    </Link>
                  ) : null}
                </div>
              ) : (
                <div className={styles.subBlock}>
                  <p className={styles.metaLabel}>Subscription</p>
                  <p className={cn(styles.metaValue, styles.metaValueMuted)}>None</p>
                </div>
              )
            ) : null}

            <p className={styles.lastLogin}>
              Last login:{" "}
              {item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : "Never"}
            </p>

            {manageable && canManageUsers ? (
              <div className={styles.actions}>
                <Button
                  size="sm"
                  variant="secondary"
                  className={styles.actionBtn}
                  onClick={() => onEdit(item)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className={styles.actionBtn}
                  onClick={() => onToggleActive(item)}
                >
                  {item.isActive ? "Deactivate" : "Activate"}
                </Button>
                {!isSelf ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    className={cn(styles.actionBtn, styles.actionsWide)}
                    onClick={() => onDelete(item)}
                  >
                    Delete user
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
