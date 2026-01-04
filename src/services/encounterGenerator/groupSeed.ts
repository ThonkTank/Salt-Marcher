// Seed-Kreatur für Encounter auswählen
// Siehe: docs/services/encounter/groupSeed.md
//
// Pipeline-Position: Step 2 (nach Multi-Group-Check, vor groupPopulation)

import { vault } from '@/infrastructure/vault/vaultInstance';
import { randomBetween, weightedRandomSelect } from '@/utils';
import type { CreatureDefinition, ThreatLevel } from '@/types/entities';
import type { WeightedItem } from '#types/common/counting';
import type { GameDateTime } from '#types/time';
import type { FactionStatus } from '@/constants';
import { CREATURE_WEIGHTS, CR_DECAY_RATE, MIN_CR_WEIGHT } from '@/constants';
import type { Weather } from '#types/weather';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[groupSeed]', ...args);
  }
};

// ============================================================================
// TYPES (inline, per Services.md)
// ============================================================================

interface FactionData {
  id: string;
  status: FactionStatus;
  creatures: { creatureId: string }[];
}

// TerrainData für Vault-Zugriff
interface TerrainData {
  id: string;
  nativeCreatures: string[];
  threatLevel: ThreatLevel;
}

// ============================================================================
// CR-BASIERTE GEWICHTUNG (nur für fraktionslose Kreaturen)
// ============================================================================

/**
 * Berechnet Gewichtung basierend auf CR vs. Terrain-ThreatLevel.
 *
 * Kreaturen innerhalb des threatLevel-Bereichs haben volle Gewichtung (1.0).
 * Außerhalb fällt die Gewichtung linear ab: -0.2 pro CR Distanz, min 0.1.
 *
 * Beispiel: threatLevel { min: 1, max: 4 }
 * - CR 2 → 1.0 (im Bereich)
 * - CR 5 → 0.8 (1 CR über max)
 * - CR 7 → 0.4 (3 CR über max)
 * - CR 9+ → 0.1 (min)
 */
function calculateCRWeight(
  cr: number,
  threatLevel: ThreatLevel
): number {
  if (cr >= threatLevel.min && cr <= threatLevel.max) {
    return 1.0; // Volle Gewichtung im Bereich
  }

  // Steiler linearer Abfall außerhalb: -0.2 pro CR
  const distance = cr < threatLevel.min
    ? threatLevel.min - cr
    : cr - threatLevel.max;

  // 1.0 → MIN_CR_WEIGHT über Distanz von 4.5 CR
  const decay = Math.max(MIN_CR_WEIGHT, 1.0 - distance * CR_DECAY_RATE);
  return decay;
}

// ============================================================================
// STEP 2.0: FRAKTIONS/NATIV-AUSWAHL
// Siehe: docs/services/encounter/groupSeed.md#step-20-fraktionsnativ-auswahl
// ============================================================================

/**
 * Entscheidet ob Fraktions-Kreaturen oder native Kreaturen verwendet werden.
 *
 * Roll über tile.crBudget: Fraktionen belegen Teile davon, Rest = native Kreaturen.
 * Siehe: docs/services/encounter/groupSeed.md#step-20
 *
 * @param factions - Fraktionen mit ihren Gewichten (strength auf dem Tile)
 * @param crBudget - CR-Budget des Tiles (tile.crBudget ?? terrain.defaultCrBudget)
 * @returns factionId wenn Fraktion gewählt, null für native Kreaturen
 */
function selectFactionOrNative(
  factions: { factionId: string; randWeighting: number }[],
  crBudget: number
): string | null {
  if (factions.length === 0) {
    return null; // Keine Fraktionen → native Kreaturen
  }

  // Debug: Zeige wie die Roll-Bereiche aufgeteilt sind
  debug('Faction thresholds:', factions.map((f, i) => {
    const start = factions.slice(0, i).reduce((sum, x) => sum + x.randWeighting, 0);
    return `${f.factionId}=${start + 1}-${start + f.randWeighting}`;
  }).join(', ') + `, native=${factions.reduce((sum, f) => sum + f.randWeighting, 0) + 1}-${crBudget}`);

  // Roll über gesamtes CR-Budget (per Spec: groupSeed.md#step-20)
  // Fraktionen belegen ihre Anteile, Rest = native Kreaturen
  // Wenn crBudget < factionTotal, dominieren Fraktionen (100%)
  const roll = randomBetween(1, crBudget);

  // Gestaffelte Fraktions-Bereiche prüfen
  let threshold = 0;
  for (const faction of factions) {
    threshold += faction.randWeighting;
    if (roll <= threshold) {
      debug('Faction roll:', roll, '/', crBudget, '→', faction.factionId);
      return faction.factionId;
    }
  }

  // Roll außerhalb aller Fraktionen → native Kreaturen
  debug('Faction roll:', roll, '/', crBudget, '→ native (no faction)');
  return null;
}

// ============================================================================
// STEP 2.1: EXCLUDE-FILTER
// ============================================================================

