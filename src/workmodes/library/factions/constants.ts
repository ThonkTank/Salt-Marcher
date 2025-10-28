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
  "Quartermaster"
] as const;

export const FACTION_MEMBER_STATUSES = [
  "Active",
  "On Assignment",
  "Missing",
  "Deceased",
  "Retired"
] as const;
