// src/workmodes/library/entities/factions/constants.ts
// Shared enumerations and suggestions for factions UI fields

export const FACTION_INFLUENCE_TAGS = [
  "Political",
  "Military",
  "Religious",
  "Economic",
  "Arcane",
  "Criminal",
  "Scholarly",
  "Mercantile",
  "Civic",
  "Shadow"
] as const;

export const FACTION_CULTURE_TAGS = [
  "Human",
  "Elven",
  "Dwarven",
  "Halfling",
  "Orcish",
  "Dragonborn",
  "Tiefling",
  "Mixed",
  "Outsider",
  "Undead"
] as const;

export const FACTION_GOAL_TAGS = [
  "Expansion",
  "Defense",
  "Knowledge",
  "Dominance",
  "Reformation",
  "Profit",
  "Faith",
  "Revenge",
  "Exploration",
  "Stability"
] as const;

export const FACTION_MEMBER_ROLES = [
  "Leader",
  "Advisor",
  "Envoy",
  "Operative",
  "Spy",
  "Champion",
  "Agent",
  "Quartermaster",
  "Scout",
  "Guard",
  "Worker",
  "Crafter",
  "Mage",
  "Cleric"
] as const;

export const FACTION_MEMBER_STATUSES = [
  "Active",
  "On Assignment",
  "Missing",
  "Deceased",
  "Retired"
] as const;

export const FACTION_JOB_TYPES = [
  "crafting",
  "gathering",
  "training",
  "summoning",
  "guard",
  "patrol",
  "research"
] as const;

export const FACTION_POSITION_TYPES = [
  "hex",
  "poi",
  "expedition",
  "unassigned"
] as const;

export const FACTION_RELATIONSHIP_TYPES = [
  "allied",
  "neutral",
  "hostile",
  "trade",
  "rivalry",
  "vassal"
] as const;

export const FACTION_RESOURCE_TYPES = [
  "gold",
  "food",
  "equipment",
  "magic",
  "influence"
] as const;
