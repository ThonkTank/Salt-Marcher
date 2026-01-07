// Character-Presets fuer CLI-Testing
// Siehe: docs/features/Character-System.md

// ============================================================================
// PRESET-DATEN
// ============================================================================

/**
 * Minimale Character-Presets fuer CLI-Testing.
 * Enthalten nur die Felder die fuer Encounter-Generierung benoetigt werden.
 */
export const characterPresets = [
  {
    id: 'test-fighter',
    name: 'Thorin',
    level: 5,
    class: 'Fighter',
    maxHp: 44,
    currentHp: [[44, 1]],
    ac: 18,
    passivePerception: 12,
    passiveStealth: 10,  // DEX-Mod 0, keine Proficiency
    speed: 30,
    abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 12, cha: 8 },
    saveProficiencies: ['str', 'con'] as const,  // Fighter Save Proficiencies
    inventory: [],
  },
  {
    id: 'test-wizard',
    name: 'Elara',
    level: 5,
    class: 'Wizard',
    maxHp: 27,
    currentHp: [[27, 1]],
    ac: 13,
    passivePerception: 14,
    passiveStealth: 12,  // DEX-Mod +2
    speed: 30,
    abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 14, cha: 10 },
    saveProficiencies: ['int', 'wis'] as const,  // Wizard Save Proficiencies
    inventory: [],
  },
];

export default characterPresets;
