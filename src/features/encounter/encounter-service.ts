/**
 * Encounter service - main orchestrator for the Encounter Feature.
 *
 * Responsibilities:
 * - Handle encounter generation requests (manual, time-based, travel)
 * - Manage encounter state machine (pending → active → resolved)
 * - Publish encounter events
 * - Coordinate NPC instantiation
 *
 * @see docs/features/Encounter-System.md
 */

import type { Result, AppError, Option, Unsubscribe } from '@core/index';
import { ok, err, some, none, createError, isNone, isSome } from '@core/index';
import type { EventBus } from '@core/events';
import {
  EventTypes,
  createEvent,
  newCorrelationId,
  type EncounterGenerateRequestedPayload,
  type EncounterStartRequestedPayload,
  type EncounterDismissRequestedPayload,
  type EncounterResolveRequestedPayload,
  type MapLoadedPayload,
  type TravelPositionChangedPayload,
  type CombatCompletedPayload,
} from '@core/events';
import { now, type EntityId } from '@core/types';
import type {
  EncounterInstance,
  EncounterOutcome,
  CreatureDefinition,
  Faction,
  NPC,
  GameDateTime,
  EncounterType,
  CombatParticipant,
  CombatOutcome,
} from '@core/schemas';
import { MAX_REROLL_ATTEMPTS } from '@core/schemas';
import type { MapFeaturePort } from '../map';
import type { PartyFeaturePort } from '../party';
import type { TimeFeaturePort } from '../time';
import type { EncounterFeaturePort, GenerationContext, FactionWeight } from './types';
import type { EncounterStore } from './encounter-store';
import {
  filterEligibleCreatures,
  selectWeightedCreature,
  deriveEncounterType,
  validateVariety,
  populateEncounter,
  calculateEncounterXP,
} from './encounter-utils';
import {
  resolveFactionCulture,
  selectOrGenerateNpc,
  createEncounterLeadNpc,
} from './npc-generator';
import {
  calculateEncounterChance,
  rollEncounter,
  DEFAULT_POPULATION,
} from './encounter-chance';

// ============================================================================
// Encounter Service Dependencies
// ============================================================================

/**
 * Dependencies for creating the encounter service.
 */
export interface EncounterServiceDeps {
  store: EncounterStore;
  mapFeature: MapFeaturePort;
  partyFeature: PartyFeaturePort;
  timeFeature: TimeFeaturePort;
  eventBus: EventBus;
  /** Creature definitions (presets) */
  creatures: readonly CreatureDefinition[];
  /** Faction definitions (presets) */
  factions: readonly Faction[];
  /** Existing NPCs for reuse (optional) */
  existingNpcs?: readonly NPC[];
}

// ============================================================================
// Encounter Service Factory
// ============================================================================

/**
 * Create the encounter service.
 */
