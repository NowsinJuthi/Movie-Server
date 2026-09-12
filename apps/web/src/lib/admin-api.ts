import type {
  AdminAuditLog,
  AdminCatalogTerm,
  AdminDashboard,
  AdminHealth,
  AdminHomeHero,
  AdminHomeRow,
  AdminJobsResponse,
  AdminPage,
  AdminProfileRow,
  AdminTrackRow,
  AdminUserRow,
  PublicInvoice,
  PublicPlan,
  PublicSubscription,
  PublicUser,
  UserRole,
} from "@movie-server/shared";
import { apiFetch } from "./api";

function qs(query: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "" || value === null) continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export const adminApi = {
  dashboard: () => apiFetch<AdminDashboard>("/admin/dashboard"),
  health: () => apiFetch<AdminHealth>("/admin/health"),
  jobs: () => apiFetch<AdminJobsResponse>("/admin/jobs"),
  audit: (query: { q?: string; page?: number; limit?: number } = {}) =>
    apiFetch<AdminPage<AdminAuditLog>>(`/admin/audit${qs(query)}`),
  users: (query: { q?: string; role?: string; isActive?: boolean; sort?: string; page?: number; limit?: number } = {}) =>
    apiFetch<AdminPage<AdminUserRow> & { users: PublicUser[] }>(`/admin/users${qs(query)}`),
  userSuggest: (query: { q: string; limit?: number }) =>
    apiFetch<{
      users: Array<{
        id: string;
        displayName: string;
        email: string;
        role: string;
        isActive: boolean;
      }>;
    }>(`/admin/users/suggest${qs(query)}`),
  createUser: (input: {
    email: string;
    displayName: string;
    password: string;
    role?: UserRole;
    emailVerified?: boolean;
  }) =>
    apiFetch<{ user: AdminUserRow }>("/admin/users", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  patchUser: (
    id: string,
    input: {
      displayName?: string;
      email?: string;
      isActive?: boolean;
      emailVerified?: boolean;
      role?: UserRole;
      password?: string;
    },
  ) =>
    apiFetch<{ user: AdminUserRow }>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteUser: (id: string) =>
    apiFetch<{ message: string; id: string }>(`/admin/users/${id}`, { method: "DELETE" }),
  updateRole: (id: string, role: UserRole) =>
    apiFetch<{ user: PublicUser }>(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  profiles: (query: { q?: string; userId?: string; page?: number; limit?: number } = {}) =>
    apiFetch<AdminPage<AdminProfileRow>>(`/admin/profiles${qs(query)}`),
  profileSuggest: (query: { q: string; limit?: number }) =>
    apiFetch<{
      profiles: Array<{
        id: string;
        name: string;
        userDisplayName: string;
        userEmail: string;
      }>;
    }>(`/admin/profiles/suggest${qs(query)}`),
  deleteProfile: (id: string) => apiFetch<{ message: string }>(`/admin/profiles/${id}`, { method: "DELETE" }),
  subscriptions: (query: { userId?: string; status?: string } = {}) =>
    apiFetch<{ subscriptions: PublicSubscription[] }>(`/admin/subscriptions${qs(query)}`),
  grantSubscription: (input: { userId: string; planSlug: string; billingCycle: string }) =>
    apiFetch<{ subscription: PublicSubscription }>("/admin/subscriptions", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  suspendSubscription: (id: string, reason?: string) =>
    apiFetch<{ subscription: PublicSubscription }>(`/admin/subscriptions/${id}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  unsuspendSubscription: (id: string) =>
    apiFetch<{ subscription: PublicSubscription }>(`/admin/subscriptions/${id}/unsuspend`, { method: "POST" }),
  invoices: () => apiFetch<{ invoices: PublicInvoice[] }>("/admin/billing/invoices"),
  tracks: (query: { q?: string; kind?: string; page?: number; limit?: number } = {}) =>
    apiFetch<AdminPage<AdminTrackRow>>(`/admin/tracks${qs(query)}`),
  genres: (q?: string) => apiFetch<{ items: AdminCatalogTerm[] }>(`/admin/catalog/genres${qs({ q })}`),
  tags: (q?: string) => apiFetch<{ items: AdminCatalogTerm[] }>(`/admin/catalog/tags${qs({ q })}`),
  createTerm: (kind: "genres" | "tags", name: string) =>
    apiFetch<{ item: AdminCatalogTerm }>(`/admin/catalog/${kind}`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updateTerm: (kind: "genres" | "tags", id: string, input: { name?: string; enabled?: boolean }) =>
    apiFetch<{ item: AdminCatalogTerm }>(`/admin/catalog/${kind}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteTerm: (kind: "genres" | "tags", id: string) =>
    apiFetch<{ deleted: boolean }>(`/admin/catalog/${kind}/${id}`, { method: "DELETE" }),
  homeHero: () => apiFetch<{ hero: AdminHomeHero }>("/admin/home/hero"),
  updateHomeHero: (input: Partial<AdminHomeHero>) =>
    apiFetch<{ hero: AdminHomeHero }>("/admin/home/hero", { method: "PATCH", body: JSON.stringify(input) }),
  homeRows: () => apiFetch<{ rows: AdminHomeRow[] }>("/admin/home/rows"),
  createHomeRow: (input: Partial<AdminHomeRow> & { title: string; kind: string }) =>
    apiFetch<{ row: AdminHomeRow }>("/admin/home/rows", { method: "POST", body: JSON.stringify(input) }),
  updateHomeRow: (id: string, input: Partial<AdminHomeRow>) =>
    apiFetch<{ row: AdminHomeRow }>(`/admin/home/rows/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteHomeRow: (id: string) => apiFetch<{ deleted: boolean }>(`/admin/home/rows/${id}`, { method: "DELETE" }),
  plans: () => apiFetch<{ plans: PublicPlan[] }>("/admin/plans"),
};
