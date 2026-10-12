/** Heuristic: path or folder name looks like TV episodes (not movies). */
export function pathHintLooksLikeTv(pathOrName: string): boolean {
  const normalized = pathOrName.replace(/\\/g, '/').trim();
  if (!normalized) {
    return false;
  }
  if (/[Ss]\d{1,2}[Ee]\d{1,3}/.test(normalized)) {
    return true;
  }
  const base = normalized.split('/').filter(Boolean).pop() ?? normalized;
  if (/\.[Ss]\d{1,2}$/.test(base)) {
    return true;
  }
  if (/^season[\s._-]*\d/i.test(base)) {
    return true;
  }
  if (/^s\d{1,2}$/i.test(base)) {
    return true;
  }
  if (/\d{1,2}x\d{1,3}/i.test(normalized)) {
    return true;
  }
  return false;
}
