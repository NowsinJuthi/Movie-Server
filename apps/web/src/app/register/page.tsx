"use client";

import Link from "next/link";
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

const schema = z.object({
  displayName: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      setSuccess(data.message ?? "Check your email to verify your account.");
    },
    onError: (error: unknown) => {
      setFormError(error instanceof ApiError ? error.message : "Unable to create the account.");
    },
  });

  return (
    <AuthShell title="Create an account" description="Start with a verified AmarPin profile.">
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          setFormError(null);
          mutation.mutate(values);
        })}
      >
        {formError ? <Alert>{formError}</Alert> : null}
        {success ? <p className="rounded-md bg-secondary px-3 py-2 text-sm">{success}</p> : null}
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" autoComplete="name" {...form.register("displayName")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
        </div>
        <Button className="w-full" disabled={mutation.isPending || Boolean(success)}>
          {mutation.isPending ? "Creating account..." : "Create account"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="text-foreground underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
