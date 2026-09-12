"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import styles from "./filter-ui.module.css";

export function FilterPanel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn(styles.panel, className)}>{children}</section>;
}

export function FilterLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <span className={styles.label} {...(htmlFor ? { id: `${htmlFor}-label` } : {})}>
      {children}
    </span>
  );
}

export function FilterField({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("flex min-w-0 flex-col", className)}>
      <FilterLabel htmlFor={htmlFor}>{label}</FilterLabel>
      {children}
    </label>
  );
}

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <FilterField label={label} htmlFor={id} className={className}>
      <div className={styles.selectWrap}>
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={styles.control}
        >
          {options.map((option) => (
            <option key={option.value || "__any"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </FilterField>
  );
}

export function FilterSearch({
  id,
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <FilterField label={label} htmlFor={id} className={className}>
      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn(styles.control, styles.searchInput)}
        />
      </div>
    </FilterField>
  );
}

export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" onClick={onRemove} className={styles.chip}>
      {label}
      <X className="h-3 w-3" aria-hidden />
    </button>
  );
}

export function FilterQuickPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={styles.pill}>
      {label}
    </button>
  );
}

export function FilterGrid({
  open,
  children,
  className,
}: {
  open?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
        open === false ? "hidden lg:grid" : open === true ? "grid" : undefined,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FilterToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-end", className)}>{children}</div>;
}

export function FilterActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex items-end gap-2", className)}>{children}</div>;
}

export function FilterMobileToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn("h-11 flex-1 touch-manipulation lg:hidden", styles.toggleBtn)}
      onClick={onClick}
      aria-expanded={open}
    >
      <SlidersHorizontal className="mr-2 h-4 w-4" />
      Filters
    </Button>
  );
}

export function FilterClearButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" className={cn("h-11 shrink-0 touch-manipulation", styles.clearBtn)} onClick={onClick}>
      <X className="mr-1.5 h-4 w-4" />
      Clear
    </Button>
  );
}

export function FilterFooter({
  summary,
  chips,
}: {
  summary: ReactNode;
  chips?: ReactNode;
}) {
  return (
    <div className={styles.footer}>
      <p className={styles.footerText}>{summary}</p>
      {chips ? <div className="flex flex-wrap gap-1.5">{chips}</div> : null}
    </div>
  );
}

export function FilterSummaryCount({
  filtered,
  total,
  noun,
}: {
  filtered: number;
  total: number;
  noun: string;
}) {
  return (
    <>
      Showing <span className={styles.footerAccent}>{filtered}</span> of{" "}
      <span className={styles.footerAccent}>{total}</span> {noun}
    </>
  );
}
