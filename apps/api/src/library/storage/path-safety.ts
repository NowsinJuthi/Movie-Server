import path from 'path';
import { BadRequestException } from '@nestjs/common';
import { ErrorCode } from '@movie-server/shared';

const FORBIDDEN_ROOT = [
  /^[a-z]:\\windows(\\|$)/i,
  /^[a-z]:\/windows(\/|$)/i,
  /^[a-z]:\\program files( \(x86\))?(\\|$)/i,
  /^[a-z]:\/program files( \(x86\))?(\/|$)/i,
  /^\/etc(\/|$)/,
  /^\/usr(\/|$)/,
  /^\/bin(\/|$)/,
  /^\/sbin(\/|$)/,
  /^\/root(\/|$)/,
  /^\/proc(\/|$)/,
  /^\/sys(\/|$)/,
  /^\/dev(\/|$)/,
  /^\/boot(\/|$)/,
];

export class UnsafePathError extends Error {
  constructor(message = 'Unsafe filesystem path.') {
    super(message);
    this.name = 'UnsafePathError';
  }
}

export function throwInvalidLibraryPath(message = 'Media directory is not allowed.'): never {
  throw new BadRequestException({
    error: ErrorCode.InvalidLibraryPath,
    message,
  });
}

export function isForbiddenSystemPath(resolved: string): boolean {
  const normalized = resolved.replace(/\//g, path.sep);
  const posix = resolved.replace(/\\/g, '/');
  return FORBIDDEN_ROOT.some((pattern) => pattern.test(normalized) || pattern.test(posix));
}

export function isUncPath(input: string): boolean {
  const trimmed = input.trim();
  return /^\\\\[^\\\/]+\\[^\\\/]+/.test(trimmed) || /^\/\/[^\/]+\/[^\/]+/.test(trimmed);
}

export function normalizeUncRoot(input: string): string {
  // Prefer Windows-style UNC for Node fs on win32; keep //host/share on POSIX mounts separately.
  return input
    .trim()
    .replace(/\//g, '\\')
    .replace(/^\\+/, '\\\\')
    .replace(/\\+$/, '');
}

export function assertSafeLibraryRoot(input: string): string {
  if (typeof input !== 'string' || !input.trim()) {
    throwInvalidLibraryPath('A media directory is required.');
  }
  if (input.includes('\0')) {
    throwInvalidLibraryPath('Media directory contains invalid characters.');
  }
  const trimmed = input.trim();
  if (trimmed.includes('..')) {
    throwInvalidLibraryPath('Path traversal is not allowed.');
  }

  if (isUncPath(trimmed)) {
    const unc = normalizeUncRoot(trimmed);
    const parts = unc.replace(/^\\\\/, '').split('\\').filter(Boolean);
    if (parts.length < 2) {
      throwInvalidLibraryPath('UNC path must include host and share.');
    }
    return unc;
  }

  if (!path.isAbsolute(trimmed)) {
    throwInvalidLibraryPath('Media directory must be an absolute path.');
  }
  const resolved = path.resolve(trimmed);
  const posix = trimmed.replace(/\\/g, '/');
  if (isForbiddenSystemPath(trimmed) || isForbiddenSystemPath(posix) || isForbiddenSystemPath(resolved)) {
    throwInvalidLibraryPath('System directories cannot be used as media libraries.');
  }
  return resolved;
}

export function toPosixRelative(relativeKey: string): string {
  return relativeKey.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function resolveSafePath(root: string, relativeKey: string): string {
  if (typeof relativeKey !== 'string' || relativeKey.includes('\0') || root.includes('\0')) {
    throw new UnsafePathError();
  }
  const raw = relativeKey.trim();
  const posixRaw = raw.replace(/\\/g, '/');
  if (path.win32.isAbsolute(raw) || path.posix.isAbsolute(posixRaw) || /^[a-zA-Z]:/.test(raw) || raw.startsWith('/')) {
    throw new UnsafePathError('Absolute paths are not allowed.');
  }
  const posix = toPosixRelative(raw);
  const segments = posix.split('/').filter((segment) => segment.length > 0 && segment !== '.');
  if (segments.some((segment) => segment === '..' || segment === '~')) {
    throw new UnsafePathError('Path traversal is not allowed.');
  }
  const rootResolved = path.resolve(root);
  const candidate = path.resolve(rootResolved, ...segments);
  const rootCmp = process.platform === 'win32' ? rootResolved.toLowerCase() : rootResolved;
  const candCmp = process.platform === 'win32' ? candidate.toLowerCase() : candidate;
  const prefix = rootCmp.endsWith(path.sep) ? rootCmp : rootCmp + path.sep;
  if (candCmp !== rootCmp && !candCmp.startsWith(prefix)) {
    throw new UnsafePathError('Resolved path escaped the library root.');
  }
  return candidate;
}

export function isInsideRoot(root: string, candidate: string): boolean {
  try {
    resolveSafePath(root, path.relative(path.resolve(root), path.resolve(candidate)));
    const rootResolved = path.resolve(root);
    const candResolved = path.resolve(candidate);
    const rootCmp = process.platform === 'win32' ? rootResolved.toLowerCase() : rootResolved;
    const candCmp = process.platform === 'win32' ? candResolved.toLowerCase() : candResolved;
    const prefix = rootCmp.endsWith(path.sep) ? rootCmp : rootCmp + path.sep;
    return candCmp === rootCmp || candCmp.startsWith(prefix);
  } catch {
    return false;
  }
}
