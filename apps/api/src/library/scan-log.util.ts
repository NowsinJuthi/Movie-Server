export function sanitizeScanMessage(message: string, roots: string[] = []): string {
  let out = message;
  const uniqueRoots = [...new Set(roots.filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const root of uniqueRoots) {
    for (const variant of [root, root.replace(/\\/g, '/'), root.replace(/\//g, '\\')]) {
      if (!variant) continue;
      out = out.split(variant).join('[library]');
    }
  }
  out = out.replace(/[A-Za-z]:\\[^\s"'`]+/g, '[path]');
  out = out.replace(/[A-Za-z]:\/[^\s"'`]+/g, '[path]');
  out = out.replace(/\/(?:var|home|mnt|media|data|opt|usr|etc|tmp|storage)\/[^\s"'`]+/gi, '[path]');
  return out.slice(0, 500);
}
