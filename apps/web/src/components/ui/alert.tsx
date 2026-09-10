import * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive", className)}
      {...props}
    />
  );
}
