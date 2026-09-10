import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/** UniqBD-style page frame: soft side gutters + rounded content surface */
export function PageShell({
  title,
  description,
  actions,
  error,
  children,
  className,
  bodyClassName,
  fillHeight = false,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Fill parent height (admin content pane) */
  fillHeight?: boolean;
}) {
  return (
    <main
      className={cn(
        "flex w-full flex-col bg-background p-3 sm:p-4 md:p-5 lg:p-6",
        fillHeight ? "h-full min-h-0 overflow-hidden" : "min-h-dvh",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border border-border bg-card/40",
          fillHeight ? "min-h-0 flex-1" : "flex-1",
        )}
      >
        {title || description || actions ? (
          <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div className="min-w-0">
              {title ? <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1> : null}
              {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </header>
        ) : null}
        {error ? (
          <div className="shrink-0 border-b border-border px-4 py-2 sm:px-5">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <div
          className={cn(
            "min-h-0 flex-1 space-y-6 overflow-auto p-4 sm:p-5",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </div>
    </main>
  );
}
