import { createHash } from 'crypto';
import { promises as fs } from 'fs';

const SAMPLE_BYTES = 64 * 1024;

export async function fingerprintFile(
  absPath: string,
  sizeBytes: number,
  relativePath: string,
): Promise<string> {
  if (sizeBytes <= 0) {
    return `empty:${relativePath}`;
  }
  const hash = createHash('sha256');
  hash.update(`size:${sizeBytes}`);
  const handle = await fs.open(absPath, 'r');
  try {
    const headLen = Math.min(SAMPLE_BYTES, sizeBytes);
    const head = Buffer.alloc(headLen);
    await handle.read(head, 0, headLen, 0);
    hash.update(head);
    if (sizeBytes > SAMPLE_BYTES * 2) {
      const tail = Buffer.alloc(SAMPLE_BYTES);
      await handle.read(tail, 0, SAMPLE_BYTES, sizeBytes - SAMPLE_BYTES);
      hash.update(tail);
    }
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}
