import type { ReactNode } from "react";
import { PageShell } from "@/components/layout/page-shell";

export function AdminPage({
  title,
  description,
  actions,
  error,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <PageShell title={title} description={description} actions={actions} error={error} fillHeight>
      {children}
    </PageShell>
  );
}
