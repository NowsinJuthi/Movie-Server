"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { billingApi } from "@/lib/billing-api";
import { formatCents } from "@/lib/subscription-api";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

export default function AdminBillingPage() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const payments = useQuery({ queryKey: ["admin-billing"], queryFn: billingApi.adminList });
  const invoices = useQuery({ queryKey: ["admin-invoices"], queryFn: adminApi.invoices });
  const refund = useMutation({
    mutationFn: (id: string) => billingApi.refund(id),
    onSuccess: async () => {
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
    },
  });
  const error =
    payments.error instanceof ApiError
      ? payments.error.message
      : invoices.error instanceof ApiError
        ? invoices.error.message
        : refund.error instanceof ApiError
          ? refund.error.message
          : null;

  return (
    <AdminPage title="Payments & invoices" description="Card numbers are never stored. Refunds are processed through the configured provider." error={error}>
      <h2 className="mb-3 text-lg font-medium">Transactions</h2>
      <AdminTable columns={["When", "Kind", "Status", "Amount", "Provider", ""]}>
        {(payments.data?.payments ?? []).map((payment) => (
          <tr key={payment.id}>
            <AdminTd>{new Date(payment.createdAt).toLocaleString()}</AdminTd>
            <AdminTd className="capitalize">{payment.kind}</AdminTd>
            <AdminTd>{payment.status}</AdminTd>
            <AdminTd>{formatCents(payment.amountCents, payment.currency)}</AdminTd>
            <AdminTd className="font-mono text-xs">{payment.providerPaymentId ?? payment.providerSessionId ?? "—"}</AdminTd>
            <AdminTd>
              {payment.status === "success" ? (
                <Button size="sm" variant="outline" onClick={() => setPending(payment.id)}>
                  Refund
                </Button>
              ) : null}
            </AdminTd>
          </tr>
        ))}
      </AdminTable>
      <h2 className="mb-3 mt-8 text-lg font-medium">Invoices</h2>
      <AdminTable columns={["Number", "Status", "Amount", "Issued"]}>
        {(invoices.data?.invoices ?? payments.data?.invoices ?? []).map((invoice) => (
          <tr key={invoice.id}>
            <AdminTd>{invoice.number}</AdminTd>
            <AdminTd>{invoice.status}</AdminTd>
            <AdminTd>{formatCents(invoice.amountCents, invoice.currency)}</AdminTd>
            <AdminTd>{new Date(invoice.issuedAt).toLocaleString()}</AdminTd>
          </tr>
        ))}
      </AdminTable>
      <ConfirmDialog
        open={Boolean(pending)}
        title="Refund this payment?"
        description="The refund is executed on the server through the payment provider. This cannot be undone from the UI."
        confirmLabel="Refund"
        pending={refund.isPending}
        onClose={() => setPending(null)}
        onConfirm={() => pending && refund.mutate(pending)}
      />
    </AdminPage>
  );
}
