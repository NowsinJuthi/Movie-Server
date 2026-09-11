"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { PageShell } from "@/components/layout/page-shell";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";
import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth-api";

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user, status, setUser, clear } = useAuthStore();
  const clearProfile = useProfileStore((state) => state.clear);

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login?next=/account/settings");
    }
  }, [status, router]);

  useEffect(() => {
    if (user?.displayName) setDisplayName(user.displayName);
  }, [user?.displayName]);

  const updateProfile = useMutation({
    mutationFn: () => authApi.updateAccount({ displayName: displayName.trim() }),
    onSuccess: (data) => {
      setUser(data.user);
      toast.success("Profile updated");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not update profile.");
    },
  });

  const changePassword = useMutation({
    mutationFn: () =>
      authApi.changePassword({
        currentPassword,
        newPassword,
      }),
    onSuccess: async (data) => {
      toast.success(data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      try {
        await authApi.logout();
      } catch {
        // cookies already cleared by change-password
      }
      clear();
      clearProfile();
      router.push("/login?next=/account/settings");
    },
    onError: (error) => {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not change password.";
      toast.error(message);
    },
  });

  if (status === "loading" || status === "idle" || !user) {
    return <ScreenMessage>Loading account...</ScreenMessage>;
  }

  const profileError =
    displayName.trim().length < 2
      ? "Display name must be at least 2 characters."
      : displayName.trim().length > 80
        ? "Display name is too long."
        : null;

  const passwordError =
    !currentPassword
      ? "Enter your current password."
      : newPassword.length < 6
        ? "New password must be at least 6 characters."
        : newPassword !== confirmPassword
          ? "New passwords do not match."
          : currentPassword === newPassword
            ? "New password must be different."
            : null;

  return (
    <PageShell
      title="Account settings"
      description="Edit your profile details and change your password."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/account/devices">Devices</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/account/subscription">Subscription</Link>
          </Button>
        </div>
      }
    >
      <section className="max-w-xl space-y-4 rounded-xl border border-border bg-card/60 p-5">
        <div>
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">Update how your account name appears.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} disabled className="bg-secondary/50" />
          <p className="text-xs text-muted-foreground">Email can’t be changed here.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            maxLength={80}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name"
          />
        </div>
        <Button
          disabled={updateProfile.isPending || Boolean(profileError) || displayName.trim() === user.displayName}
          onClick={() => updateProfile.mutate()}
        >
          {updateProfile.isPending ? "Saving..." : "Save profile"}
        </Button>
        {profileError && displayName.trim() !== user.displayName ? (
          <p className="text-sm text-destructive">{profileError}</p>
        ) : null}
      </section>

      <section className="max-w-xl space-y-4 rounded-xl border border-border bg-card/60 p-5">
        <div>
          <h2 className="text-lg font-semibold">Change password</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            After changing password you’ll be signed out on all devices.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          disabled={changePassword.isPending || Boolean(passwordError)}
          onClick={() => changePassword.mutate()}
        >
          {changePassword.isPending ? "Updating..." : "Update password"}
        </Button>
        {currentPassword || newPassword || confirmPassword ? (
          passwordError ? <p className="text-sm text-destructive">{passwordError}</p> : null
        ) : null}
      </section>
    </PageShell>
  );
}
