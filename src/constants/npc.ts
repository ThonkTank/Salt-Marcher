// NPC-bezogene Konstanten
// Siehe: docs/entities/npc.md

// NPC-Lebensstatus
export const NPC_STATUSES = ['alive', 'dead'] as const;
export type NPCStatus = typeof NPC_STATUSES[number];
