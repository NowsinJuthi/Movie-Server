"use client";

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

const schema = z.object({ email: z.string().email() });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => authApi.forgotPassword(values.email),
    onSuccess: (data) => setSuccess(data.message),
    onError: (error: unknown) => {
      setFormError(error instanceof ApiError ? error.message : "Unable to send reset email.");
    },
  });

  return (
    <AuthShell title="Forgot password" description="We will email a reset link if the account exists.">
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
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        </div>
        <Button className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Sending..." : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}
