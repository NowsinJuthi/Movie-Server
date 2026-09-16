import path from 'path';
import { BadRequestException } from '@nestjs/common';
import { ErrorCode } from '@movie-server/shared';

export function sanitizeUploadFilename(original: string): string {
  const base = path.basename(original.replace(/\\/g, '/')).trim();
  if (!base || base === '.' || base === '..' || base.includes('\0')) {
    throw new BadRequestException({
      error: ErrorCode.ValidationFailed,
      message: 'Invalid file name.',
    });
  }
  return base;
}

export function joinRemotePath(directory: string, filename: string): string {
  const dir = directory.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return dir ? `${dir}/${filename}` : filename;
}

/** True when `target` is the library folder or a file/folder inside it. */
export function remotePathInLibrary(libraryRemote: string | null | undefined, targetRemote: string): boolean {
  const root = (libraryRemote ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const target = targetRemote.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!root) return true;
  return target === root || target.startsWith(`${root}/`);
}
