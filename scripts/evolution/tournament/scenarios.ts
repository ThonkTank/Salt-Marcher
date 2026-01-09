// Ziel: Scenario-Definitionen für NEAT Tournament System
// Siehe: docs/services/combatantAI/algorithm-approaches.md

/**
 * Konfiguration für ein Kampf-Szenario.
 * Beide Seiten verwenden NPCs (keine Player Characters).
 */
export interface ScenarioConfig {
  name: string;
  partyIds: string[];
  enemyIds: string[];
}

/**
 * Vordefinierte Szenarien für robustes Training.
 * Extrahiert aus scripts/test-selectors.ts
 */
export const SCENARIOS: ScenarioConfig[] = [
  // ============================================================================
  // BASIC - Einfache Szenarien für Basis-Training
  // ============================================================================
  {
    name: '1v1 Melee',
    partyIds: ['einaeugiger-pete'],  // Thug (HP 32)
    enemyIds: ['borgrik'],           // Hobgoblin (HP 11)
  },
  {
    name: '2v4 Mixed',
    partyIds: ['einaeugiger-pete', 'schwarzer-jack'],  // Thug + Bandit
    enemyIds: ['griknak', 'snaggle', 'borgrik', 'einsamer-wolf'],
  },
  {
    name: '1vN Horde',
    partyIds: ['borgrik'],  // Hobgoblin als starker Einzelkämpfer
    enemyIds: ['griknak', 'snaggle', 'schwarzer-jack', 'einsamer-wolf'],
  },

  // ============================================================================
  // TACTICAL - Erfordern echte Entscheidungen
  // ============================================================================

  // A: Aura-Clustering - Captain zuerst töten entfernt Advantage für alle
  {
    name: 'Aura-Cluster',
    partyIds: ['knight-aldric', 'knight-elara'],  // 2x Knight (HP 52)
    enemyIds: ['captain-krug', 'griknak', 'snaggle'],
  },

  // B: Bloodied Escalation - Berserker werden stärker bei <50% HP
  {
    name: 'Bloodied',
    partyIds: ['knight-aldric', 'scout-finn'],  // Knight + Scout
    enemyIds: ['berserker-ragnar', 'berserker-bjorn'],
  },

  // C: Kiting - Scouts vs Glass Cannon Ogre
  {
    name: 'Kiting',
    partyIds: ['scout-finn', 'scout-mira', 'scout-thorn'],  // 3x Scout (HP 16)
    enemyIds: ['ogre-grok', 'griknak', 'snaggle'],
  },

  // D: Kill the Healer - Priest kann Allies heilen
  {
    name: 'Kill Healer',
    partyIds: ['knight-aldric', 'schwarzer-jack'],  // Knight + Bandit
    enemyIds: ['priest-marcus', 'borgrik', 'griknak'],
  },

  // E: Grapple Zone - Bugbears mit 10ft Reach + Grapple
  {
    name: 'Grapple',
    partyIds: ['scout-finn', 'scout-mira'],  // 2x Scout (HP 16, Ranged)
    enemyIds: ['bugbear-gruk', 'bugbear-thrak'],
  },

  // F: Rampage - Gnolls bekommen Bonus-Angriff nach Bloodying
  {
    name: 'Rampage',
    partyIds: ['knight-aldric'],  // 1x Knight (HP 52, hohe AC)
    enemyIds: ['gnoll-yipp', 'gnoll-krak', 'griknak', 'snaggle'],
  },
];

/**
 * Subset von Szenarien für schnelleres Training.
 * Enthält je ein Basic- und ein Tactical-Szenario.
 */
export const QUICK_SCENARIOS: ScenarioConfig[] = [
  SCENARIOS[0],  // 1v1 Melee
  SCENARIOS[3],  // Aura-Cluster
];

/**
 * Findet ein Szenario nach Name.
 */
export function getScenarioByName(name: string): ScenarioConfig | undefined {
  return SCENARIOS.find(s => s.name === name);
}

/**
 * Gibt eine zufällige Auswahl von N Szenarien zurück.
 */
export function getRandomScenarios(count: number): ScenarioConfig[] {
  const shuffled = [...SCENARIOS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, SCENARIOS.length));
}
