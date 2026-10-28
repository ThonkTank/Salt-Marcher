import type { ItemInput } from '../catalog/item-input-contracts';

export interface ProgressGuard {
  characterId: string;
  revision: number;
}

export interface FinishRewards {
  poolXp: number;
  noXp: boolean;
  recipients: ProgressGuard[];
  policyVersion: 'xp-ceil-2014-v1';
  loadXp: number;
  items: ItemInput[];
}

export interface CombatReward {
  awardId: string;
  poolXp: number;
  shareXp: number;
  totalXp: number;
  recipientIds: string[];
  treasureId: string | null;
  policyVersion: 'xp-ceil-2014-v1';
}
