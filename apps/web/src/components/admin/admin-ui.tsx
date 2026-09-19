import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./admin-ui.module.css";

export type AdminMetricGridVariant = "default" | "lg4" | "lg5" | "xl3" | "md4" | "md5" | "md3";

const METRIC_GRID_CLASS: Record<AdminMetricGridVariant, string> = {
  default: styles.metricGrid!,
  lg4: styles.metricGridLg4!,
  lg5: styles.metricGridLg5!,
  xl3: styles.metricGridXl3!,
  md4: styles.metricGridMd4!,
  md5: styles.metricGridMd5!,
  md3: styles.metricGridMd3!,
};

export function AdminPageStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(styles.pageStack, className)}>{children}</div>;
}

export function AdminMetricGrid({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: AdminMetricGridVariant;
  className?: string;
}) {
  return <div className={cn(METRIC_GRID_CLASS[variant], className)}>{children}</div>;
}

export function AdminStatCard({
  label,
  value,
  hint,
  href,
  valueClassName,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  valueClassName?: string;
}) {
  const body = (
    <>
      {href ? <ChevronRight className={`${styles.statArrow} h-4 w-4`} aria-hidden /> : null}
      <p className={styles.statLabel}>{label}</p>
      <p className={cn(styles.statValue, valueClassName)}>{value}</p>
      {hint ? <p className={styles.statHint}>{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={styles.statCard}>
        {body}
      </Link>
    );
  }

  return <div className={cn(styles.statCard, styles.statCardStatic)}>{body}</div>;
}

export function AdminSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(styles.section, className)}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {description ? <p className={styles.sectionDesc}>{description}</p> : null}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export { styles as adminUiStyles };
