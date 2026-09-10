import type { CheckoutResponse, PublicInvoice, PublicPayment } from "@movie-server/shared";
import { apiFetch } from "./api";

export const billingApi = {
  checkout: (input: { subscriptionId?: string; kind?: "checkout" | "renewal" } = {}) =>
    apiFetch<CheckoutResponse>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  verify: (sessionId: string) =>
    apiFetch<{ payment: PublicPayment; providerStatus: string }>("/billing/checkout/verify", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    }),
  simulate: (paymentId: string) =>
    apiFetch<{ payment: PublicPayment; providerStatus: string }>(`/billing/checkout/${paymentId}/simulate`, {
      method: "POST",
    }),
  history: () => apiFetch<{ payments: PublicPayment[]; invoices: PublicInvoice[] }>("/billing/history"),
  adminList: () =>
    apiFetch<{ payments: PublicPayment[]; invoices: PublicInvoice[] }>("/admin/billing/payments"),
  refund: (id: string, amountCents?: number) =>
    apiFetch<{ payment: PublicPayment }>(`/admin/billing/payments/${id}/refund`, {
      method: "POST",
      body: JSON.stringify(amountCents ? { amountCents } : {}),
    }),
};
