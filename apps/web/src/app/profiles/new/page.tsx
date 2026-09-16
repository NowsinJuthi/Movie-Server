"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileForm, type ProfileFormValues } from "@/components/profiles/profile-form";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { ApiError } from "@/lib/api";
import { profileApi } from "@/lib/profile-api";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";

export default function NewProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useAuthStore();
  const setActiveProfile = useProfileStore((state) => state.setActiveProfile);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [status, router]);

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      profileApi.create({
        name: values.name.trim(),
        avatarKey: values.avatarKey,
        isKids: values.isKids,
        language: values.language,
        audioLanguage: values.audioLanguage,
        subtitleLanguage: values.subtitleLanguage,
        maturityLevel: values.isKids ? "kids" : values.maturityLevel,
        pin: values.pin?.trim() ? values.pin.trim() : undefined,
      }),
    onSuccess: async (data) => {
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["active-profile"] });
      try {
        const selected = await profileApi.select(data.profile.id);
        setActiveProfile(selected.profile);
        router.push("/home");
      } catch {
        router.push("/profiles");
      }
    },
    onError: (error: unknown) => {
      setFormError(error instanceof ApiError ? error.message : "Could not create profile.");
    },
  });

  if (status !== "authenticated") {
    return <ScreenMessage>Loading...</ScreenMessage>;
  }

  return (
    <main className="auth-backdrop mx-auto min-h-screen max-w-xl px-6 py-16">
      <h1 className="mb-8 text-3xl font-semibold">Add profile</h1>
      <ProfileForm
        submitLabel="Create"
        busy={mutation.isPending}
        error={formError}
        onSubmit={(values) => {
          setFormError(null);
          mutation.mutate(values);
        }}
      />
    </main>
  );
}
