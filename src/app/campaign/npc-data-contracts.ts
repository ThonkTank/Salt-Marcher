import type { CharacterHealth } from '../runtime/character-progress-contracts';

export interface NpcDemographics {
  ancestry: string;
  gender: string;
  ageYears: number | null;
}

export interface NpcDailySlot {
  id: string;
  startMinute: number;
  endMinute: number;
  activity: string;
  place: 'home' | 'work' | 'other' | 'location';
  locationId?: string;
  notes: string;
  weekdays?: number[];
}

export interface NpcPlanLocation {
  locationId: string;
  title: string;
  available: boolean;
}

export interface NpcDailyOverride {
  day: string;
  label: string;
  slots: NpcDailySlot[];
}

export interface NpcRecord {
  id: string;
  revision: number;
  factionId: string | null;
  modifier: number;
  lifecycle: 'active' | 'defeated';
  appearance: string;
  behavior: string;
  history: string;
  demographics?: NpcDemographics;
  dailyPlan?: NpcDailySlot[];
  dailyOverrides?: NpcDailyOverride[];
}

export type NpcRole = 'friendly' | 'neutral' | 'hostile';

export interface NpcView {
  id: string;
  name: string;
  noteRevision: number;
  creatureId: string | null;
  readAloud: string;
  gmNotes: string;
  record: NpcRecord;
  locationId: string | null;
  positionRevision: number | null;
  actorRevision: number | null;
  health: CharacterHealth | null;
  disposition: number;
  role: NpcRole;
}

export interface NpcQuery {
  text: string;
  lifecycle: 'all' | 'active' | 'defeated';
  factionId: string | null;
  locationId: string | null;
  offset: number;
  onlyUnplaced?: boolean;
}

export interface NpcPage {
  rows: {
    id: string;
    name: string;
    creatureId: string | null;
    lifecycle: NpcRecord['lifecycle'];
    factionId: string | null;
    locationId: string | null;
    disposition: number;
    role: NpcRole;
  }[];
  total: number;
  offset: number;
  onlyUnplaced?: boolean;
}
