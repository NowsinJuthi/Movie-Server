"use client";

import { parseEmailDomainLines } from "@movie-server/shared";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EmailDomainListEditor({
  label,
  hint,
  domains,
  onChange,
  bulkPlaceholder,
}: {
  label: string;
  hint: string;
  domains: string[];
  onChange: (domains: string[]) => void;
  bulkPlaceholder: string;
}) {
  const [draft, setDraft] = useState("");
  const [bulk, setBulk] = useState("");

  const mergeDomains = (parsed: string[]) => {
    if (parsed.length === 0) return;
    const merged = [...domains];
    const seen = new Set(domains);
    for (const domain of parsed) {
      if (seen.has(domain)) continue;
      seen.add(domain);
      merged.push(domain);
    }
    merged.sort();
    onChange(merged);
  };

  const addDraft = () => {
    mergeDomains(parseEmailDomainLines(draft));
    setDraft("");
  };

  const applyBulk = () => {
    mergeDomains(parseEmailDomainLines(bulk));
    setBulk("");
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {domains.length === 0 ? (
          <span className="text-xs text-muted-foreground">No domains yet.</span>
        ) : (
          domains.map((domain) => (
            <span
              key={domain}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 font-mono text-xs"
            >
              {domain}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${domain}`}
                onClick={() => onChange(domains.filter((d) => d !== domain))}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <Label>Add domain</Label>
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addDraft();
              }
            }}
            placeholder="gmail.com"
          />
        </div>
        <button
          type="button"
          onClick={addDraft}
          className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Add
        </button>
      </div>
      <div className="space-y-2">
        <Label>Bulk paste (one per line)</Label>
        <textarea
          value={bulk}
          onChange={(event) => setBulk(event.target.value)}
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          placeholder={bulkPlaceholder}
        />
        <button
          type="button"
          onClick={applyBulk}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Merge pasted domains
        </button>
      </div>
    </div>
  );
}
