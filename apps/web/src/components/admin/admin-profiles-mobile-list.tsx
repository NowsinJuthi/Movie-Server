"use client";

import type { AdminProfileRow } from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import styles from "./admin-profiles-mobile.module.css";

export function AdminProfilesMobileList({
  items,
  canManage,
  onEdit,
  onDelete,
}: {
  items: AdminProfileRow[];
  canManage: boolean;
  onEdit: (profile: AdminProfileRow) => void;
  onDelete: (profileId: string) => void;
}) {
  if (items.length === 0) {
    return <p className={styles.empty}>No profiles match your search.</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id} className={styles.card}>
          <div className={styles.cardHead}>
            <ProfileAvatar profile={item} size="sm" />
            <p className={styles.profileName}>{item.name}</p>
          </div>
          <div className={styles.account}>
            <span className={styles.accountStrong}>{item.userDisplayName}</span>
            {item.userEmail}
          </div>
          <div className={styles.metaGrid}>
            <div className={styles.metaCell}>
              <p className={styles.metaLabel}>Kids</p>
              <p className={styles.metaValue}>{item.isKids ? "Yes" : "No"}</p>
            </div>
            <div className={styles.metaCell}>
              <p className={styles.metaLabel}>PIN</p>
              <p className={styles.metaValue}>{item.hasPin ? "Set" : "None"}</p>
            </div>
            <div className={styles.metaCell}>
              <p className={styles.metaLabel}>Maturity</p>
              <p className={styles.metaValue}>{item.maturityLevel}</p>
            </div>
            <div className={styles.metaCell}>
              <p className={styles.metaLabel}>Language</p>
              <p className={styles.metaValue}>{item.language}</p>
            </div>
          </div>
          {canManage ? (
            <div className={styles.actions}>
              <Button size="sm" variant="secondary" className={styles.actionBtn} onClick={() => onEdit(item)}>
                Edit
              </Button>
              <Button size="sm" variant="destructive" className={styles.actionBtn} onClick={() => onDelete(item.id)}>
                Delete
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
