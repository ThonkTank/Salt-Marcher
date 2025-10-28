// src/workmodes/library/entities/factions/types.ts
// Type definitions for faction entities

export interface FactionMember {
  name: string;
  role?: string;
  status?: string;
  is_named?: boolean;
  notes?: string;
}

export interface FactionData {
  name: string;
  motto?: string;
  headquarters?: string;
  territory?: string;
  influence_tags?: Array<{ value: string }>;
  culture_tags?: Array<{ value: string }>;
  goal_tags?: Array<{ value: string }>;
  summary?: string;
  assets?: string;
  relationships?: string;
  members?: FactionMember[];
}
