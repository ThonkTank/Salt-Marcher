import {
  campaignId,
  payloadDigest,
  type CampaignId,
} from "../campaign/campaign-contracts";

export type { CampaignId };

export function canonicalCampaignId(
  value: unknown,
  label: string,
): CampaignId {
  if (typeof value !== "string")
    throw new Error(`${label} ist keine Campaign-ID.`);
  try {
    return campaignId(value);
  } catch {
    throw new Error(`${label} ist keine kanonische Campaign-ID.`);
  }
}

export function evidenceDigest(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} fehlt.`);
  try {
    return payloadDigest(value);
  } catch {
    throw new Error(`${label} ist kein kanonischer SHA-256-Beleg.`);
  }
}
