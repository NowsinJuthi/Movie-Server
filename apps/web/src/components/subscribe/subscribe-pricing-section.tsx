"use client";

import {
  BillingCycle,
  PlanFeature,
  PlanTier,
  type PublicPlan,
} from "@movie-server/shared";
import { Alert } from "@/components/ui/alert";
import { formatCents } from "@/lib/subscription-api";
import { cn } from "@/lib/utils";
import { PlanTierIcon, planVisualVariant, type PlanVisualVariant } from "./plan-tier-icons";
import styles from "./subscribe-pricing.module.css";

const TIER_TAGLINE: Record<PlanVisualVariant, string> = {
  basic: "Perfect for solo viewing on a few devices",
  standard: "Best balance for families and shared accounts",
  premium: "Maximum quality, streams, and premium extras",
};

const FEATURE_LABELS: Record<PlanFeature, string> = {
  [PlanFeature.Catalog]: "Full catalog access",
  [PlanFeature.Hd]: "HD streaming included",
  [PlanFeature.Uhd]: "Ultra HD (4K) streaming",
  [PlanFeature.Downloads]: "Offline downloads",
  [PlanFeature.Hdr]: "HDR playback",
  [PlanFeature.SpatialAudio]: "Spatial audio",
};

function planFeatureLines(plan: PublicPlan): string[] {
  const lines = [
    `Up to ${plan.maxVideoQuality.toUpperCase()} video quality`,
    `${plan.maxStreams} simultaneous stream${plan.maxStreams === 1 ? "" : "s"}`,
    `${plan.maxDevices} registered device${plan.maxDevices === 1 ? "" : "s"}`,
  ];
  for (const feature of Object.values(PlanFeature)) {
    if (plan.features.includes(feature)) {
      lines.push(FEATURE_LABELS[feature]);
    }
  }
  return lines;
}

function isFeaturedPlan(plan: PublicPlan, plans: PublicPlan[]): boolean {
  if (plan.tier === PlanTier.Standard) return true;
  if (plans.length === 3) {
    const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted[1]?.id === plan.id;
  }
  return false;
}

function planBadge(plan: PublicPlan, featured: boolean): string | null {
  if (featured) return "Popular";
  if (plan.tier === PlanTier.Premium) return "Premium";
  return null;
}

export function SubscribePricingSection({
  plans,
  cycle,
  onCycleChange,
  error,
  currentSlug,
  entitled,
  busy,
  onSelectPlan,
}: {
  plans: PublicPlan[];
  cycle: BillingCycle;
  onCycleChange: (cycle: BillingCycle) => void;
  error: string | null;
  currentSlug?: string;
  entitled: boolean;
  busy: boolean;
  onSelectPlan: (slug: string) => void;
}) {
  return (
    <section className={styles.pricing}>
      <div className={styles.gridBg} aria-hidden />

      <header className={styles.header}>
        <p className={styles.eyebrow}>Subscription plans</p>
        <h1 className={styles.title}>Choose a plan that fits your library</h1>
        <p className={styles.subtitle}>
          Access is authorized on the server. The plan you pick here is verified again before every
          playback request.
        </p>

        <div className={styles.cycleWrap}>
          <div className={styles.cycleToggle} role="group" aria-label="Billing cycle">
            <button
              type="button"
              className={cn(styles.cycleBtn, cycle === BillingCycle.Monthly && styles.cycleBtnActive)}
              onClick={() => onCycleChange(BillingCycle.Monthly)}
            >
              Monthly
            </button>
            <button
              type="button"
              className={cn(styles.cycleBtn, cycle === BillingCycle.Yearly && styles.cycleBtnActive)}
              onClick={() => onCycleChange(BillingCycle.Yearly)}
            >
              Yearly
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className={styles.alertWrap}>
          <Alert className="max-w-xl">{error}</Alert>
        </div>
      ) : null}

      <div className={styles.cards}>
        {plans.map((plan) => {
          const variant = planVisualVariant(plan.tier);
          const featured = isFeaturedPlan(plan, plans);
          const badge = planBadge(plan, featured);
          const price =
            cycle === BillingCycle.Yearly ? plan.yearlyPriceCents : plan.monthlyPriceCents;
          const isCurrent = entitled && currentSlug === plan.slug;
          const features = planFeatureLines(plan);

          return (
            <article
              key={plan.id}
              className={cn(styles.card, featured && styles.cardFeatured)}
            >
              {badge ? <span className={styles.badge}>{badge}</span> : null}

              <div className={styles.cardTop}>
                <PlanTierIcon variant={variant} featured={featured} />
                <p className={styles.planName}>{plan.name}</p>
                <p className={styles.planTagline}>
                  {plan.description?.trim() || TIER_TAGLINE[variant]}
                </p>
              </div>

              <div className={styles.priceWrap}>
                <p className={styles.price}>{formatCents(price, plan.currency)}</p>
                <span className={styles.priceLabel}>
                  per {cycle === BillingCycle.Yearly ? "year" : "month"}
                </span>
              </div>

              {plan.trialDays > 0 ? (
                <p className={styles.trialNote}>{plan.trialDays}-day free trial for new accounts</p>
              ) : null}

              <div className={styles.features}>
                <p className={styles.featuresHeading}>All features</p>
                <ul className={styles.featureList}>
                  {features.map((line) => (
                    <li key={line} className={styles.featureItem}>
                      <span className={styles.check} aria-hidden>
                        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                          <path
                            d="M3.5 8.2 6.4 11l6.1-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                className={styles.cta}
                disabled={busy || isCurrent}
                onClick={() => onSelectPlan(plan.slug)}
              >
                <span className="inline-flex opacity-90" aria-hidden>
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                    <path
                      d="M4 10h12M12 6l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {isCurrent ? "Current plan" : entitled ? "Switch to this plan" : "Get started"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
