import type { ReactNode } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { AdminPageStack } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";
import ui from "@/components/admin/admin-ui.module.css";

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
    <PageShell
      title={title}
      description={description}
      actions={actions}
      error={error}
      fillHeight
      className="h-full min-h-0"
      bodyClassName={cn(ui.adminBody, "max-lg:space-y-3 max-lg:p-3")}
    >
      <AdminPageStack>{children}</AdminPageStack>
    </PageShell>
  );
}
