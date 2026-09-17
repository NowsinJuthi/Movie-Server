"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  assignableRoleOptions,
  memberRoleKey,
  parseAssignableRole,
  UserRole,
} from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CreateUserFormValues = {
  email: string;
  displayName: string;
  password: string;
  assignableRole: string;
  emailVerified: boolean;
};

const emptyForm = (): CreateUserFormValues => ({
  email: "",
  displayName: "",
  password: "",
  assignableRole: memberRoleKey(UserRole.User),
  emailVerified: true,
});

export function AddUserDialog({
  open,
  pending,
  error,
  allowStaffRoles,
  onClose,
  onSubmit,
}: {
  open: boolean;
  pending?: boolean;
  error?: string | null;
  allowStaffRoles: boolean;
  onClose: () => void;
  onSubmit: (values: CreateUserFormValues) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<CreateUserFormValues>(emptyForm());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
    }
  }, [open]);

  const roleOptions = useMemo(
    () => assignableRoleOptions(allowStaffRoles),
    [allowStaffRoles],
  );

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-user-title"
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

        <h2 id="add-user-title" className="pr-10 text-xl font-semibold">
          Add user
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create an account that can sign in immediately. Staff roles match Roles &amp; permissions.
        </p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(form);
          }}
        >
          <label className="block space-y-2 text-sm">
            <Label htmlFor="add-user-name">Display name</Label>
            <Input
              id="add-user-name"
              autoComplete="off"
              required
              minLength={2}
              maxLength={80}
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            />
          </label>

          <label className="block space-y-2 text-sm">
            <Label htmlFor="add-user-email">Email</Label>
            <Input
              id="add-user-email"
              type="email"
              autoComplete="off"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>

          <label className="block space-y-2 text-sm">
            <Label htmlFor="add-user-password">Password</Label>
            <Input
              id="add-user-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              maxLength={72}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>

          <label className="block space-y-2 text-sm">
            <Label htmlFor="add-user-role">Role</Label>
            <select
              id="add-user-role"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.assignableRole}
              onChange={(event) => setForm({ ...form, assignableRole: event.target.value })}
            >
              {(["Members", "Staff roles"] as const).map((group) => {
                const options = roleOptions.filter((option) => option.group === group);
                if (options.length === 0) return null;
                return (
                  <optgroup key={group} label={group}>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            {!allowStaffRoles ? (
              <span className="text-xs text-muted-foreground">
                Staff roles require Super Admin. Configure permissions under Settings → Roles.
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Staff roles use the same profiles as Roles &amp; permissions.
              </span>
            )}
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={form.emailVerified}
              onChange={(event) => setForm({ ...form, emailVerified: event.target.checked })}
            />
            <span>Mark email as verified (can sign in now)</span>
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create user"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
