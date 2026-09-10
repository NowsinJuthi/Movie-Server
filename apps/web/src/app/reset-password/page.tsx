import { Suspense } from "react";
import ResetPasswordForm from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-backdrop min-h-screen" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