/**
 * Filtert Kreaturen nach Exclude-Liste.
 *
 * Terrain-Filterung erfolgt bereits in:
 * - getTerrainNativeCreatures() für fraktionslose Kreaturen
 * - getFactionCreatures() liefert alle Fraktionsmitglieder (terrain-unabhängig)
 */
function filterByExclude(
  creatures: CreatureDefinition[],
  exclude?: string[]
): CreatureDefinition[] {
  if (!exclude?.length) return creatures;

  const excluded = creatures.filter(c => exclude.includes(c.id)).map(c => c.id);
  if (excluded.length) {
    debug('Excluded:', excluded.join(', '));
  }

  return creatures.filter(c => !exclude.includes(c.id));
}

/**
 * Wendet Gewichtungen auf gefilterte Kreaturen an.
 *
 * Gewichtungs-Faktoren:
 * - CR-basierte Rarity: Kreaturen außerhalb des Terrain-ThreatLevel-Bereichs
 *   werden seltener (nur für fraktionslose Kreaturen)
 * - Activity Time: match = ×2.0, mismatch = ×0.5
 * - Weather-Präferenz: prefers = ×2.0, avoids = ×0.5 (basierend auf Event-Tags)
 */
function applyWeights(
  creatures: CreatureDefinition[],
  weather?: Weather,
  threatLevel?: ThreatLevel,
  isFactionless?: boolean,
  timeSegment?: GameDateTime['segment']
): WeightedItem<CreatureDefinition>[] {
  const result = creatures.map(creature => {
    let weight = 1.0;

    // CR-basierte Rarity (nur für fraktionslose Kreaturen)
    if (isFactionless && threatLevel) {
      weight *= calculateCRWeight(creature.cr, threatLevel);
    }

    // Activity Time: match = ×2.0, mismatch = ×0.5
    if (timeSegment && creature.activeTime) {
      if (creature.activeTime.includes(timeSegment)) {
        debug(`Time weight: ${creature.id} active=${timeSegment} → ×${CREATURE_WEIGHTS.activeTimeMatch}`);
        weight *= CREATURE_WEIGHTS.activeTimeMatch;
      } else {
        debug(`Time weight: ${creature.id} inactive=${timeSegment} → ×${CREATURE_WEIGHTS.activeTimeMismatch}`);
        weight *= CREATURE_WEIGHTS.activeTimeMismatch;
      }
    }

    // Weather-Präferenz: prefers = ×2.0, avoids = ×0.5 (basierend auf Event-Tags)
    if (weather?.event && creature.preferences?.weather) {
      const { prefers, avoids } = creature.preferences.weather;
      const eventTags = weather.event.tags;

      // Prüfe ob irgendein preferred Tag matcht
      if (prefers?.some(tag => eventTags.includes(tag))) {
        debug(`Weather weight: ${creature.id} prefers tags in [${eventTags.join(',')}] → ×${CREATURE_WEIGHTS.weatherPrefers}`);
        weight *= CREATURE_WEIGHTS.weatherPrefers;
      }
      // Prüfe ob irgendein avoided Tag matcht
      else if (avoids?.some(tag => eventTags.includes(tag))) {
        debug(`Weather weight: ${creature.id} avoids tags in [${eventTags.join(',')}] → ×${CREATURE_WEIGHTS.weatherAvoids}`);
        weight *= CREATURE_WEIGHTS.weatherAvoids;
      }
    }

    return { item: creature, randWeighting: weight };
  });

  // CR-Weights zusammengefasst nach CR
  if (isFactionless && threatLevel) {
    const crGroups = new Map<number, { count: number; crWeight: number }>();
    creatures.forEach(c => {
      const w = calculateCRWeight(c.cr, threatLevel);
      if (!crGroups.has(c.cr)) crGroups.set(c.cr, { count: 0, crWeight: w });
      crGroups.get(c.cr)!.count++;
    });
    const summary = [...crGroups.entries()]
      .map(([cr, { count, crWeight }]) => `${count}× CR=${cr} → ${crWeight.toFixed(2)}`)
      .join(', ');
    debug(`CR weights: ${summary}`);
  }

  debug('Weighted pool:', result.map(w => `${w.item.id}:${w.randWeighting.toFixed(2)}`).join(', '));
  return result;
}

// ============================================================================
// STEP 2.2: SEED-KREATUR-AUSWAHL
// Siehe: docs/services/encounter/groupSeed.md#step-22-seed-kreatur-auswahl
// ============================================================================

/**
 * Wählt eine Seed-Kreatur aus dem gewichteten Pool.
 */
function selectSeedCreature(
  weightedCreatures: WeightedItem<CreatureDefinition>[]
): CreatureDefinition | null {
  const selected = weightedRandomSelect(weightedCreatures);
  debug('Selected:', selected?.id ?? 'null', 'from', weightedCreatures.length, 'candidates');
  return selected;
}

// ============================================================================
// VAULT-ZUGRIFF HELPER
// ============================================================================

/**
 * Lädt Kreaturen für eine Fraktion.
 *
 * Spec-konform: Lädt Faction aus Vault und resolved deren creatures-Liste.
 * Nur active Fraktionen liefern Kreaturen (dormant/extinct = leer).
 */
