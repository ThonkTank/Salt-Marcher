/**
 * Encounter Orchestrator
 *
 * Coordinates Entity and Geography features for combat encounter generation.
 * Listens to travel events and triggers hourly encounter checks.
 */

import type { HexCoordinate } from '@core/schemas/coordinates';
import type { EventBus } from '@core/events/event-bus';
import { createEvent } from '@core/events/event-bus';
import type { EntityFeaturePort } from '@/features/entity';
import type { GeographyFeaturePort } from '@/features/geography';
import type { PartyConfig } from '@core/schemas/party';
import { DEFAULT_PARTY_CONFIG } from '@core/schemas/party';
import { ok, err, type Result, type AppError } from '@core/types/result';

import type { EncounterFeaturePort } from './types';
import type {
  EncounterState,
  EncounterStateListener,
  EncounterConfig,
  GeneratedEncounter,
  EncounterCheckTriggeredPayload,
  EncounterGeneratedPayload,
  EncounterSkippedPayload,
  EncounterResolvedPayload,
} from './types';
import { DEFAULT_ENCOUNTER_CONFIG } from './types';
import {
  generateEncounter,
  rollEncounterCheck,
} from './encounter-utils';

// ═══════════════════════════════════════════════════════════════
// EncounterOrchestrator Implementation
// ═══════════════════════════════════════════════════════════════

export class EncounterOrchestrator implements EncounterFeaturePort {
  private state: EncounterState;
  private listeners: Set<EncounterStateListener> = new Set();
  private config: EncounterConfig;
  private partyConfig: PartyConfig;

  // Current position (tracked from travel events)
  private currentPosition: HexCoordinate = { q: 0, r: 0 };

  // Event unsubscribers
  private unsubscribers: Array<() => void> = [];

  // Dependencies
  private readonly entityFeature: EntityFeaturePort;
  private readonly geographyFeature: GeographyFeaturePort;
  private readonly eventBus: EventBus;

  constructor(
    entityFeature: EntityFeaturePort,
    geographyFeature: GeographyFeaturePort,
    eventBus: EventBus,
    config?: Partial<EncounterConfig>,
    partyConfig?: PartyConfig
  ) {
    this.entityFeature = entityFeature;
    this.geographyFeature = geographyFeature;
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_ENCOUNTER_CONFIG, ...config };
    this.partyConfig = partyConfig ?? DEFAULT_PARTY_CONFIG;

