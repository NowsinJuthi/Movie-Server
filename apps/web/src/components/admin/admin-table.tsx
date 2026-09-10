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
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 font-medium">
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
  );
}

export function AdminTh({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={cn("px-4 py-3", className)} {...props} />;
}

export function AdminTd({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("border-t border-border px-4 py-3", className)} {...props} />;
}
