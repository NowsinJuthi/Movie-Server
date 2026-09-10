const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_CHARS = /[<>]/g;

export function sanitizePlainText(value: string): string {
  return value.replace(CONTROL_CHARS, '').replace(HTML_CHARS, '').trim();
}

export function stripMongoOperators(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripMongoOperators);
  }
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(source)) {
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      next[key] = stripMongoOperators(nested);
    }
    return next;
  }
  return value;
}
