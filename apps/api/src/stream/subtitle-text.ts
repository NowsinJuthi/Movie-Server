const MAX_CUE_CHARS = 500;
const ALLOWED_TAG = /<\/?(i|b|u)>/gi;

export function subtitleFormatFromName(fileName: string): 'srt' | 'vtt' | 'ass' | 'sub' | 'unknown' {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'srt') return 'srt';
  if (ext === 'vtt') return 'vtt';
  if (ext === 'ass' || ext === 'ssa') return 'ass';
  if (ext === 'sub') return 'sub';
  return 'unknown';
}

export function isPlayableSubtitleFormat(format?: string | null): boolean {
  return format === 'srt' || format === 'vtt';
}

export function sanitizeCueLine(line: string): string {
  const withoutScripts = line
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  const placeholders: string[] = [];
  const tokenized = withoutScripts.replace(ALLOWED_TAG, (tag) => {
    placeholders.push(tag.toLowerCase());
    return `\u0000${placeholders.length - 1}\u0000`;
  });
  const stripped = tokenized.replace(/<[^>]+>/g, '');
  const restored = stripped.replace(/\u0000(\d+)\u0000/g, (_, index: string) => placeholders[Number(index)] ?? '');
  return restored.slice(0, MAX_CUE_CHARS);
}

export function srtToWebVtt(input: string): string {
  const normalized = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) {
    return 'WEBVTT\n';
  }
  const blocks = normalized.split(/\n{2,}/);
  const cues: string[] = ['WEBVTT', ''];
  for (const block of blocks) {
    const rawLines = block.split('\n').map((line) => line.trimEnd());
    const lines = rawLines.filter((line, index) => !(index === 0 && /^\d+$/.test(line.trim())));
    if (lines.length === 0) {
      continue;
    }
    const timing = lines[0].replace(/,/g, '.');
    if (!/\d{1,2}:\d{2}:\d{2}\.\d{1,3}\s+-->\s+\d{1,2}:\d{2}:\d{2}\.\d{1,3}/.test(timing)) {
      continue;
    }
    const text = lines.slice(1).map(sanitizeCueLine).join('\n').trim();
    if (!text) {
      continue;
    }
    cues.push(timing.replace(/\s+-->\s+/, ' --> '), text, '');
  }
  return `${cues.join('\n').trimEnd()}\n`;
}

export function toSafeWebVtt(input: string, format: string | null): string {
  const normalized = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (format === 'srt' || (!format && looksLikeSrt(normalized))) {
    return srtToWebVtt(normalized);
  }
  if (format === 'vtt' || normalized.trimStart().toUpperCase().startsWith('WEBVTT')) {
    return sanitizeWebVtt(normalized);
  }
  throw new Error('UNSUPPORTED_SUBTITLE');
}

function looksLikeSrt(value: string): boolean {
  return /\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/.test(value);
}

function sanitizeWebVtt(input: string): string {
  const lines = input.replace(/^\uFEFF/, '').split('\n');
  if (!lines[0]?.toUpperCase().startsWith('WEBVTT')) {
    lines.unshift('WEBVTT', '');
  } else {
    lines[0] = 'WEBVTT';
  }
  const out: string[] = [];
  let inCue = false;
  for (const line of lines) {
    if (line.toUpperCase().startsWith('WEBVTT')) {
      out.push('WEBVTT');
      inCue = false;
      continue;
    }
    if (line.startsWith('NOTE') || line.startsWith('STYLE') || line.startsWith('REGION')) {
      inCue = false;
      continue;
    }
    if (/-->/.test(line)) {
      inCue = true;
      out.push(line.replace(/,/g, '.'));
      continue;
    }
    if (line.trim() === '') {
      inCue = false;
      out.push('');
      continue;
    }
    out.push(inCue ? sanitizeCueLine(line) : line.replace(/<[^>]+>/g, '').slice(0, MAX_CUE_CHARS));
  }
  return `${out.join('\n').trimEnd()}\n`;
}
