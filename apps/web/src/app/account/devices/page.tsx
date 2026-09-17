"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { PageShell } from "@/components/layout/page-shell";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";
import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth-api";
import { deviceApi } from "@/lib/device-api";
import { streamApi } from "@/lib/stream-api";

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatDeviceLabel(value: string | null | undefined) {
  if (!value) {
    return "Unknown device";
  }
  if (value.length <= 48) {
    return value;
  }
  return `${value.slice(0, 45)}…`;
}

export default function DevicesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status, clear } = useAuthStore();
  const clearProfile = useProfileStore((state) => state.clear);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const overview = useQuery({
    queryKey: ["device-overview"],
    queryFn: deviceApi.overview,
    enabled: status === "authenticated",
  });

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login?next=/account/devices");
    }
  }, [status, router]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["device-overview"] });
  };

  const signOutIfCurrent = async (current: boolean) => {
    if (!current) {
      await refresh();
      return;
    }
    await authApi.logout();
    clear();
    clearProfile();
    router.push("/login");
  };

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => deviceApi.rename(id, name),
    onSuccess: async () => {
      setRenameId(null);
      await refresh();
    },
  });
  const revokeDevice = useMutation({
    mutationFn: deviceApi.revoke,
    onSuccess: async (data) => signOutIfCurrent(data.current),
  });
  const revokeSession = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: async (data) => signOutIfCurrent(data.current),
  });
  const stopStream = useMutation({
    mutationFn: streamApi.stop,
    onSuccess: refresh,
  });
  const logoutAll = useMutation({
    mutationFn: authApi.logoutAll,
    onSuccess: () => {
      clear();
      clearProfile();
      router.push("/login");
    },
  });

  if (status === "loading" || status === "idle") {
    return <ScreenMessage>Loading devices...</ScreenMessage>;
  }

  const data = overview.data;
  const error =
    overview.error instanceof ApiError
      ? overview.error.message
      : rename.error instanceof ApiError
        ? rename.error.message
        : revokeDevice.error instanceof ApiError
          ? revokeDevice.error.message
          : revokeSession.error instanceof ApiError
            ? revokeSession.error.message
            : stopStream.error instanceof ApiError
              ? stopStream.error.message
              : logoutAll.error instanceof ApiError
                ? logoutAll.error.message
                : null;

  return (
    <PageShell
      title="Devices & sessions"
      description={`Playback limits are enforced on the server from your plan${
        data ? ` (${data.deviceCount}/${data.maxDevices} devices · ${data.streamCount}/${data.maxStreams} streams)` : ""
      }.`}
      error={error}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/account/subscription">Subscription</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/home">Back</Link>
          </Button>
        </div>
      }
    >
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-medium">Devices</h2>
            <Button variant="secondary" disabled={logoutAll.isPending} onClick={() => logoutAll.mutate()}>
              {logoutAll.isPending ? "Signing out..." : "Sign out all devices"}
            </Button>
          </div>
          {(data?.devices ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No devices registered yet. Playback registers a device automatically.</p>
          ) : (
            <ul className="space-y-3">
              {data?.devices.map((device) => (
                <li key={device.id} className="rounded-md border border-border px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      {renameId === device.id ? (
                        <form
                          className="flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            rename.mutate({ id: device.id, name: renameValue });
                          }}
                        >
                          <Input
                            value={renameValue}
                            onChange={(event) => setRenameValue(event.target.value)}
                            maxLength={80}
                            aria-label="Device name"
                          />
                          <Button type="submit" size="sm" disabled={rename.isPending}>
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setRenameId(null)}>
                            Cancel
                          </Button>
                        </form>
                      ) : (
                        <p className="font-medium">
                          {device.name}
                          {device.current ? <span className="ml-2 text-xs text-primary">This device</span> : null}
                          {device.playing ? <span className="ml-2 text-xs text-primary">Playing</span> : null}
                        </p>
                      )}
                      <p className="text-sm capitalize text-muted-foreground">
                        {device.type}
                        {device.browser ? ` · ${device.browser}` : ""}
                        {device.platform ? ` · ${device.platform}` : ""}
                        {device.countsTowardLimit ? "" : " · login only"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {device.ip ? `IP ${device.ip} · ` : ""}Last active {formatTime(device.lastActiveAt)}
                      </p>
                      {device.suspicious ? (
                        <p className="text-xs text-destructive">Flagged: {(device.flags ?? []).join(", ") || "suspicious activity"}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      {renameId === device.id ? null : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRenameId(device.id);
                            setRenameValue(device.name);
                          }}
                        >
                          Rename
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={revokeDevice.isPending}
                        onClick={() => revokeDevice.mutate(device.id)}
                      >
                        Sign out
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-xl font-medium">Signed-in sessions</h2>
          {(data?.sessions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          ) : (
            <ul className="space-y-3">
              {data?.sessions.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3">
                  <div>
                    <p className="font-medium">
                      {session.deviceName || session.browser || "Session"}
                      {session.current ? <span className="ml-2 text-xs text-primary">Current</span> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {session.deviceType ?? "unknown"} · expires {formatTime(session.expiresAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.ip ? `IP ${session.ip} · ` : ""}Last active {formatTime(session.lastActiveAt)}
                    </p>
                  </div>
                  {session.current ? null : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={revokeSession.isPending}
                      onClick={() => revokeSession.mutate(session.id)}
                    >
                      Sign out
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-xl font-medium">Active playback</h2>
          {(data?.streams ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is playing right now.</p>
          ) : (
            <ul className="space-y-3">
              {data?.streams.map((stream) => (
                <li key={stream.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3">
                  <div>
                    <p className="font-medium">{stream.mediaTitle || "Unknown title"}</p>
                    <p className="text-sm text-muted-foreground">
                      {stream.quality.toUpperCase()} · {formatDeviceLabel(stream.deviceName || stream.deviceKey)} · started{" "}
                      {formatTime(stream.startedAt)}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" disabled={stopStream.isPending} onClick={() => stopStream.mutate(stream.id)}>
                    Stop stream
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
    </PageShell>
  );
}
