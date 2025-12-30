// Fraktions-bezogene Konstanten
// Siehe: docs/entities/faction.md

// Fraktions-Lebenszyklus-Status
export const FACTION_STATUSES = ['active', 'dormant', 'extinct'] as const;
export type FactionStatus = typeof FACTION_STATUSES[number];
