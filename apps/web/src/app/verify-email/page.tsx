import { Suspense } from "react";
import VerifyEmailForm from "./verify-form";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="auth-backdrop min-h-screen" />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
