"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { Button } from "@/components/ui/button";
import { profileApi } from "@/lib/profile-api";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect } from "react";

export default function ManageProfilesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useAuthStore();
  const query = useQuery({
    queryKey: ["profiles"],
    queryFn: profileApi.list,
    enabled: status === "authenticated",
  });

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [status, router]);

  const remove = useMutation({
    mutationFn: profileApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profiles"] }),
  });

  if (status !== "authenticated") {
    return <ScreenMessage>Loading...</ScreenMessage>;
  }

  const profiles = query.data?.profiles ?? [];

  return (
    <main className="auth-backdrop min-h-screen px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-center text-4xl font-semibold">Manage profiles</h1>
        <div className="mt-12 flex flex-wrap justify-center gap-8">
          {profiles.map((profile) => (
            <div key={profile.id} className="flex w-32 flex-col items-center gap-3">
              <button type="button" onClick={() => router.push(`/profiles/${profile.id}/edit`)}>
                <span className="relative block">
                  <ProfileAvatar profile={profile} />
                  <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50">
                    <Pencil className="h-7 w-7" />
                  </span>
                </span>
              </button>
              <span className="text-sm">{profile.name}</span>
              {profiles.length > 1 ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(profile.id)}
                >
                  Delete
                </button>
              ) : null}
            </div>
          ))}
          {profiles.length < 5 ? (
            <button
              type="button"
              onClick={() => router.push("/profiles/new")}
              className="flex w-32 flex-col items-center gap-3 text-muted-foreground"
            >
              <span className="flex h-32 w-32 items-center justify-center rounded-md bg-secondary">
                <Plus className="h-10 w-10" />
              </span>
              <span className="text-sm">Add profile</span>
            </button>
          ) : null}
        </div>
        <div className="mt-12 text-center">
          <Button variant="outline" onClick={() => router.push("/profiles")}>
            Done
          </Button>
        </div>
      </div>
    </main>
  );
}
