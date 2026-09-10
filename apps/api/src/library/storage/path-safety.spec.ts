import path from 'path';
import os from 'os';
import { BadRequestException } from '@nestjs/common';
import { ErrorCode } from '@movie-server/shared';
import { assertSafeLibraryRoot, resolveSafePath, UnsafePathError } from './path-safety';

describe('path-safety', () => {
  const root = path.join(os.tmpdir(), 'cinevault-lib-root');

  it('rejects path traversal in relative keys', () => {
    expect(() => resolveSafePath(root, '../secret.mkv')).toThrow(UnsafePathError);
    expect(() => resolveSafePath(root, 'folder/../../etc/passwd')).toThrow(UnsafePathError);
    expect(() => resolveSafePath(root, 'C:\\Windows\\notepad.exe')).toThrow(UnsafePathError);
    expect(() => resolveSafePath(root, '/var/media/file.mkv')).toThrow(UnsafePathError);
  });

  it('resolves keys inside the library root', () => {
    const resolved = resolveSafePath(root, 'Movies/The Matrix (1999).mkv');
    expect(resolved.startsWith(path.resolve(root))).toBe(true);
    expect(resolved.endsWith(`${path.sep}The Matrix (1999).mkv`)).toBe(true);
  });

  it('rejects unsafe library roots', () => {
    expect(() => assertSafeLibraryRoot('../media')).toThrow(BadRequestException);
    expect(() => assertSafeLibraryRoot('C:\\Windows')).toThrow(BadRequestException);
    expect(() => assertSafeLibraryRoot('/etc')).toThrow(BadRequestException);
    try {
      assertSafeLibraryRoot('C:\\Windows');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        error: ErrorCode.InvalidLibraryPath,
      });
    }
  });

  it('accepts a temp absolute directory', () => {
    const allowed = path.join(os.tmpdir(), 'cinevault-movies');
    expect(assertSafeLibraryRoot(allowed)).toBe(path.resolve(allowed));
  });
});
