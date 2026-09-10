"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { billingApi } from "@/lib/billing-api";
import { formatCents } from "@/lib/subscription-api";
import { ApiError } from "@/lib/api";
import { ScreenMessage } from "@/components/profiles/pin-dialog";

function ReturnInner() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const cancelled = params.get("cancelled");
  const [message, setMessage] = useState(
    sessionId ? "Confirming payment with the provider..." : "Missing checkout session.",
  );
  const verify = useMutation({
    mutationFn: (id: string) => billingApi.verify(id),
    onSuccess: (data) => {
      if (data.payment.status === "success") {
        setMessage("Payment verified. Your subscription is active.");
      } else if (data.payment.status === "cancelled" || cancelled) {
        setMessage("Checkout was cancelled. No charge was captured.");
      } else if (data.payment.status === "failed") {
        setMessage("Payment failed. You can try again from your subscription page.");
      } else {
        setMessage("Payment is still pending. If you already paid, wait a moment and refresh.");
      }
    },
    onError: (error: unknown) => {
      setMessage(error instanceof ApiError ? error.message : "Unable to verify payment.");
    },
  });

  useEffect(() => {
    if (sessionId) {
      verify.mutate(sessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const payment = verify.data?.payment;
  const canSimulate = payment && payment.status === "pending" && payment.provider === "fake";

  return (
    <main className="min-h-screen bg-background p-3 sm:p-4 md:p-5 lg:p-6">
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card/40 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">Payment</h1>
        <p className="mt-3 text-muted-foreground">{message}</p>
        {payment ? (
          <p className="mt-4 text-sm">
            {formatCents(payment.amountCents, payment.currency)} · {payment.status}
          </p>
        ) : null}
        {verify.error instanceof ApiError ? <Alert className="mt-4">{verify.error.message}</Alert> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          {canSimulate ? (
            <Button
              onClick={async () => {
                const result = await billingApi.simulate(payment.id);
                if (result.payment.status === "success") {
                  setMessage("Simulated payment captured. Subscription activated.");
                }
              }}
            >
              Simulate successful payment
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/account/subscription">Back to subscription</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function BillingReturnPage() {
  return (
    <Suspense fallback={<ScreenMessage>Loading checkout result...</ScreenMessage>}>
      <ReturnInner />
    </Suspense>
  );
}
