"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ProfileForm, type ProfileFormValues } from "@/components/profiles/profile-form";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { profileApi } from "@/lib/profile-api";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect } from "react";

export default function NewProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useAuthStore();

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [status, router]);

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      profileApi.create({
        name: values.name,
        avatarKey: values.avatarKey,
        isKids: values.isKids,
        language: values.language,
        audioLanguage: values.audioLanguage,
        subtitleLanguage: values.subtitleLanguage,
        maturityLevel: values.isKids ? "kids" : values.maturityLevel,
        pin: values.pin || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      router.push("/profiles");
    },
  });

  if (status !== "authenticated") {
    return <ScreenMessage>Loading...</ScreenMessage>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16">
      <h1 className="mb-8 text-3xl font-semibold">Add profile</h1>
      <ProfileForm submitLabel="Create" busy={mutation.isPending} onSubmit={(values) => mutation.mutate(values)} />
    </main>
  );
}
