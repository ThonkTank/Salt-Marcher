export type EncounterRole = 'Minion' | 'Support' | 'Standard' | 'Elite' | 'Boss';

export type EncounterCatalog = Readonly<{
  catalogVersion: string;
  catalogContentHash: string;
  progression: readonly ProgressionRow[];
  challengeRatings: readonly ChallengeRating[];
  roleBands: readonly RoleBand[];
  patterns: readonly EncounterPattern[];
}>;

export type ProgressionRow = Readonly<{
  level: number;
  dayXpPerCharacter: number;
  dayXpParty4: number;
  mediumXpPerCharacter: number;
  hardXpPerCharacter: number;
  deadlyXpPerCharacter: number;
}>;

export type ChallengeRating = Readonly<{
  id: string;
  code: number;
  label: string;
  xp: number;
  active: boolean;
}>;

export type RoleBand = Readonly<{
  partyLevel: number;
  crId: string;
  role: EncounterRole;
  active: boolean;
  sourceRow: number;
}>;

export type EncounterPattern = Readonly<{
  id: string;
  roles: readonly EncounterRole[];
  active: boolean;
  sortOrder: number;
}>;
