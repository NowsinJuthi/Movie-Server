"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SearchSuggestItem } from "@movie-server/shared";
import { PosterImage } from "@/components/home/poster-image";
import { searchApi } from "@/lib/search-api";
import { cn } from "@/lib/utils";

export function SearchBox({
  className,
  triggerClassName,
}: {
  className?: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [urlValue, setUrlValue] = useState(urlQuery);
  const [debouncedSuggest, setDebouncedSuggest] = useState("");
  const [expanded, setExpanded] = useState(Boolean(urlQuery) || pathname.startsWith("/home/search"));
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (urlQuery !== urlValue) {
    setUrlValue(urlQuery);
    setValue(urlQuery);
    if (urlQuery) setExpanded(true);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSuggest(value.trim()), 120);
    return () => window.clearTimeout(timer);
  }, [value]);

  // Keep the search page URL in sync while already on /home/search.
  useEffect(() => {
    if (!pathname.startsWith("/home/search")) return;
    const timer = window.setTimeout(() => {
      const next = value.trim();
      const currentQ = params.get("q") ?? "";
      if (next === currentQ) return;
      const current = new URLSearchParams(params.toString());
      if (next) current.set("q", next);
      else current.delete("q");
      const query = current.toString();
      router.replace(query ? `/home/search?${query}` : "/home/search");
    }, 280);
    return () => window.clearTimeout(timer);
  }, [value, pathname, params, router]);

  const suggestQuery = useQuery({
    queryKey: ["search-suggest", debouncedSuggest],
    queryFn: () => searchApi.suggest(debouncedSuggest),
    enabled: expanded && debouncedSuggest.length >= 1,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const titles = suggestQuery.data?.titles ?? [];
  const people = suggestQuery.data?.people ?? [];
  const genres = suggestQuery.data?.genres ?? [];
  const suggestions: SearchSuggestItem[] = [...titles, ...people, ...genres];
  const showPanel = expanded && debouncedSuggest.length >= 1;

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) {
        if (!value && !pathname.startsWith("/home/search")) setExpanded(false);
      }
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [value, pathname]);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const go = (query: string, href?: string) => {
    if (href) {
      router.push(href);
      setExpanded(false);
      return;
    }
    router.push(`/home/search?q=${encodeURIComponent(query)}`);
    setExpanded(false);
  };

  return (
    <div ref={box} className={cn("relative", className)}>
      {!expanded ? (
        <button
          type="button"
          aria-label="Search"
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary/70 text-foreground transition hover:border-primary/40 hover:bg-primary/15 hover:text-primary",
            triggerClassName,
          )}
          onClick={() => setExpanded(true)}
        >
          <Search className="h-4 w-4" />
        </button>
      ) : (
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 shadow-[0_8px_30px_-18px_rgb(38_191_176/0.55)] ring-1 ring-primary/20 backdrop-blur-md">
          <Search className="h-4 w-4 shrink-0 text-primary" />
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setActive(0);
            }}
            placeholder="Search movies & shows"
            className="h-10 w-[min(52vw,16rem)] bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground md:w-72"
            role="combobox"
            aria-expanded={showPanel && suggestions.length > 0}
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
                if (value) {
                  setValue("");
                  return;
                }
                setExpanded(false);
              }
            }}
          />
          {value ? (
            <button
              type="button"
              aria-label="Clear search"
              className="inline-flex h-10 w-10 touch-manipulation items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => {
                setValue("");
                inputRef.current?.focus();
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Close search"
              className="inline-flex h-10 w-10 touch-manipulation items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
              onClick={() => setExpanded(false)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {showPanel ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-xl border border-border bg-card/95 shadow-[0_18px_50px_-20px_rgb(0_0_0/0.75)] ring-1 ring-primary/15 backdrop-blur-md">
          {suggestQuery.isFetching && suggestions.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-muted-foreground">Searching…</p>
          ) : suggestions.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-muted-foreground">No matches for “{debouncedSuggest}”</p>
          ) : (
            <ul role="listbox" className="max-h-[70vh] overflow-y-auto brand-scrollbar py-1">
              {titles.length ? (
                <li className="px-3.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                  Titles
                </li>
              ) : null}
              {titles.map((item, index) => {
                const flatIndex = index;
                return (
                  <li key={`title-${item.id ?? item.label}-${index}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={flatIndex === active}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                        flatIndex === active ? "bg-primary/15" : "hover:bg-secondary",
                      )}
                      onMouseEnter={() => setActive(flatIndex)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        go(item.query, item.href);
                      }}
                    >
                      <div className="h-12 w-8 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
                        {item.imageUrl ? (
                          <PosterImage src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-[10px] text-muted-foreground">—</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs capitalize text-muted-foreground">{item.mediaKind ?? "title"}</p>
                      </div>
                    </button>
                  </li>
                );
              })}

              {people.map((item, index) => {
                const flatIndex = titles.length + index;
                return (
                  <li key={`person-${item.label}-${index}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={flatIndex === active}
                      className={cn(
                        "flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition-colors",
                        flatIndex === active ? "bg-primary/15 text-foreground" : "text-foreground/85 hover:bg-secondary",
                      )}
                      onMouseEnter={() => setActive(flatIndex)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        go(item.query, item.href);
                      }}
                    >
                      <span className="truncate">{item.label}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Person</span>
                    </button>
                  </li>
                );
              })}

              {genres.map((item, index) => {
                const flatIndex = titles.length + people.length + index;
                return (
                  <li key={`genre-${item.label}-${index}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={flatIndex === active}
                      className={cn(
                        "flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition-colors",
                        flatIndex === active ? "bg-primary/15 text-foreground" : "text-foreground/85 hover:bg-secondary",
                      )}
                      onMouseEnter={() => setActive(flatIndex)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        go(item.query, item.href);
                      }}
                    >
                      <span className="truncate">{item.label}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Genre</span>
                    </button>
                  </li>
                );
              })}

              {value.trim() ? (
                <li className="border-t border-border">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-primary hover:bg-primary/10"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      go(value.trim());
                    }}
                  >
                    <Search className="h-3.5 w-3.5" />
                    Search all for “{value.trim()}”
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
