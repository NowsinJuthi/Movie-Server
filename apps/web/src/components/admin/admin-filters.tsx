import type { ReactNode } from "react";
import { FilterSearch, FilterSelect } from "@/components/filters/filter-ui";

export function AdminSearch({
  value,
  onChange,
  placeholder = "Search",
  label = "Search",
  id = "admin-search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  id?: string;
}) {
  return (
    <FilterSearch
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full min-w-0 flex-1 sm:max-w-sm"
    />
  );
}

export function AdminSelect({
  value,
  onChange,
  options,
  label = "Filter",
  id = "admin-select",
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label?: string;
  id?: string;
}) {
  return (
    <FilterSelect
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      className="w-full sm:w-auto sm:min-w-[10rem]"
    />
  );
}

/** Wrap admin filter rows for consistent spacing on list pages */
export function AdminFilterRow({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">{children}</div>;
}