function getFactionCreatures(factionId: string): CreatureDefinition[] {
  const faction = vault.getEntity<FactionData>('faction', factionId);
  if (!faction || faction.status !== 'active') {
    debug('Faction creatures:', factionId, '→ 0 (not found or inactive)');
    return [];
  }

  const creatures = faction.creatures
    .map(c => vault.getEntity<CreatureDefinition>('creature', c.creatureId))
    .filter((c): c is CreatureDefinition => c !== null);
  debug('Faction creatures:', factionId, '→', creatures.length);
  return creatures;
}

/**
 * Lädt native Kreaturen für ein Terrain.
 *
 * Spec-konform: Lädt Terrain aus Vault und resolved deren nativeCreatures-Liste.
 * Fallback: Wenn Terrain nicht gefunden, filtert über terrainAffinities.
 */
function getTerrainNativeCreatures(terrainId: string): CreatureDefinition[] {
  const terrain = vault.getEntity<TerrainData>('terrain', terrainId);
  if (!terrain) {
    // Fallback wenn Terrain nicht im Vault
    const allCreatures = vault.getAllEntities<CreatureDefinition>('creature');
    const filtered = allCreatures.filter((c: CreatureDefinition) => c.terrainAffinities.includes(terrainId));
    debug('Native creatures:', terrainId, '→', filtered.length, '(fallback)');
    return filtered;
  }

  const creatures = terrain.nativeCreatures
    .map(id => vault.getEntity<CreatureDefinition>('creature', id))
    .filter((c): c is CreatureDefinition => c !== null);
  debug('Native creatures:', terrainId, '→', creatures.length);
  return creatures;
}

// ============================================================================
// HAUPT-FUNKTION
// ============================================================================

/**
 * Wählt eine Seed-Kreatur basierend auf Terrain, Zeit und Fraktionen.
 * Gibt null zurück wenn keine geeignete Kreatur gefunden wird.
 *
 * Pipeline: encounterGenerator.ts → selectSeed → groupPopulation.ts
 *
 * @param context.terrain - Terrain-Daten mit id
 * @param context.crBudget - CR-Budget des Tiles (tile.crBudget ?? terrain.defaultCrBudget)
 * @param context.timeSegment - Aktuelle Tageszeit
 * @param context.factions - Anwesende Fraktionen mit Gewichtung
 * @param context.exclude - Creature-IDs die ausgeschlossen werden sollen
 * @param context.weather - Aktuelles Wetter für Präferenz-Gewichtung
 *
 * @returns Seed-Auswahl mit creatureId und optionaler factionId, oder null
 */
export function selectSeed(context: {
  terrain: { id: string };
  crBudget: number;
  timeSegment: GameDateTime['segment'];
  factions: { factionId: string; randWeighting: number }[];
  exclude?: string[];
  weather?: Weather;
}): { creatureId: string; factionId: string | null } | null {
  debug('Input:', {
    terrain: context.terrain.id,
    crBudget: context.crBudget,
    timeSegment: context.timeSegment,
    factions: context.factions.length,
    exclude: context.exclude?.length ?? 0,
    weather: context.weather?.event?.id,
  });

  // -------------------------------------------------------------------------
  // Step 2.0: Fraktions/Nativ-Auswahl
  // -------------------------------------------------------------------------
  const selectedFactionId = selectFactionOrNative(
    context.factions,
    context.crBudget
  );

  // -------------------------------------------------------------------------
  // Step 2.1: Creature-Pool laden und filtern
  // -------------------------------------------------------------------------
  const isFactionless = selectedFactionId === null;
  let creaturePool: CreatureDefinition[];

  // Terrain laden für threatLevel (CR-basierte Gewichtung)
  const terrain = vault.getEntity<TerrainData>('terrain', context.terrain.id);
  const threatLevel = terrain?.threatLevel;
  debug('Terrain threatLevel:', threatLevel ? `{ min: ${threatLevel.min}, max: ${threatLevel.max} }` : 'not found');

  if (!isFactionless) {
    // Fraktions-Kreaturen laden
    creaturePool = getFactionCreatures(selectedFactionId);
  } else {
    // Native Kreaturen laden
    creaturePool = getTerrainNativeCreatures(context.terrain.id);
  }

  // Exclude-Filter anwenden (Terrain bereits in Pool-Laden gefiltert)
  const eligibleCreatures = filterByExclude(creaturePool, context.exclude);

  if (eligibleCreatures.length === 0) {
    return null; // Keine geeigneten Kreaturen gefunden
  }

  // Gewichtungen anwenden (inkl. Weather, Time + CR-basierte Rarity für fraktionslose)
  const weightedCreatures = applyWeights(
    eligibleCreatures,
    context.weather,
    threatLevel,
    isFactionless,
    context.timeSegment
  );

  // -------------------------------------------------------------------------
  // Step 2.2: Seed-Kreatur auswählen
  // -------------------------------------------------------------------------
  const selectedCreature = selectSeedCreature(weightedCreatures);

  if (!selectedCreature) {
    return null;
  }

  return {
    creatureId: selectedCreature.id,
    factionId: selectedFactionId,
  };
}
