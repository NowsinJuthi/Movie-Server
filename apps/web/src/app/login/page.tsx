import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-backdrop min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}
