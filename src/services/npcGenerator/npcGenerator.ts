// Ziel: NPC-Generierung für Encounter, Quest, Shop, POI
// Siehe: docs/services/npcs/NPC-Generation.md
//
// Pipeline:
// 1. selectCulture() - Kultur-Auswahl mit gewichtetem Pool
// 2. resolveAttributes() - Attribut-Resolution aus Culture + Faction.influence
// 3. generateNPC() - Orchestriert Pipeline, gibt NPC zurück (OHNE Persistierung)
//
// NPC-Felder (6 unabhängige Attribute):
// - name: Generiert aus Culture.naming Patterns
// - personality: EIN Trait (z.B. "cunning", "brave")
// - value: EIN Wert (z.B. "survival", "wealth")
// - quirk: EINE Eigenheit (optional)
// - appearance: EIN Merkmal (optional)
// - goal: EIN Ziel (z.B. "Überleben", "Rache")

import type { CreatureDefinition } from '#types/entities/creature';
import type { Culture } from '#types/entities/culture';
import type { Species } from '#types/entities/species';
import type { Faction } from '#types/entities/faction';
import type { NPC } from '#types/entities/npc';
import type { GameDateTime } from '#types/time';
import type { HexCoordinate } from '#types/hexCoordinate';
import {
  selectCulture,
  resolveAttributes,
  rollDice,
  createSingleValue,
} from '@/utils';
import { vault } from '@/infrastructure/vault/vaultInstance';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[npcGenerator]', ...args);
  }
};

// ============================================================================
// TYPES
// ============================================================================

/** Optionen für NPC-Generierung */
export interface GenerateNPCOptions {
  position?: HexCoordinate;
  time: GameDateTime;  // Required - Caller muss Zeit übergeben
  allCultures?: Culture[];  // Optional - für Batch-Generierung (Cache)
}

// ============================================================================
// ID GENERATION
// ============================================================================

/**
 * Generiert eine eindeutige NPC-ID.
 * Format: npc-<timestamp>-<random>
 */
function generateNPCId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `npc-${timestamp}-${random}`;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generiert einen neuen NPC für die Kreatur.
 *
 * @param creature - Die Kreatur-Definition (aus Preset oder Vault)
 * @param faction - Die Fraktion (falls vorhanden)
 * @param options - Position und Zeit (time ist required)
 * @returns Vollständiges NPC-Objekt (NICHT persistiert)
 */
export function generateNPC(
  creature: CreatureDefinition,
  faction: Faction | null,
  options: GenerateNPCOptions
): NPC {
  debug('Generating NPC for creature:', creature.id, 'faction:', faction?.id ?? 'none');

  // 1. Species und Cultures laden
  const species = creature.species
    ? vault.getEntity<Species>('species', creature.species)
    : null;

  const allCultures = options.allCultures
    ?? vault.getAllEntities<Culture>('culture');

  // 2. Kultur auswählen (Phase 1)
  const selectedCulture = selectCulture(creature, species, faction, allCultures);
  debug('Selected culture:', selectedCulture.id);

  // 3. Attribute auflösen (Phase 2)
  const attributes = resolveAttributes(creature, species, selectedCulture, faction);
  debug('Resolved attributes:', attributes);

  // 4. HP würfeln
  const maxHp = rollDice(creature.hitDice);

  // 5. NPC zusammenbauen
  const now = options.time;

  const npc: NPC = {
    id: generateNPCId(),
    name: attributes.name,
    creature: {
      type: creature.tags[0] ?? 'unknown',
      id: creature.id,
    },
    factionId: faction?.id,
    cultureId: selectedCulture.id,
    personality: attributes.personality ?? 'neutral',
    value: attributes.value ?? 'survival',
    quirk: attributes.quirk,
    appearance: attributes.appearance,
    styling: attributes.styling,
    goal: attributes.goal ?? 'Überleben',
    status: 'alive',
    firstEncounter: now,
    lastEncounter: now,
    encounterCount: 1,
    lastKnownPosition: options?.position,
    reputations: [],
    currentHp: createSingleValue(maxHp),
    maxHp,
    possessions: [],  // Persistente Besitztümer (via encounterLoot befüllt)
    carriedPossessions: undefined,  // Ephemer: was NPC gerade dabei hat (berechnet pro Encounter)
  };

  debug('Generated NPC:', {
    id: npc.id,
    name: npc.name,
    cultureId: npc.cultureId,
    personality: npc.personality,
    value: npc.value,
    quirk: npc.quirk,
    appearance: npc.appearance,
    styling: npc.styling,
    goal: npc.goal,
    hp: `${npc.currentHp}/${npc.maxHp}`,
  });

  return npc;
}

export default generateNPC;
