"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Lock, Shield } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { rolePermissionsApi } from "@/lib/role-permissions-api";
import {
  PERMISSION_GROUPS,
  type RolePermissionProfile,
  type RolePermissionsOverview,
} from "@/lib/role-permissions";
import { cn } from "@/lib/utils";
import styles from "./roles.module.css";

function countEnabled(permissions: Record<string, boolean>) {
  return Object.values(permissions).filter(Boolean).length;
}

function isDirty(role: RolePermissionProfile, draft: Record<string, boolean>) {
  return PERMISSION_GROUPS.some((group) =>
    group.permissions.some((permission) => draft[permission.key] !== role.permissions[permission.key]),
  );
}

export default function AdminRolesPage() {
  const [overview, setOverview] = useState<RolePermissionsOverview | null>(null);
  const [selectedId, setSelectedId] = useState("administrator");
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selected = useMemo(
    () => overview?.roles.find((role) => role.id === selectedId) ?? null,
    [overview, selectedId],
  );

  const dirty = selected ? isDirty(selected, draft) : false;

  const load = useCallback(async (keepId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await rolePermissionsApi.overview();
      setOverview(data);
      const role =
        data.roles.find((row) => row.id === (keepId ?? selectedId)) ?? data.roles[0];
      if (role) {
        setSelectedId(role.id);
        setDraft({ ...role.permissions });
      }
    } catch (err) {
      setOverview(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load role profiles. Ensure you have permission to manage roles.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectRole = (role: RolePermissionProfile) => {
    setSelectedId(role.id);
    setDraft({ ...role.permissions });
    setSuccess(null);
  };

  const togglePermission = (key: string) => {
    if (selected?.locked) return;
    setDraft((current) => ({ ...current, [key]: !current[key] }));
    setSuccess(null);
  };

  const saveRole = async () => {
    if (!selected || selected.locked || !dirty) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await rolePermissionsApi.updateRole(selected.id, draft);
      setOverview((current) =>
        current
          ? {
              ...current,
              roles: current.roles.map((role) => (role.id === updated.id ? updated : role)),
              customizedCount: current.roles.map((role) =>
                role.id === updated.id ? updated : role,
              ).filter((role) => role.customized).length,
            }
          : current,
      );
      setDraft({ ...updated.permissions });
      setSuccess(`Saved permissions for ${updated.label}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save role.");
    } finally {
      setBusy(false);
    }
  };

  const resetRole = async () => {
    if (!selected || selected.locked) return;
    if (!window.confirm(`Reset "${selected.label}" to default permissions?`)) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await rolePermissionsApi.resetRole(selected.id);
      setOverview((current) =>
        current
          ? {
              ...current,
              roles: current.roles.map((role) => (role.id === updated.id ? updated : role)),
            }
          : current,
      );
      setDraft({ ...updated.permissions });
      setSuccess(`Reset ${updated.label} to defaults.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reset role.");
    } finally {
      setBusy(false);
    }
  };

  const resetAll = async () => {
    if (!window.confirm("Reset ALL role profiles to defaults?")) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await rolePermissionsApi.resetAll();
      setOverview(data);
      const role = data.roles.find((row) => row.id === selectedId) ?? data.roles[0];
      if (role) {
        setSelectedId(role.id);
        setDraft({ ...role.permissions });
      }
      setSuccess("All role profiles reset to defaults.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reset roles.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      title="Roles & permissions"
      description="Configure what each staff profile can access in the admin panel."
      error={error}
    >
      {success ? (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          {success}
        </div>
      ) : null}

      <section className={styles.stats} aria-label="Overview">
        <article className={styles.statCard}>
          <p className={styles.statLabel}>Profiles</p>
          <p className={styles.statValue}>{loading ? "…" : (overview?.roleCount ?? 0)}</p>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabel}>Customized</p>
          <p className={styles.statValue}>{loading ? "…" : (overview?.customizedCount ?? 0)}</p>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabel}>Admin access</p>
          <p className={styles.statValue}>{loading ? "…" : (overview?.adminAccessCount ?? 0)}</p>
        </article>
      </section>

      <div className={styles.layout}>
        <nav className={styles.roleNav} aria-label="Staff profiles">
          {(overview?.roles ?? []).map((role) => (
            <button
              key={role.id}
              type="button"
              className={cn(styles.roleNavBtn, selectedId === role.id && styles.roleNavBtnActive)}
              aria-pressed={selectedId === role.id}
              onClick={() => selectRole(role)}
            >
              <span>{role.label}</span>
              {role.locked ? (
                <Lock className="h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden />
              ) : role.customized ? (
                <span className={styles.badge}>edited</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className={styles.panel}>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading role profiles…</p>
          ) : !selected ? (
            <p className="text-sm text-muted-foreground">No role profile selected.</p>
          ) : (
            <>
              <div className={styles.panelHead}>
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" aria-hidden />
                    <h2 className={styles.panelTitle}>{selected.label}</h2>
                    {selected.locked ? <span className={styles.badge}>locked</span> : null}
                  </div>
                  <p className={styles.panelDescription}>{selected.description}</p>
                  <ul className={styles.summaryList}>
                    {selected.summary.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
                <div className={styles.actions}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || selected.locked || !dirty}
                    onClick={() => void saveRole()}
                  >
                    Save profile
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy || selected.locked}
                    onClick={() => void resetRole()}
                  >
                    Reset profile
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void resetAll()}
                  >
                    Reset all
                  </Button>
                </div>
              </div>

              <p className="mb-3 text-xs text-muted-foreground">
                {countEnabled(draft)} of {Object.keys(draft).length} permissions enabled
              </p>

              {PERMISSION_GROUPS.map((group) => (
                <section key={group.key} className={styles.group}>
                  <h3 className={styles.groupLabel}>{group.label}</h3>
                  <div className={styles.permGrid}>
                    {group.permissions.map((permission) => {
                      const enabled = Boolean(draft[permission.key]);
                      return (
                        <button
                          key={permission.key}
                          type="button"
                          disabled={selected.locked || busy}
                          aria-pressed={enabled}
                          className={cn(styles.permBtn, enabled && styles.permBtnOn)}
                          onClick={() => togglePermission(permission.key)}
                        >
                          <span className={cn(styles.permCheck, enabled && styles.permCheckOn)}>
                            {enabled ? <Check className="h-3.5 w-3.5" /> : null}
                          </span>
                          <span>
                            <span className={styles.permLabel}>{permission.label}</span>
                            <p className={styles.permDescription}>{permission.description}</p>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
