"use client";

import type { PublicPlan } from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/subscription-api";
import styles from "./admin-list-mobile.module.css";

export function AdminPlansMobileList({
  plans,
  onEdit,
  onDisable,
  onEnable,
  enablePending,
}: {
  plans: PublicPlan[];
  onEdit: (plan: PublicPlan) => void;
  onDisable: (id: string) => void;
  onEnable: (id: string) => void;
  enablePending: boolean;
}) {
  if (plans.length === 0) {
    return <p className={styles.empty}>No plans yet.</p>;
  }

  return (
    <ul className={styles.list}>
      {plans.map((plan) => (
        <li key={plan.id} className={styles.card}>
          <div className={styles.cardHead}>
            <p className={styles.title}>{plan.name}</p>
            <span className={styles.badge}>{plan.isActive ? "Active" : "Inactive"}</span>
          </div>
          <p className={styles.subtitle}>{plan.slug}</p>
          <div className={styles.metaGrid}>
            <div className={styles.metaCell}>
              <p className={styles.metaLabel}>Monthly</p>
              <p className={styles.metaValue}>{formatCents(plan.monthlyPriceCents, plan.currency)}</p>
            </div>
            <div className={styles.metaCell}>
              <p className={styles.metaLabel}>Tier</p>
              <p className={styles.metaValue}>{plan.tier}</p>
            </div>
            <div className={styles.metaCellWide}>
              <p className={styles.metaLabel}>Limits</p>
              <p className={styles.metaValue}>
                {plan.maxVideoQuality.toUpperCase()} · {plan.maxStreams} streams · {plan.maxDevices} devices
              </p>
            </div>
          </div>
          <div className={styles.actions}>
            <Button type="button" variant="secondary" size="sm" className={styles.actionBtn} onClick={() => onEdit(plan)}>
              Edit
            </Button>
            {plan.isActive ? (
              <Button type="button" variant="outline" size="sm" className={styles.actionBtn} onClick={() => onDisable(plan.id)}>
                Disable
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={styles.actionBtn}
                disabled={enablePending}
                onClick={() => onEnable(plan.id)}
              >
                Enable
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
