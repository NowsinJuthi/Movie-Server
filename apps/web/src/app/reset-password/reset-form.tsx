"use client";

import { useSearchParams } from "next/navigation";
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
import Link from "next/link";

const schema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters").max(72),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => authApi.resetPassword(token, values.password),
    onSuccess: (data) => setSuccess(data.message),
    onError: (error: unknown) => {
      setFormError(error instanceof ApiError ? error.message : "Unable to reset password.");
    },
  });

  return (
    <AuthShell title="Reset password" description="Choose a new password for your account.">
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          setFormError(null);
          mutation.mutate(values);
        })}
      >
        {formError ? <Alert>{formError}</Alert> : null}
        {success ? (
          <p className="rounded-md bg-secondary px-3 py-2 text-sm">
            {success}{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
        </div>
        <Button className="w-full" disabled={mutation.isPending || !token}>
          {mutation.isPending ? "Updating..." : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}
