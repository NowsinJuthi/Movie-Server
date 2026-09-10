import { clampReleaseYear, fallbackDescription, runtimeMinutesFromMs } from './import-defaults';

describe('import-defaults', () => {
  it('clamps years into the catalog range', () => {
    expect(clampReleaseYear(1999)).toBe(1999);
    expect(clampReleaseYear(1200)).toBe(1888);
    expect(clampReleaseYear(9999)).toBe(2100);
    expect(clampReleaseYear(undefined, 2024)).toBe(2024);
  });

  it('converts probe duration into runtime minutes', () => {
    expect(runtimeMinutesFromMs(7_200_000)).toBe(120);
    expect(runtimeMinutesFromMs(null, 90)).toBe(90);
    expect(runtimeMinutesFromMs(1_000)).toBe(1);
  });

  it('builds a valid fallback description', () => {
    expect(fallbackDescription('Extraction 2').length).toBeGreaterThanOrEqual(4);
  });
});
