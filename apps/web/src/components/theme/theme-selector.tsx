"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useId, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import styles from "./theme-selector.module.css";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

function subscribe() {
  return () => undefined;
}

function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

type ThemeSelectorProps = {
  variant?: "menu" | "panel" | "compact";
  className?: string;
};

export function ThemeSelector({ variant = "menu", className }: ThemeSelectorProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useIsClient();
  const labelId = useId();

  const compact = variant === "compact";
  const options = compact ? OPTIONS.filter((option) => option.value !== "system") : OPTIONS;
  const active = mounted
    ? compact
      ? theme === "light" || theme === "dark"
        ? theme
        : (resolvedTheme ?? "dark")
      : (theme ?? "system")
    : compact
      ? null
      : "system";

  const group = (
    <div
      role="radiogroup"
      aria-labelledby={variant === "compact" ? undefined : labelId}
      aria-label={variant === "compact" ? "Color theme" : undefined}
      className={cn(styles.group, compact && styles.compact)}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            className={cn(styles.option, selected && styles.optionActive)}
            onClick={() => setTheme(value)}
          >
            <Icon className={styles.icon} aria-hidden />
            {compact ? null : <span className={styles.label}>{label}</span>}
          </button>
        );
      })}
    </div>
  );

  if (variant === "compact") {
    return <div className={className}>{group}</div>;
  }

  if (variant === "panel") {
    return (
      <div className={cn(styles.panelBlock, className)}>
        <div>
          <h2 id={labelId} className="text-lg font-semibold">
            Appearance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use your device setting, or lock the site to light or dark.
          </p>
        </div>
        {group}
      </div>
    );
  }

  return (
    <div className={cn(styles.menuBlock, className)}>
      <p id={labelId} className={styles.menuLabel}>
        Appearance
      </p>
      {group}
    </div>
  );
}
