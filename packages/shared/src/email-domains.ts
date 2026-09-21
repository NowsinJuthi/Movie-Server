import { RECOMMENDED_REGISTRATION_EMAIL_DOMAINS } from './email-domain-presets';

export { RECOMMENDED_REGISTRATION_EMAIL_DOMAINS };

export type EmailDomainPolicy = {
  allowlist: string[];
  blocklist: string[];
  /** True when allowlist is non-empty (only those domains may register). */
  allowlistEnabled: boolean;
};

const DOMAIN_LINE_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}$/;

export function normalizeEmailDomainList(domains: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of domains) {
    const domain = raw.trim().toLowerCase();
    if (!domain || seen.has(domain)) continue;
    if (!DOMAIN_LINE_PATTERN.test(domain)) continue;
    seen.add(domain);
    out.push(domain);
  }
  out.sort();
  return out;
}

export function parseEmailDomainLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/[\n,;\s]+/)) {
    const domain = line.trim().toLowerCase();
    if (!domain || seen.has(domain)) continue;
    if (!DOMAIN_LINE_PATTERN.test(domain)) continue;
    seen.add(domain);
    out.push(domain);
  }
  return out;
}

export function extractEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return null;
  return trimmed.slice(at + 1);
}

export function emailDomainPolicyStatus(policy: EmailDomainPolicy): string {
  if (policy.allowlist.length > 0) {
    return `Allowlist only · ${policy.allowlist.length} allowed · all others blocked`;
  }
  if (policy.blocklist.length > 0) {
    return `Open · ${policy.blocklist.length} extra blocked`;
  }
  return 'Open · any email domain';
}
