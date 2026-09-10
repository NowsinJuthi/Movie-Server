"use client";

import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import Link from "next/link";

export default function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(token ? null : "Missing verification token.");

  const mutation = useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: (data) => setMessage(data.message),
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Verification failed.");
    },
  });

  useEffect(() => {
    if (token) {
      mutation.mutate(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthShell title="Verify email" description="Confirming your CineVault account.">
      <div className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        {message ? <p className="rounded-md bg-secondary px-3 py-2 text-sm">{message}</p> : null}
        <Button asChild className="w-full">
          <Link href="/login">Continue to sign in</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