export function createEncounterService(
  deps: EncounterServiceDeps
): EncounterFeaturePort {
  const {
    store,
    mapFeature,
    partyFeature,
    timeFeature,
    eventBus,
    creatures,
    factions,
    existingNpcs = [],
  } = deps;

  const subscriptions: Unsubscribe[] = [];

  // Build faction lookup map
  const factionMap = new Map(factions.map((f) => [f.id, f]));

  // --------------------------------------------------------------------------
  // Internal Helpers
  // --------------------------------------------------------------------------

  /**
   * Get current game time.
   */
  function getCurrentTime(): GameDateTime {
    return timeFeature.getCurrentTime();
  }

  /**
   * Get party level for encounter scaling.
   */
  function getPartyLevel(): number | undefined {
    const party = partyFeature.getCurrentParty();
    if (isNone(party)) return undefined;
    // TODO: Calculate actual party level from members
    return 1;
  }

  /**
   * Build faction weights for a location.
   * For MVP: equal weights for all factions.
   * Future: calculate from faction territory/POI proximity.
   */
  function getFactionWeights(): FactionWeight[] {
    return factions.map((f) => ({
      factionId: f.id,
      weight: 1.0,
    }));
  }

  /**
   * Resolve faction for a creature.
   */
  function resolveFaction(creature: CreatureDefinition): Faction | null {
    // Try creature's faction first, then fallback to base-beasts
    if (creature.defaultFactionId) {
      const faction = factionMap.get(creature.defaultFactionId);
      if (faction) return faction;
    }

    // Fallback: search by id string since 'base-beasts' is not branded
    for (const faction of factions) {
      if (faction.id === 'base-beasts') return faction;
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // Combat Integration
  // --------------------------------------------------------------------------

  /**
   * Create combat participants from encounter creatures.
   * Initiative values default to 0; GM will set them in the UI.
   */
  function createCombatParticipantsFromEncounter(
    encounter: EncounterInstance
  ): CombatParticipant[] {
    return encounter.creatures.map((ci) => {
      const creatureDef = creatures.find((c) => c.id === ci.definitionId);

      return {
        id: ci.instanceId,
        type: 'creature' as const,
        entityId: ci.instanceId,
        name: creatureDef?.name ?? 'Unknown Creature',
        initiative: 0, // GM enters initiative manually
        maxHp: creatureDef?.maxHp ?? 10,
        currentHp: ci.currentHp,
        conditions: ci.conditions.map((type) => ({
          type: type as import('@core/schemas').ConditionType,
          reminder: '',
        })),
        effects: [],
        concentratingOn: ci.concentrationSpell,
      };
    });
  }

  /**
   * Publish combat start request for a combat encounter.
   */
  function publishCombatStartRequested(
    encounter: EncounterInstance,
    correlationId?: string
  ): void {
    const participants = createCombatParticipantsFromEncounter(encounter);

    eventBus.publish(
      createEvent(
        EventTypes.COMBAT_START_REQUESTED,
        {
          participants,
          fromEncounter: encounter.id as EntityId<'encounter'>,
        },
        {
          correlationId: correlationId ?? newCorrelationId(),
          timestamp: now(),
          source: 'encounter-feature',
        }
      )
    );
  }

  /**
   * Map combat outcome to encounter outcome.
   */
  function mapCombatOutcomeToEncounter(combatOutcome: CombatOutcome): EncounterOutcome {
    switch (combatOutcome) {
      case 'victory':
        return 'victory';
      case 'defeat':
        return 'defeat';
      case 'fled':
        return 'fled';
      case 'negotiated':
        return 'negotiated';
    }
  }

  // --------------------------------------------------------------------------
  // Event Publishing
  // --------------------------------------------------------------------------

  /**
   * Publish encounter generated event.
   */
  function publishEncounterGenerated(
    encounter: EncounterInstance,
    correlationId?: string
  ): void {
    eventBus.publish(
      createEvent(
        EventTypes.ENCOUNTER_GENERATED,
        { encounter },
        {
          correlationId: correlationId ?? newCorrelationId(),
          timestamp: now(),
          source: 'encounter-feature',
        }
      )
    );
  }

  /**
   * Publish encounter started event.
   */
  function publishEncounterStarted(
    encounter: EncounterInstance,
    correlationId?: string
  ): void {
    eventBus.publish(
      createEvent(
        EventTypes.ENCOUNTER_STARTED,
        {
          encounterId: encounter.id,
          type: encounter.type,
          encounter,
        },
        {
          correlationId: correlationId ?? newCorrelationId(),
          timestamp: now(),
          source: 'encounter-feature',
        }
      )
    );
  }

  /**
   * Publish encounter dismissed event.
   */
  function publishEncounterDismissed(
    encounterId: string,
    reason?: string,
    correlationId?: string
  ): void {
    eventBus.publish(
      createEvent(
        EventTypes.ENCOUNTER_DISMISSED,
        { encounterId, reason },
        {
          correlationId: correlationId ?? newCorrelationId(),
          timestamp: now(),
          source: 'encounter-feature',
        }
      )
    );
  }

  /**
   * Publish encounter resolved event.
   */
  function publishEncounterResolved(
    encounterId: string,
    outcome: EncounterOutcome,
    xpAwarded: number,
    correlationId?: string
  ): void {
    eventBus.publish(
      createEvent(
        EventTypes.ENCOUNTER_RESOLVED,
        { encounterId, outcome, xpAwarded },
        {
          correlationId: correlationId ?? newCorrelationId(),
          timestamp: now(),
          source: 'encounter-feature',
        }
      )
    );
  }

  /**
   * Publish state changed event.
   */
  function publishStateChanged(correlationId?: string): void {
    const state = store.getState();

    eventBus.publish(
      createEvent(
        EventTypes.ENCOUNTER_STATE_CHANGED,
        {
          currentEncounter: state.currentEncounter,
          historyLength: state.history.length,
        },
        {
          correlationId: correlationId ?? newCorrelationId(),
          timestamp: now(),
          source: 'encounter-feature',
        }
      )
    );
  }

  // --------------------------------------------------------------------------
  // Core Generation Pipeline
  // --------------------------------------------------------------------------

  /**
   * Execute the 5-step encounter generation pipeline.
   */
  function executeGenerationPipeline(
    context: GenerationContext,
    correlationId?: string
  ): Result<EncounterInstance, AppError> {
    const { terrainId, timeSegment, weather, partyLevel } = context;
    const recentTypes = store.getState().recentCreatureTypes;
    const factionWeights = getFactionWeights();

    // Step 1: Tile-Eligibility (terrain + time filter)
    const eligible = filterEligibleCreatures(creatures, terrainId, timeSegment);
    if (eligible.length === 0) {
      return err(
        createError(
          'NO_ELIGIBLE_CREATURES',
          `No creatures eligible for terrain "${terrainId}" at ${timeSegment}`
        )
      );
    }

    // Steps 2-4: Selection with variety validation (with rerolls)
    let selectedCreature: CreatureDefinition | null = null;
    let selectedFaction: Faction | null = null;
    let encounterType: EncounterType = 'social';

    for (let attempt = 0; attempt < MAX_REROLL_ATTEMPTS; attempt++) {
      // Step 2: Weighted creature selection
      const selection = selectWeightedCreature(
        eligible,
        factionWeights,
        weather ?? null,
        terrainId
      );

      if (!selection) {
        return err(createError('SELECTION_FAILED', 'Failed to select creature'));
      }

      const creature = selection.creature;

      // Step 3: Type derivation
      const typeResult = deriveEncounterType(creature, partyLevel);
      encounterType = typeResult.type;

      // Step 4: Variety validation
      const varietyResult = validateVariety(creature, recentTypes);

      if (varietyResult.valid || attempt === MAX_REROLL_ATTEMPTS - 1) {
        // Accept this selection
        selectedCreature = creature;
        selectedFaction = resolveFaction(creature);
        break;
      }

      // Try again if variety check failed
    }

    if (!selectedCreature || !selectedFaction) {
      return err(createError('GENERATION_FAILED', 'Failed to generate encounter'));
    }

    // Step 5: Encounter population
    const currentTime = getCurrentTime();
    const encounter = populateEncounter(
      selectedCreature,
      encounterType,
      context,
      currentTime
    );

    // Track creature type for variety
    store.trackCreatureType(selectedCreature.id);

    // Add NPC if social encounter
    if (encounterType === 'social' || encounterType === 'combat') {
      const culture = resolveFactionCulture(selectedFaction, factionMap);
      const npcResult = selectOrGenerateNpc(
        selectedCreature,
        selectedFaction,
        culture,
        existingNpcs,
        currentTime
      );

      encounter.leadNpc = createEncounterLeadNpc(npcResult.npc, !npcResult.isNew);
    }

    // Set map context
    const mapOption = mapFeature.getCurrentMap();
    if (isSome(mapOption)) {
      encounter.mapId = mapOption.value.id;
    }

    // Store the encounter
    store.setCurrentEncounter(encounter);

    // Publish events
    publishEncounterGenerated(encounter, correlationId);
    publishStateChanged(correlationId);

    return ok(encounter);
  }

  // --------------------------------------------------------------------------
  // State Machine Operations
  // --------------------------------------------------------------------------

  /**
   * Start a pending encounter (transition to active).
   */
  function startEncounterInternal(
    encounterId: string,
    correlationId?: string
  ): Result<void, AppError> {
    const state = store.getState();
    const encounter = state.currentEncounter;

    if (!encounter || encounter.id !== encounterId) {
      return err(
        createError('ENCOUNTER_NOT_FOUND', `Encounter ${encounterId} not found`)
      );
    }

    if (encounter.state !== 'pending') {
      return err(
        createError(
          'INVALID_STATE',
          `Cannot start encounter in state "${encounter.state}"`
        )
      );
    }

    // Transition to active
    const updatedEncounter: EncounterInstance = {
      ...encounter,
      state: 'active',
    };

    store.setCurrentEncounter(updatedEncounter);

    // Publish events
    publishEncounterStarted(updatedEncounter, correlationId);
    publishStateChanged(correlationId);

    // Start combat if this is a combat encounter
    if (updatedEncounter.type === 'combat') {
      publishCombatStartRequested(updatedEncounter, correlationId);
    }

    return ok(undefined);
  }

  /**
   * Dismiss a pending encounter without resolution.
   */
  function dismissEncounterInternal(
    encounterId: string,
    reason?: string,
    correlationId?: string
  ): Result<void, AppError> {
    const state = store.getState();
    const encounter = state.currentEncounter;

    if (!encounter || encounter.id !== encounterId) {
      return err(
        createError('ENCOUNTER_NOT_FOUND', `Encounter ${encounterId} not found`)
      );
    }

    if (encounter.state === 'resolved') {
      return err(createError('ALREADY_RESOLVED', 'Encounter already resolved'));
    }

    // Update with dismissed outcome
    const resolvedEncounter: EncounterInstance = {
      ...encounter,
      state: 'resolved',
      outcome: 'dismissed',
      resolvedAt: getCurrentTime(),
    };

    // Add to history and clear current
    store.addToHistory(resolvedEncounter);

    // Publish events
    publishEncounterDismissed(encounterId, reason, correlationId);
    publishStateChanged(correlationId);

    return ok(undefined);
  }

  /**
   * Resolve an active encounter with outcome.
   */
  function resolveEncounterInternal(
    encounterId: string,
    outcome: EncounterOutcome,
    correlationId?: string
  ): Result<void, AppError> {
    const state = store.getState();
    const encounter = state.currentEncounter;

    if (!encounter || encounter.id !== encounterId) {
      return err(
        createError('ENCOUNTER_NOT_FOUND', `Encounter ${encounterId} not found`)
      );
    }

    if (encounter.state === 'resolved') {
      return err(createError('ALREADY_RESOLVED', 'Encounter already resolved'));
    }

    // Calculate XP based on outcome
    let xpAwarded = 0;
    if (outcome === 'victory' || outcome === 'negotiated') {
      // Get creature definitions for XP calculation
      const creatureDefs = encounter.creatures
        .map((ci) => creatures.find((c) => c.id === ci.definitionId))
        .filter((c): c is CreatureDefinition => c !== undefined);

      xpAwarded = calculateEncounterXP(creatureDefs);
    }

    // Update encounter
    const resolvedEncounter: EncounterInstance = {
      ...encounter,
      state: 'resolved',
      outcome,
      resolvedAt: getCurrentTime(),
      xpAwarded,
    };

    // Add to history
    store.addToHistory(resolvedEncounter);

    // Publish events
    publishEncounterResolved(encounterId, outcome, xpAwarded, correlationId);
    publishStateChanged(correlationId);

    return ok(undefined);
  }

  // --------------------------------------------------------------------------
  // Event Handlers
  // --------------------------------------------------------------------------

  function setupEventHandlers(): void {
    // Handle generation requests
    subscriptions.push(
      eventBus.subscribe<EncounterGenerateRequestedPayload>(
        EventTypes.ENCOUNTER_GENERATE_REQUESTED,
        (event) => {
          // Service builds context from minimal payload (as per Encounter-System.md)
          const { position, trigger } = event.payload;

          // Get tile at position for terrain
          const tileOption = mapFeature.getTile(position);
          if (isNone(tileOption)) {
            // No tile at position - silently fail (map not loaded or invalid coord)
            return;
          }
          const tile = tileOption.value;

          // Build context from feature queries
          const context: GenerationContext = {
            position,
            terrainId: tile.terrain,
            timeSegment: timeFeature.getTimeSegment(),
            weather: undefined, // TODO: Weather integration (see Backlog)
            partyLevel: getPartyLevel(),
            trigger,
          };

          executeGenerationPipeline(context, event.correlationId);
        }
      )
    );

    // Handle start requests
    subscriptions.push(
      eventBus.subscribe<EncounterStartRequestedPayload>(
        EventTypes.ENCOUNTER_START_REQUESTED,
        (event) => {
          startEncounterInternal(event.payload.encounterId, event.correlationId);
        }
      )
    );

    // Handle dismiss requests
    subscriptions.push(
      eventBus.subscribe<EncounterDismissRequestedPayload>(
        EventTypes.ENCOUNTER_DISMISS_REQUESTED,
        (event) => {
          dismissEncounterInternal(
            event.payload.encounterId,
            event.payload.reason,
            event.correlationId
          );
        }
      )
    );

    // Handle resolve requests
    subscriptions.push(
      eventBus.subscribe<EncounterResolveRequestedPayload>(
        EventTypes.ENCOUNTER_RESOLVE_REQUESTED,
        (event) => {
          resolveEncounterInternal(
            event.payload.encounterId,
            event.payload.outcome,
            event.correlationId
          );
        }
      )
    );

    // Handle combat completed - auto-resolve the associated encounter
    subscriptions.push(
      eventBus.subscribe<CombatCompletedPayload>(
        EventTypes.COMBAT_COMPLETED,
        (event) => {
          const state = store.getState();
          const encounter = state.currentEncounter;

          // Only resolve if current encounter is the combat's source encounter
          if (
            encounter &&
            encounter.state === 'active' &&
            encounter.type === 'combat'
          ) {
            const encounterOutcome = mapCombatOutcomeToEncounter(event.payload.outcome);
            resolveEncounterInternal(encounter.id, encounterOutcome, event.correlationId);
          }
        }
      )
    );

    // Clear encounter on map change
    subscriptions.push(
      eventBus.subscribe<MapLoadedPayload>(EventTypes.MAP_LOADED, (event) => {
        store.setActiveMap(event.payload.mapId);
        publishStateChanged(event.correlationId);
      })
    );

    // Handle travel position changes (encounter checks during travel)
    subscriptions.push(
      eventBus.subscribe<TravelPositionChangedPayload>(
        EventTypes.TRAVEL_POSITION_CHANGED,
        (event) => {
          const { position, timeCostHours, terrainId } = event.payload;

          // Skip if encounter already pending/active
          const currentState = store.getState();
          if (currentState.currentEncounter) {
            return;
          }

          // Calculate encounter chance based on travel time
          // MVP: Use default population (50) since faction presence not yet implemented
          const population = DEFAULT_POPULATION;
          const chance = calculateEncounterChance(timeCostHours, population);

          // Roll for encounter
          if (!rollEncounter(chance)) {
            return;
          }

          // Build generation context from travel position
          const context: GenerationContext = {
            position,
            terrainId,
            timeSegment: timeFeature.getTimeSegment(),
            weather: undefined, // Full weather not needed for generation
            partyLevel: getPartyLevel(),
            trigger: 'travel',
          };

          // Generate the encounter
          executeGenerationPipeline(context, event.correlationId);
        }
      )
    );
  }

  // Initialize event handlers
  setupEventHandlers();

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  return {
    getCurrentEncounter(): Option<EncounterInstance> {
      const state = store.getState();
      return state.currentEncounter ? some(state.currentEncounter) : none();
    },

    getEncounterHistory(): readonly EncounterInstance[] {
      return store.getState().history;
    },

    getRecentCreatureTypes(): readonly string[] {
      return store.getState().recentCreatureTypes;
    },

    generateEncounter(context: GenerationContext): Result<EncounterInstance, AppError> {
      return executeGenerationPipeline(context);
    },

    startEncounter(encounterId: string): Result<void, AppError> {
      return startEncounterInternal(encounterId);
    },

    dismissEncounter(encounterId: string, reason?: string): Result<void, AppError> {
      return dismissEncounterInternal(encounterId, reason);
    },

    resolveEncounter(
      encounterId: string,
      outcome: EncounterOutcome
    ): Result<void, AppError> {
      return resolveEncounterInternal(encounterId, outcome);
    },

    dispose(): void {
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
      subscriptions.length = 0;
      store.clear();
    },
  };
}
