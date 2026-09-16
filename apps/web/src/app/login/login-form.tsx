"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import { profileApi } from "@/lib/profile-api";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((state) => state.setUser);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data) => {
      setUser(data.user);
      const next = searchParams.get("next");
      if (next?.startsWith("/admin")) {
        router.push(next);
        return;
      }
      const destination =
        next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
      try {
        const active = await profileApi.active();
        if (active.profile) {
          useProfileStore.getState().setActiveProfile(active.profile);
          router.push(destination);
          return;
        }
      } catch {
        /* fall through */
      }
      try {
        const listed = await profileApi.list();
        if (listed.profiles.length === 1 && !listed.profiles[0]?.hasPin) {
          const selected = await profileApi.select(listed.profiles[0].id);
          useProfileStore.getState().setActiveProfile(selected.profile);
          router.push(destination);
          return;
        }
      } catch {
        /* fall through to profile picker */
      }
      router.push(next ? `/profiles?next=${encodeURIComponent(next)}` : "/profiles");
    },
    onError: (error: unknown) => {
      setFormError(error instanceof ApiError ? error.message : "Unable to sign in.");
    },
  });

  return (
    <AuthShell title="Sign in" description="Access your private media library.">
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          setFormError(null);
          mutation.mutate(values);
        })}
      >
        {formError ? <Alert>{formError}</Alert> : null}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
        </div>
        <Button className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Signing in..." : "Sign in"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="text-foreground underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
