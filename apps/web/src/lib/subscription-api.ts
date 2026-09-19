import type {
  BillingCycle,
  PublicPlan,
  PublicSubscription,
  PublicSubscriptionEvent,
  SubscriptionEntitlement,
  VideoQuality,
} from "@movie-server/shared";
import { apiFetch } from "./api";

export const subscriptionApi = {
  plans: () => apiFetch<{ plans: PublicPlan[] }>("/plans"),
  me: () =>
    apiFetch<{ subscription: PublicSubscription | null; entitlement: SubscriptionEntitlement }>(
      "/subscriptions/me",
    ),
  entitlement: () => apiFetch<{ entitlement: SubscriptionEntitlement }>("/subscriptions/me/entitlement"),
  history: () => apiFetch<{ events: PublicSubscriptionEvent[] }>("/subscriptions/me/history"),
  changes: () => apiFetch<{ events: PublicSubscriptionEvent[] }>("/subscriptions/me/changes"),
  start: (planSlug: string, billingCycle: BillingCycle) =>
    apiFetch<{
      subscription: PublicSubscription;
      paymentRequired: boolean;
      entitlement: SubscriptionEntitlement;
    }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({ planSlug, billingCycle }),
    }),
  change: (planSlug: string, billingCycle: BillingCycle) =>
    apiFetch<{ subscription: PublicSubscription; entitlement: SubscriptionEntitlement }>(
      "/subscriptions/me/change",
      { method: "POST", body: JSON.stringify({ planSlug, billingCycle }) },
    ),
  cancel: () =>
    apiFetch<{ subscription: PublicSubscription; entitlement: SubscriptionEntitlement }>(
      "/subscriptions/me/cancel",
      { method: "POST" },
    ),
  resume: () =>
    apiFetch<{ subscription: PublicSubscription; entitlement: SubscriptionEntitlement }>(
      "/subscriptions/me/resume",
      { method: "POST" },
    ),
  playbackAuth: (quality: VideoQuality, currentStreamCount = 0) =>
    apiFetch<{ allowed: boolean; entitlement: SubscriptionEntitlement }>("/content/playback-auth", {
      method: "POST",
      body: JSON.stringify({ quality, currentStreamCount }),
    }),
  adminPlans: () => apiFetch<{ plans: PublicPlan[] }>("/admin/plans"),
  createPlan: (input: Record<string, unknown>) =>
    apiFetch<{ plan: PublicPlan }>("/admin/plans", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updatePlan: (id: string, input: Record<string, unknown>) =>
    apiFetch<{ plan: PublicPlan }>(`/admin/plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  disablePlan: (id: string) =>
    apiFetch<{ plan: PublicPlan; message: string }>(`/admin/plans/${id}`, { method: "DELETE" }),
};

const CURRENCY_LOCALE: Record<string, string> = {
  BDT: "en-BD",
  USD: "en-US",
};

export function formatCents(cents: number, currency = "BDT"): string {
  const code = (currency || "BDT").toUpperCase();
  const locale = CURRENCY_LOCALE[code] ?? "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(cents / 100);
}
