import { cn } from "@/lib/utils";

export function AdminTable({
  columns,
  children,
  empty,
}: {
  columns: string[];
  children: React.ReactNode;
  empty?: string;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="admin-table-scroll -mx-1 px-1 sm:mx-0 sm:px-0">
      <p className="mb-2 text-xs text-muted-foreground lg:hidden">Swipe sideways to see all columns.</p>
      <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-card/40 sm:rounded-xl [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[520px] text-left text-sm sm:min-w-[640px]">
          <thead className="bg-secondary text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-3 font-medium sm:px-4">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasRows ? (
              children
            ) : (
              <tr>
                <td className="px-4 py-8 text-muted-foreground" colSpan={columns.length}>
                  {empty ?? "No records."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminTh({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={cn("px-4 py-3", className)} {...props} />;
}

export function AdminTd({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("border-t border-border px-3 py-3 sm:px-4", className)} {...props} />;
}