    this.state = {
      status: 'idle',
      activeEncounter: null,
      travelHoursElapsed: 0,
      lastCheckHour: 0,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Event Subscriptions
  // ─────────────────────────────────────────────────────────────

  private setupEventSubscriptions(): void {
    // Track travel state for position updates
    const unsub1 = this.eventBus.subscribe('travel:state-changed', (event) => {
      this.currentPosition = event.payload.state.partyPosition;
    });
    this.unsubscribers.push(unsub1);

    // Subscribe to time changes during travel
    const unsub2 = this.eventBus.subscribe('time:changed', (event) => {
      if (event.payload.reason === 'travel' && this.config.autoTrigger) {
        this.onTravelTimeAdvanced();
      }
    });
    this.unsubscribers.push(unsub2);

    // Reset state when travel starts
    const unsub3 = this.eventBus.subscribe('travel:started', () => {
      this.setState({
        travelHoursElapsed: 0,
        lastCheckHour: 0,
      });
    });
    this.unsubscribers.push(unsub3);

    // Track position changes during travel
    const unsub4 = this.eventBus.subscribe('position:changed', (event) => {
      this.currentPosition = event.payload.current;
    });
    this.unsubscribers.push(unsub4);

    // Handle encounter resolution commands
    const unsub5 = this.eventBus.subscribe('encounter:resolve-requested', (event) => {
      const result = this.resolveEncounter(event.payload.outcome);
      if (!result.ok) {
        this.eventBus.publish(
          createEvent('encounter:resolve-failed', { error: result.error }, 'encounter', event.correlationId)
        );
      }
    });
    this.unsubscribers.push(unsub5);

    const unsub6 = this.eventBus.subscribe('encounter:dismiss-requested', () => {
      this.dismissEncounter();
    });
    this.unsubscribers.push(unsub6);
  }

  /**
   * Called when time advances during travel (every hour)
   */
  private onTravelTimeAdvanced(): void {
    // Increment hours elapsed using setState for proper notification
    const newHours = this.state.travelHoursElapsed + 1;

    // Check for encounter every hour
    if (newHours > this.state.lastCheckHour) {
      // Update both values before encounter check
      this.setState({
        travelHoursElapsed: newHours,
        lastCheckHour: newHours,
      });
      this.performEncounterCheck();
    } else {
      this.setState({ travelHoursElapsed: newHours });
    }
  }

  /**
   * Perform an encounter check at current position
   */
  private performEncounterCheck(): void {
    // Don't check if already in an encounter
    if (this.state.activeEncounter) return;

    const terrain = this.geographyFeature.getTerrainAt(this.currentPosition);
    const terrainId = terrain?.id ?? 'grassland';

    // Emit check triggered event
    this.eventBus.publish(
      createEvent<'encounter:check-triggered', EncounterCheckTriggeredPayload>(
        'encounter:check-triggered',
        {
          hour: this.state.travelHoursElapsed,
          terrain: terrainId,
          position: this.currentPosition,
        },
        'encounter'
      )
    );

    // Roll for encounter
    if (!rollEncounterCheck(this.config.encounterProbability)) {
      this.eventBus.publish(
        createEvent<'encounter:skipped', EncounterSkippedPayload>(
          'encounter:skipped',
          {
            hour: this.state.travelHoursElapsed,
            terrain: terrainId,
            reason: 'roll_failed',
          },
          'encounter'
        )
      );
      return;
    }

    // Generate encounter
    const encounter = this.generateEncounterForTerrain(terrainId);

    if (!encounter) {
      this.eventBus.publish(
        createEvent<'encounter:skipped', EncounterSkippedPayload>(
          'encounter:skipped',
          {
            hour: this.state.travelHoursElapsed,
            terrain: terrainId,
            reason: 'no_creatures',
          },
          'encounter'
        )
      );
      return;
    }

    // Set active encounter
    this.setState({
      status: 'active',
      activeEncounter: encounter,
    });

    // Emit generated event (TravelOrchestrator will pause reactively)
    this.eventBus.publish(
      createEvent<'encounter:generated', EncounterGeneratedPayload>(
        'encounter:generated',
        {
          encounter,
          hour: this.state.travelHoursElapsed,
          position: this.currentPosition,
        },
        'encounter'
      )
    );
  }

  /**
   * Generate an encounter for a specific terrain
   */
  private generateEncounterForTerrain(terrain: string): GeneratedEncounter | null {
    const creatures = this.entityFeature.listCreatures();

    return generateEncounter({
      creatures,
      party: this.partyConfig.members,
      terrain,
      targetDifficulty: this.config.targetDifficulty,
      crRangeMin: this.config.crRangeMin,
      crRangeMax: this.config.crRangeMax,
      maxCreatureCount: this.config.maxCreatureCount,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // State Access
  // ─────────────────────────────────────────────────────────────

  getState(): Readonly<EncounterState> {
    return this.state;
  }

  subscribe(listener: EncounterStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    // Notify local listeners
    for (const listener of this.listeners) {
      listener(this.state);
    }

    // Publish state via EventBus (includes full state for ViewModel consumption)
    this.eventBus.publish(
      createEvent(
        'encounter:state-changed',
        {
          status: this.state.status,
          hasActiveEncounter: this.state.activeEncounter !== null,
          state: this.state,
        },
        'encounter'
      )
    );
  }

  private setState(updates: Partial<EncounterState>): void {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  // ─────────────────────────────────────────────────────────────
  // Manual Controls
  // ─────────────────────────────────────────────────────────────

  triggerCheck(): Result<void, AppError> {
    if (this.state.activeEncounter) {
      return err({ code: 'ENCOUNTER_ACTIVE', message: 'Cannot trigger check: an encounter is already active' });
    }
    this.performEncounterCheck();
    return ok(undefined);
  }

  generateEncounter(terrain: string): Result<GeneratedEncounter, AppError> {
    const encounter = this.generateEncounterForTerrain(terrain);
    if (!encounter) {
      return err({
        code: 'NO_CREATURES_AVAILABLE',
        message: `No valid creatures available for terrain '${terrain}'`,
        details: { terrain },
      });
    }
    return ok(encounter);
  }

  resolveEncounter(outcome: 'victory' | 'flee' | 'negotiated'): Result<void, AppError> {
    if (!this.state.activeEncounter) {
      return err({ code: 'NO_ACTIVE_ENCOUNTER', message: 'Cannot resolve: no active encounter' });
    }

    const encounterId = this.state.activeEncounter.id;

    this.setState({
      status: 'idle',
      activeEncounter: null,
    });

    // Emit resolved event
    this.eventBus.publish(
      createEvent<'encounter:resolved', EncounterResolvedPayload>(
        'encounter:resolved',
        { encounterId, outcome },
        'encounter'
      )
    );

    // Request travel resume
    this.eventBus.publish(
      createEvent('travel:resume-requested', {}, 'encounter')
    );

    return ok(undefined);
  }

  dismissEncounter(): void {
    this.setState({
      status: 'idle',
      activeEncounter: null,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────

  updateConfig(config: Partial<EncounterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  updateParty(party: PartyConfig): void {
    this.partyConfig = party;
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    this.setupEventSubscriptions();
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.listeners.clear();
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

/**
 * Create a new EncounterOrchestrator instance
 */
export function createEncounterOrchestrator(
  entityFeature: EntityFeaturePort,
  geographyFeature: GeographyFeaturePort,
  eventBus: EventBus,
  config?: Partial<EncounterConfig>,
  partyConfig?: PartyConfig
): EncounterFeaturePort {
  return new EncounterOrchestrator(
    entityFeature,
    geographyFeature,
    eventBus,
    config,
    partyConfig
  );
}
