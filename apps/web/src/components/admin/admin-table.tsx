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
    <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 sm:mx-0 sm:px-0">
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
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
