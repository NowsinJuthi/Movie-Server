"use client";

import { ErrorCode, type PublicProfile } from "@movie-server/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { PinDialog, ScreenMessage } from "@/components/profiles/pin-dialog";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { profileApi } from "@/lib/profile-api";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";

export default function ProfilesForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, status } = useAuthStore();
  const nextPath = searchParams.get("next");
  const setProfiles = useProfileStore((state) => state.setProfiles);
  const setActiveProfile = useProfileStore((state) => state.setActiveProfile);
  const [pinProfile, setPinProfile] = useState<PublicProfile | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["profiles"],
    queryFn: profileApi.list,
    enabled: status === "authenticated",
  });

  const activeQuery = useQuery({
    queryKey: ["active-profile"],
    queryFn: profileApi.active,
    enabled: status === "authenticated",
  });

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (query.data) {
      setProfiles(query.data.profiles);
    }
  }, [query.data, setProfiles]);

  useEffect(() => {
    if (!activeQuery.data?.profile) return;
    setActiveProfile(activeQuery.data.profile);
    const destination =
      nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/home";
    router.replace(destination);
  }, [activeQuery.data, nextPath, router, setActiveProfile]);

  useEffect(() => {
    if (activeQuery.isLoading || activeQuery.data?.profile || pinProfile) return;
    const profiles = query.data?.profiles ?? [];
    if (profiles.length === 0) return;
    const lastSelected = [...profiles].sort((a, b) =>
      (b.lastSelectedAt ?? "").localeCompare(a.lastSelectedAt ?? ""),
    )[0];
    if (lastSelected?.hasPin && lastSelected.lastSelectedAt) {
      setPinProfile(lastSelected);
    }
  }, [activeQuery.data?.profile, activeQuery.isLoading, pinProfile, query.data?.profiles]);

  const selectMutation = useMutation({
    mutationFn: ({ id, pin }: { id: string; pin?: string }) => profileApi.select(id, pin),
    onSuccess: (data) => {
      setActiveProfile(data.profile);
      const destination =
        nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/home";
      router.push(destination);
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.error === ErrorCode.ProfilePinRequired && pinProfile) {
        return;
      }
      setPinError(error instanceof ApiError ? error.message : "Could not switch profile.");
    },
  });

  if (status === "loading" || status === "idle" || !user) {
    return <ScreenMessage>Loading profiles...</ScreenMessage>;
  }

  const profiles = query.data?.profiles ?? [];

  async function choose(profile: PublicProfile) {
    setPinError(null);
    if (profile.hasPin) {
      setPinProfile(profile);
      return;
    }
    selectMutation.mutate({ id: profile.id });
  }

  return (
    <main className="auth-backdrop flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Who&apos;s watching?</h1>
      <div className="mt-12 flex flex-wrap justify-center gap-8">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => choose(profile)}
            className="group flex w-32 flex-col items-center gap-3"
          >
            <span className="ring-offset-background group-hover:ring-2 group-hover:ring-white rounded-md">
              <ProfileAvatar profile={profile} />
            </span>
            <span className="text-sm text-muted-foreground group-hover:text-foreground">{profile.name}</span>
          </button>
        ))}
        {profiles.length < 5 ? (
          <button
            type="button"
            onClick={() => router.push("/profiles/new")}
            className="flex w-32 flex-col items-center gap-3 text-muted-foreground hover:text-foreground"
          >
            <span className="flex h-32 w-32 items-center justify-center rounded-md bg-secondary">
              <Plus className="h-10 w-10" />
            </span>
            <span className="text-sm">Add profile</span>
          </button>
        ) : null}
      </div>
      <Button className="mt-14" variant="outline" onClick={() => router.push("/profiles/manage")}>
        <Pencil className="h-4 w-4" />
        Manage profiles
      </Button>
      <PinDialog
        open={Boolean(pinProfile)}
        title={pinProfile ? `Unlock ${pinProfile.name}` : "PIN"}
        error={pinError}
        submitting={selectMutation.isPending}
        onClose={() => {
          setPinProfile(null);
          setPinError(null);
        }}
        onSubmit={(pin) => {
          if (pinProfile) {
            selectMutation.mutate({ id: pinProfile.id, pin });
          }
        }}
      />
    </main>
  );
}
