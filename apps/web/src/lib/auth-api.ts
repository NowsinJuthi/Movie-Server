import { AUTH_ROUTES, type PublicAuthSession, type PublicUser } from "@movie-server/shared";
import { apiFetch, refreshSession, type AuthResponse } from "./api";
import { getDeviceId } from "./device";

export const authApi = {
  register: (input: { email: string; displayName: string; password: string }) =>
    apiFetch<AuthResponse>(AUTH_ROUTES.Register, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  login: (input: { email: string; password: string }) =>
    apiFetch<AuthResponse>(AUTH_ROUTES.Login, {
      method: "POST",
      body: JSON.stringify({ ...input, deviceId: getDeviceId() }),
    }),
  logout: () =>
    apiFetch<{ message: string }>(AUTH_ROUTES.Logout, { method: "POST" }),
  logoutAll: () =>
    apiFetch<{ message: string }>(AUTH_ROUTES.LogoutAll, { method: "POST" }),
  me: () => apiFetch<{ user: PublicUser }>(AUTH_ROUTES.Me),
  refresh: () => refreshSession(),
  sessions: () => apiFetch<{ sessions: PublicAuthSession[] }>(AUTH_ROUTES.Sessions),
  revokeSession: (id: string) =>
    apiFetch<{ message: string; current: boolean }>(AUTH_ROUTES.Session.replace(":id", id), {
      method: "DELETE",
    }),
  verifyEmail: (token: string) =>
    apiFetch<{ message: string }>(AUTH_ROUTES.VerifyEmail, {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  resendVerification: (email: string) =>
    apiFetch<{ message: string }>(AUTH_ROUTES.ResendVerification, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>(AUTH_ROUTES.ForgotPassword, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    apiFetch<{ message: string }>(AUTH_ROUTES.ResetPassword, {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
};
