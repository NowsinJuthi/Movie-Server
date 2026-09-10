import { openSync, readSync, closeSync, fstatSync } from 'fs';

export type ContainerAudioHint = {
  ordinal: number;
  language: string | null;
  label: string | null;
};

/** Lightweight ISO-BMFF walk to count embedded audio tracks when ffprobe under-reports. */
export function probeMp4AudioTracks(absPath: string): ContainerAudioHint[] {
  const fd = openSync(absPath, 'r');
  try {
    const size = fstatSync(fd).size;
    const handlers: string[] = [];
    const walk = (start: number, end: number) => {
      let off = start;
      while (off + 8 <= end && off < size) {
        const box = readBox(fd, off, size);
        if (!box || box.size < 8 || box.end > end + 1) break;
        if (box.type === 'moov' || box.type === 'trak' || box.type === 'mdia' || box.type === 'minf' || box.type === 'stbl') {
          walk(off + box.header, box.end);
        } else if (box.type === 'hdlr') {
          const buf = Buffer.alloc(Math.min(box.size, 64));
          readSync(fd, buf, 0, buf.length, off);
          handlers.push(buf.toString('ascii', 16, 20));
        }
        off = box.end;
      }
    };

    let off = 0;
    while (off + 8 <= size) {
      const box = readBox(fd, off, size);
      if (!box || box.size < 8) break;
      if (box.type === 'moov') {
        walk(off + box.header, box.end);
        break;
      }
      off = box.end;
      if (off > size) break;
    }

    return handlers
      .filter((handler) => handler === 'soun')
      .map((_, ordinal) => ({
        ordinal,
        language: null,
        label: ordinal === 0 ? 'Audio 1' : `Audio ${ordinal + 1}`,
      }));
  } finally {
    closeSync(fd);
  }
}

function readBox(fd: number, start: number, fileSize: number) {
  const buf = Buffer.alloc(16);
  readSync(fd, buf, 0, 16, start);
  let size = buf.readUInt32BE(0);
  const type = buf.toString('ascii', 4, 8);
  let header = 8;
  let end = start + size;
  if (size === 1) {
    size = Number(buf.readBigUInt64BE(8));
    header = 16;
    end = start + size;
  } else if (size === 0) {
    end = fileSize;
    size = end - start;
  }
  if (!Number.isFinite(size) || size < 8) return null;
  return { size, type, header, start, end };
}
