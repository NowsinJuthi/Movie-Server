import { PlanFeature, type PlanFeature as PlanFeatureType, type VideoQuality } from './subscription';

export const PLAN_FEATURE_LABELS: Record<PlanFeatureType, string> = {
  [PlanFeature.Catalog]: 'Full catalog access',
  [PlanFeature.Hd]: 'HD streaming included',
  [PlanFeature.Uhd]: 'Ultra HD (4K) streaming',
  [PlanFeature.Downloads]: 'Offline downloads',
  [PlanFeature.Hdr]: 'HDR playback',
  [PlanFeature.SpatialAudio]: 'Spatial audio',
};

export type PlanFeatureLineInput = {
  maxVideoQuality: VideoQuality;
  maxStreams: number;
  maxDevices: number;
  features: PlanFeatureType[];
  featureBullets?: string[];
};

export function buildPlanFeatureLines(plan: PlanFeatureLineInput): string[] {
  const custom = (plan.featureBullets ?? []).map((line) => line.trim()).filter(Boolean);
  if (custom.length > 0) {
    return custom;
  }

  const lines = [
    `Up to ${plan.maxVideoQuality.toUpperCase()} video quality`,
    `${plan.maxStreams} simultaneous stream${plan.maxStreams === 1 ? '' : 's'}`,
    `${plan.maxDevices} registered device${plan.maxDevices === 1 ? '' : 's'}`,
  ];
  for (const feature of Object.values(PlanFeature)) {
    if (plan.features.includes(feature)) {
      lines.push(PLAN_FEATURE_LABELS[feature]);
    }
  }
  return lines;
}

export function defaultPlanFeatureLines(plan: Omit<PlanFeatureLineInput, 'featureBullets'>): string[] {
  return buildPlanFeatureLines({ ...plan, featureBullets: [] });
}

const FEATURE_BULLET_MAX_LINES = 30;
const FEATURE_BULLET_MAX_LENGTH = 200;

export function normalizeFeatureBullets(bullets?: string[] | null): string[] {
  if (!bullets?.length) return [];
  const out: string[] = [];
  for (const line of bullets) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    out.push(trimmed.slice(0, FEATURE_BULLET_MAX_LENGTH));
    if (out.length >= FEATURE_BULLET_MAX_LINES) break;
  }
  return out;
}

export function featureBulletsFromText(text: string): string[] {
  return normalizeFeatureBullets(text.split(/\r?\n/));
}

export function featureBulletsToText(bullets: string[] | undefined | null): string {
  return normalizeFeatureBullets(bullets).join('\n');
}
