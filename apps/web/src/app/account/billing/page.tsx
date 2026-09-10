"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { billingApi } from "@/lib/billing-api";
import { formatCents } from "@/lib/subscription-api";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { PageShell } from "@/components/layout/page-shell";
import { useAuthStore } from "@/stores/auth-store";

export default function BillingHistoryPage() {
  const { status } = useAuthStore();
  const query = useQuery({
    queryKey: ["billing-history"],
    queryFn: billingApi.history,
    enabled: status === "authenticated",
  });

  if (status === "loading" || status === "idle") {
    return <ScreenMessage>Loading billing history...</ScreenMessage>;
  }

  return (
    <PageShell
      title="Billing history"
      description="Invoices and payment transactions for your account."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/account/devices">Devices</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/account/subscription">Subscription</Link>
          </Button>
        </div>
      }
    >
        <section>
          <h2 className="mb-3 text-xl font-medium">Invoices</h2>
          {(query.data?.invoices ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <ul className="space-y-2">
              {query.data?.invoices.map((invoice) => (
                <li key={invoice.id} className="rounded-md border border-border px-4 py-3 text-sm">
                  <span className="font-medium">{invoice.number}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {invoice.status} · {formatCents(invoice.amountCents, invoice.currency)}
                  </span>
                  <p className="text-muted-foreground">{new Date(invoice.issuedAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-xl font-medium">Transactions</h2>
          {(query.data?.payments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <ul className="space-y-2">
              {query.data?.payments.map((payment) => (
                <li key={payment.id} className="rounded-md border border-border px-4 py-3 text-sm">
                  <span className="font-medium capitalize">{payment.kind}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {payment.status} · {formatCents(payment.amountCents, payment.currency)}
                  </span>
                  <p className="text-muted-foreground">
                    {payment.providerPaymentId ?? payment.providerSessionId ?? payment.provider}
                    {payment.cardLast4 ? ` · ${payment.cardBrand ?? "card"} •••• ${payment.cardLast4}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
    </PageShell>
  );
}
