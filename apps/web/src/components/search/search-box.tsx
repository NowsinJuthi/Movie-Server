"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { searchApi } from "@/lib/search-api";
import { cn } from "@/lib/utils";
import type { SearchSuggestItem } from "@movie-server/shared";

export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [urlValue, setUrlValue] = useState(urlQuery);
  const [debouncedSuggest, setDebouncedSuggest] = useState("");
  const [open, setOpen] = useState(Boolean(urlQuery) || pathname.startsWith("/home/search"));
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  if (urlQuery !== urlValue) {
    setUrlValue(urlQuery);
    setValue(urlQuery);
    if (urlQuery) setOpen(true);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSuggest(value.trim()), 150);
    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = value.trim();
      if (pathname.startsWith("/home/search")) {
        const currentQ = params.get("q") ?? "";
        if (next === currentQ) return;
        const current = new URLSearchParams(params.toString());
        if (next) current.set("q", next);
        else current.delete("q");
        const query = current.toString();
        router.replace(query ? `/home/search?${query}` : "/home/search");
        return;
      }
      if (next.length >= 2) {
        router.push(`/home/search?q=${encodeURIComponent(next)}`);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [value, pathname, params, router]);

  const suggestQuery = useQuery({
    queryKey: ["search-suggest", debouncedSuggest],
    queryFn: () => searchApi.suggest(debouncedSuggest),
    enabled: open && debouncedSuggest.length >= 1,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const suggestions: SearchSuggestItem[] = [
    ...(suggestQuery.data?.titles ?? []),
    ...(suggestQuery.data?.people ?? []),
    ...(suggestQuery.data?.genres ?? []),
  ];

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) {
        if (!value && !pathname.startsWith("/home/search")) setOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [value, pathname]);

  const go = (query: string, href?: string) => {
    if (href) {
      router.push(href);
      return;
    }
    router.push(`/home/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div ref={box} className={cn("relative", className)}>
      {open ? (
        <Input
          autoFocus
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setActive(0);
          }}
          placeholder="Titles, people, genres"
          className="h-10 w-40 bg-black/70 md:w-72"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-autocomplete="list"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, Math.max(suggestions.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              const selected = suggestions[active];
              if (selected) go(selected.query, selected.href);
              else if (value.trim()) go(value.trim());
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          aria-label="Search"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-white hover:bg-white/10"
          onClick={() => setOpen(true)}
        >
          <Search className="h-5 w-5" />
        </button>
      )}
      {open && suggestions.length > 0 ? (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-md border border-white/10 bg-card shadow-2xl"
        >
          {suggestions.map((item, index) => (
            <li key={`${item.kind}-${item.label}-${index}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                  index === active ? "bg-white/10" : "hover:bg-white/5",
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  go(item.query, item.href);
                }}
              >
                <span className="truncate">{item.label}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
