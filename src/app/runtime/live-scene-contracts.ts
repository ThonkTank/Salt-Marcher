import { type LiveMomentDraft } from './live-moment-drafts';
import type { VisitOutcome } from './visit-outcome-contracts';

export interface CharacterProfile {
  name: string;
  archive?: { recordedAt: string; reason: string };
  playerName?: string;
  species?: string;
  characterClass?: string;
  armorClass?: number;
  passivePerception?: number;
  passiveInsight?: number;
  passiveInvestigation?: number;
  languages?: string[];
  speedFeet?: number;
}

export interface Character {
  id: string;
  ordinal: number;
  profile: CharacterProfile;
  profileRevision: number;
  archived?: boolean;
  active: boolean;
  membershipRevision: number;
  sceneId: string | null;
}

export interface LiveScene {
  momentDraft?: LiveMomentDraft | null;
  momentDraftError?: string;
  id: string;
  revision: number;
  title: string;
  notes: string;
  readAloud?: string;
  locationId: string | null;
  membershipRevision: number;
  retired: boolean;
  clock: { epochId: string; instantMs: string; revision: number };
  members: string[];
  adoption: {
    outcome?: VisitOutcome | null;
    id: string;
    planId: string;
    planRevision: number;
    visitId: string;
    title: string;
    notes: string;
    locationId: string | null;
  } | null;
}

export type SessionRecapDraft = { summary: string; handoff: string };

export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';
