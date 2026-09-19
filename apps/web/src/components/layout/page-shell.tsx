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
        "flex w-full min-w-0 flex-col bg-background",
        fillHeight
          ? "h-full min-h-0 overflow-hidden p-0 max-lg:overflow-x-hidden lg:p-2 xl:p-4"
          : "min-h-dvh p-2 pt-20 sm:p-4 md:p-5 lg:p-6",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-col",
          fillHeight
            ? "min-h-0 flex-1 overflow-hidden max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent lg:rounded-xl lg:border lg:border-border lg:bg-card/40"
            : "rounded-xl border border-border bg-card/40",
        )}
      >
        {title || description || actions ? (
          <header
            className={cn(
              "flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3 sm:px-5 sm:py-3",
              fillHeight && "max-lg:sticky max-lg:top-0 max-lg:z-10 max-lg:bg-background/95 max-lg:backdrop-blur-md",
            )}
          >
            <div className="min-w-0 flex-1">
              {title ? (
                <h1 className="text-base font-semibold leading-snug sm:text-2xl">{title}</h1>
              ) : null}
              {description ? (
                <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground sm:mt-1 sm:line-clamp-none sm:text-sm">
                  {description}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:justify-end [&_button]:min-h-10 [&_button]:touch-manipulation [&_a]:min-h-10 [&_a]:touch-manipulation">
                {actions}
              </div>
            ) : null}
          </header>
        ) : null}
        {error ? (
          <div className="shrink-0 border-b border-border px-4 py-2 sm:px-5">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <div
          className={cn(
            "space-y-4 p-3 sm:space-y-6 sm:p-5",
            fillHeight &&
              "min-h-0 flex-1 overflow-auto overscroll-y-contain brand-scrollbar",
            "[&_input]:min-h-10 [&_select]:min-h-10 [&_textarea]:min-h-10",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </div>
    </main>
  );
}
