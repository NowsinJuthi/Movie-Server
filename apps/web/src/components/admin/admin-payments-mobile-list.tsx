"use client";

import type { PublicInvoice, PublicPayment } from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/subscription-api";
import { cn } from "@/lib/utils";
import styles from "./admin-list-mobile.module.css";

export function AdminPaymentsMobileList({
  payments,
  onRefund,
}: {
  payments: PublicPayment[];
  onRefund: (id: string) => void;
}) {
  if (payments.length === 0) {
    return <p className={styles.empty}>No transactions.</p>;
  }

  return (
    <ul className={styles.list}>
      {payments.map((payment) => (
        <li key={payment.id} className={styles.card}>
          <div className={styles.cardHead}>
            <p className={styles.title}>{formatCents(payment.amountCents, payment.currency)}</p>
            <span className={styles.badge}>{payment.status}</span>
          </div>
          <p className={styles.subtitle}>{new Date(payment.createdAt).toLocaleString()}</p>
          <div className={styles.metaGrid}>
            <div className={styles.metaCell}>
              <p className={styles.metaLabel}>Kind</p>
              <p className={cn(styles.metaValue, "capitalize")}>{payment.kind}</p>
            </div>
            <div className={styles.metaCellWide}>
              <p className={styles.metaLabel}>Provider</p>
              <p className={cn(styles.metaValue, "font-mono text-xs font-normal")}>
                {payment.providerPaymentId ?? payment.providerSessionId ?? "—"}
              </p>
            </div>
          </div>
          {payment.status === "success" ? (
            <div className={styles.actions}>
              <Button type="button" size="sm" variant="outline" className={styles.actionBtn} onClick={() => onRefund(payment.id)}>
                Refund
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function AdminInvoicesMobileList({ invoices }: { invoices: PublicInvoice[] }) {
  if (invoices.length === 0) {
    return <p className={styles.empty}>No invoices.</p>;
  }

  return (
    <ul className={styles.list}>
      {invoices.map((invoice) => (
        <li key={invoice.id} className={styles.card}>
          <div className={styles.cardHead}>
            <p className={styles.title}>{invoice.number}</p>
            <span className={styles.badge}>{invoice.status}</span>
          </div>
          <div className={styles.metaGrid}>
            <div className={styles.metaCell}>
              <p className={styles.metaLabel}>Amount</p>
              <p className={styles.metaValue}>{formatCents(invoice.amountCents, invoice.currency)}</p>
            </div>
            <div className={styles.metaCell}>
              <p className={styles.metaLabel}>Issued</p>
              <p className={styles.metaValue}>{new Date(invoice.issuedAt).toLocaleDateString()}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
