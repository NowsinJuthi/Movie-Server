"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { adminApi } from "@/lib/admin-api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

export type AdminUserSearchHit = {
  id: string;
  displayName: string;
  email: string;
  role: string;
  isActive: boolean;
};

export function AdminUserSearch({
  value,
  onChange,
  onSelectUser,
  placeholder = "Search name or email",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelectUser?: (user: AdminUserSearchHit) => void;
  placeholder?: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const debounced = useDebouncedValue(value.trim(), 200);

  const suggestQuery = useQuery({
    queryKey: ["admin-user-suggest", debounced],
    queryFn: () => adminApi.userSuggest({ q: debounced, limit: 10 }),
    enabled: debounced.length >= 1,
    staleTime: 15_000,
  });

  const hits = suggestQuery.data?.users ?? [];
  const open = focused && debounced.length >= 1;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative w-full min-w-0 flex-1 sm:max-w-sm", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        className="h-11 touch-manipulation pl-9"
        autoComplete="off"
        spellCheck={false}
      />
      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card/98 shadow-[0_18px_50px_-20px_rgb(0_0_0/0.75)] ring-1 ring-primary/15 backdrop-blur-md">
          {suggestQuery.isFetching && hits.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">Searching...</p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">No users found.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {hits.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className="flex w-full touch-manipulation flex-col items-start gap-0.5 px-3 py-3 text-left transition-colors hover:bg-secondary/80 active:bg-secondary"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(user.email);
                      onSelectUser?.(user);
                      setFocused(false);
                    }}
                  >
                    <span className="text-sm font-medium text-foreground">{user.displayName}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
