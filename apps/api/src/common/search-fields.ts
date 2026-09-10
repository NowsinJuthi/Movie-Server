export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function uniqueNormalizedPeople(names: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    if (!name) continue;
    const normalized = normalizeSearchText(name);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export type SearchFieldSource = {
  title: string;
  originalTitle?: string | null;
  cast?: Array<{ name?: string }>;
  directors?: string[];
  writers?: string[];
};

export function buildMediaSearchFields(input: SearchFieldSource): {
  titleNormalized: string;
  originalTitleNormalized: string | null;
  peopleNormalized: string[];
} {
  return {
    titleNormalized: normalizeSearchText(input.title || ''),
    originalTitleNormalized: input.originalTitle ? normalizeSearchText(input.originalTitle) : null,
    peopleNormalized: uniqueNormalizedPeople([
      ...(input.cast ?? []).map((member) => member.name),
      ...(input.directors ?? []),
      ...(input.writers ?? []),
    ]),
  };
}

export function buildEpisodeSearchFields(title: string): { titleNormalized: string } {
  return { titleNormalized: normalizeSearchText(title || '') };
}
