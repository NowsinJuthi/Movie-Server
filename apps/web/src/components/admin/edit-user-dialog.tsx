"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { END_USER_ROLES, USER_ROLES, UserRole, type AdminUserRow } from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EditUserFormValues = {
  displayName: string;
  email: string;
  password: string;
  role: UserRole;
  emailVerified: boolean;
  isActive: boolean;
};

export function EditUserDialog({
  open,
  user,
  pending,
  error,
  allowStaffRoles,
  onClose,
  onSubmit,
}: {
  open: boolean;
  user: AdminUserRow | null;
  pending?: boolean;
  error?: string | null;
  allowStaffRoles: boolean;
  onClose: () => void;
  onSubmit: (values: EditUserFormValues) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<EditUserFormValues | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && user) {
      setForm({
        displayName: user.displayName,
        email: user.email,
        password: "",
        role: user.role,
        emailVerified: user.emailVerified,
        isActive: user.isActive,
      });
    }
  }, [open, user]);

  if (!mounted || !open || !user || !form) return null;

  const roleOptions = allowStaffRoles ? USER_ROLES : END_USER_ROLES;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
        className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <button
          type="button"
          className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Close"
          disabled={pending}
          onClick={onClose}
        >
          <X className="size-4" />
        </button>

        <h2 id="edit-user-title" className="pr-10 text-xl font-semibold">
          Edit user
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Update profile, role, or set a new password (leave blank to keep the current one).
        </p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(form);
          }}
        >
          <label className="block space-y-2 text-sm">
            <Label htmlFor="edit-user-name">Display name</Label>
            <Input
              id="edit-user-name"
              autoComplete="off"
              required
              minLength={2}
              maxLength={80}
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            />
          </label>

          <label className="block space-y-2 text-sm">
            <Label htmlFor="edit-user-email">Email</Label>
            <Input
              id="edit-user-email"
              type="email"
              autoComplete="off"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>

          <label className="block space-y-2 text-sm">
            <Label htmlFor="edit-user-password">New password</Label>
            <Input
              id="edit-user-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              maxLength={72}
              placeholder="Leave blank to keep current"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>

          <label className="block space-y-2 text-sm">
            <Label htmlFor="edit-user-role">Role</Label>
            <select
              id="edit-user-role"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={form.emailVerified}
              onChange={(event) => setForm({ ...form, emailVerified: event.target.checked })}
            />
            <span>Email verified</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            <span>Account active</span>
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
