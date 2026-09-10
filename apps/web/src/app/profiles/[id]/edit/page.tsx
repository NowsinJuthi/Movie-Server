"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileForm, type ProfileFormValues } from "@/components/profiles/profile-form";
import { PinDialog, ScreenMessage } from "@/components/profiles/pin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profileApi } from "@/lib/profile-api";
import { useAuthStore } from "@/stores/auth-store";

export default function EditProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useAuthStore();
  const [pinOpen, setPinOpen] = useState<"set" | "clear" | null>(null);
  const [newPin, setNewPin] = useState("");

  const query = useQuery({
    queryKey: ["profile", params.id],
    queryFn: () => profileApi.get(params.id),
    enabled: status === "authenticated",
  });

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [status, router]);

  const update = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      profileApi.update(params.id, {
        name: values.name,
        avatarKey: values.avatarKey,
        isKids: values.isKids,
        language: values.language,
        audioLanguage: values.audioLanguage,
        subtitleLanguage: values.subtitleLanguage,
        maturityLevel: values.isKids ? "kids" : values.maturityLevel,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      router.push("/profiles/manage");
    },
  });

  const avatar = useMutation({
    mutationFn: (file: File) => profileApi.uploadAvatar(params.id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", params.id] }),
  });

  const pinMutation = useMutation({
    mutationFn: async (currentPin: string) => {
      if (!query.data?.profile.hasPin) {
        return profileApi.setPin(params.id, newPin);
      }
      if (pinOpen === "clear") {
        return profileApi.clearPin(params.id, currentPin);
      }
      return profileApi.setPin(params.id, newPin, currentPin);
    },
    onSuccess: () => {
      setPinOpen(null);
      queryClient.invalidateQueries({ queryKey: ["profile", params.id] });
    },
  });

  if (status !== "authenticated" || !query.data) {
    return <ScreenMessage>Loading profile...</ScreenMessage>;
  }

  const profile = query.data.profile;

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16">
      <h1 className="mb-8 text-3xl font-semibold">Edit profile</h1>
      <ProfileForm
        profile={profile}
        submitLabel="Save"
        busy={update.isPending}
        onAvatarFile={(file) => avatar.mutate(file)}
        onSubmit={(values) => update.mutate(values)}
      />
      <div className="mt-10 space-y-3 border-t border-border pt-6">
        <h2 className="font-medium">PIN protection</h2>
        {profile.hasPin ? (
          <div className="flex gap-3">
            <div className="space-y-2">
              <Label htmlFor="newPin">New PIN</Label>
              <Input id="newPin" maxLength={4} inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
            </div>
            <Button type="button" variant="outline" disabled={newPin.length !== 4} onClick={() => setPinOpen("set")}>
              Change PIN
            </Button>
            <Button type="button" variant="destructive" onClick={() => setPinOpen("clear")}>
              Remove PIN
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="newPin">New PIN</Label>
            <Input id="newPin" maxLength={4} inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
            <Button
              type="button"
              disabled={newPin.length !== 4 || pinMutation.isPending}
              onClick={() => pinMutation.mutate("")}
            >
              Lock profile
            </Button>
          </div>
        )}
      </div>
      <PinDialog
        open={Boolean(pinOpen)}
        title={pinOpen === "clear" ? "Remove PIN" : profile.hasPin ? "Confirm current PIN" : "Confirm"}
        onClose={() => setPinOpen(null)}
        submitting={pinMutation.isPending}
        onSubmit={(pin) => pinMutation.mutate(pin)}
      />
    </main>
  );
}
