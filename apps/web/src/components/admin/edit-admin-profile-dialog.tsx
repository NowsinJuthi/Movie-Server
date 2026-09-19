"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { MaturityLevel, type AdminProfileRow } from "@movie-server/shared";
import { ProfileForm, type ProfileFormValues } from "@/components/profiles/profile-form";
import { Button } from "@/components/ui/button";

export function EditAdminProfileDialog({
  open,
  profile,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  profile: AdminProfileRow | null;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: ProfileFormValues) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open || !profile) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-admin-profile-title"
        className="max-h-[min(92dvh,40rem)] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:max-w-lg sm:rounded-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="edit-admin-profile-title" className="text-lg font-semibold">
              Edit profile
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {profile.userDisplayName} · {profile.userEmail}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="shrink-0 touch-manipulation" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ProfileForm
          key={profile.id}
          profile={profile}
          submitLabel={pending ? "Saving..." : "Save changes"}
          busy={pending}
          error={error}
          onSubmit={(values) => {
            onSubmit({
              ...values,
              maturityLevel: values.isKids ? MaturityLevel.Kids : values.maturityLevel,
            });
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
