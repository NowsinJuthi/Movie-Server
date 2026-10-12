import { statfs } from 'fs/promises';
import os from 'os';

type CpuSample = { idle: number; total: number };

let lastCpuSample: CpuSample | null = null;

function sumCpuTimes(): CpuSample {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }
  return { idle, total };
}

/** CPU usage since the previous sample (0–100). First call returns 0. */
export function readCpuUsagePercent(): number {
  const current = sumCpuTimes();
  const previous = lastCpuSample;
  lastCpuSample = current;
  if (!previous) {
    return 0;
  }
  const idleDelta = current.idle - previous.idle;
  const totalDelta = current.total - previous.total;
  if (totalDelta <= 0) {
    return 0;
  }
  const usage = (1 - idleDelta / totalDelta) * 100;
  return Math.max(0, Math.min(100, Math.round(usage * 10) / 10));
}

export async function readStorageUsage(
  path: string,
): Promise<{ path: string; usedBytes: number; totalBytes: number; usedPercent: number } | null> {
  try {
    const stats = await statfs(path);
    const totalBytes = stats.bsize * stats.blocks;
    const freeBytes = stats.bsize * stats.bavail;
    if (totalBytes <= 0) {
      return null;
    }
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usedPercent = Math.round((usedBytes / totalBytes) * 1000) / 10;
    return { path, usedBytes, totalBytes, usedPercent };
  } catch {
    return null;
  }
}

export function metricsDiskPath(): string {
  const configured = process.env.ADMIN_METRICS_DISK_PATH?.trim();
  if (configured) {
    return configured;
  }
  if (process.platform === 'win32') {
    const cwd = process.cwd();
    return cwd.slice(0, 3);
  }
  return '/';
}
