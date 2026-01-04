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
    currentHp: 44,
    ac: 18,
    passivePerception: 12,
    passiveStealth: 10,  // DEX-Mod 0, keine Proficiency
    speed: 30,
    strength: 16,
    inventory: [],
  },
  {
    id: 'test-wizard',
    name: 'Elara',
    level: 5,
    class: 'Wizard',
    maxHp: 27,
    currentHp: 27,
    ac: 13,
    passivePerception: 14,
    passiveStealth: 12,  // DEX-Mod +2
    speed: 30,
    strength: 8,
    inventory: [],
  },
];

export default characterPresets;
