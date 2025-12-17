/**
 * SessionRunner ViewModel.
 *
 * Coordinates between UI (View/Panels) and Features.
 * Manages render state and handles user interactions.
 */

import type { MapId, PartyId, EventBus, Unsubscribe } from '@core/index';
import { isOk, isSome, EventTypes } from '@core/index';
import type { HexCoordinate } from '@core/schemas';
import type {
  MapLoadedPayload,
  MapUnloadedPayload,
  PartyPositionChangedPayload,
  PartyLoadedPayload,
  TimeStateChangedPayload,
  TravelPositionChangedPayload,
} from '@core/events/domain-events';
import type { MapFeaturePort } from '@/features/map';
import type { PartyFeaturePort } from '@/features/party';
import type { TravelFeaturePort } from '@/features/travel';
import type { TimeFeaturePort } from '@/features/time';
import type { WeatherFeaturePort } from '@/features/weather';
import type { EncounterFeaturePort } from '@/features/encounter';
import type { NotificationService } from '@/application/shared';
import type {
  RenderState,
  RenderHint,
  RenderCallback,
  TravelInfo,
} from './types';
import { createInitialRenderState } from './types';

// ============================================================================
// ViewModel Dependencies
// ============================================================================

export interface SessionRunnerViewModelDeps {
  mapFeature: MapFeaturePort;
  partyFeature: PartyFeaturePort;
  travelFeature: TravelFeaturePort;
  timeFeature: TimeFeaturePort;
  notificationService: NotificationService;
  eventBus?: EventBus; // Optional during migration
  weatherFeature?: WeatherFeaturePort; // Optional for debug
  encounterFeature?: EncounterFeaturePort; // Optional for debug
}

// ============================================================================
// ViewModel
// ============================================================================

export interface SessionRunnerViewModel {
  // State
  getState(): Readonly<RenderState>;
  getLastTravel(): TravelInfo | null;

  // Subscriptions
  subscribe(callback: RenderCallback): () => void;

  // Initialization
  initialize(mapId: MapId, partyId: PartyId): Promise<void>;

  // Map Interactions
  onTileClick(coord: HexCoordinate): void;
  onTileHover(coord: HexCoordinate | null): void;
  onPan(deltaX: number, deltaY: number): void;
  onZoom(delta: number): void;

  // Header Interactions
  onTimeAdvance(hours: number): void;
  onToggleSidebar(): void;

  // Cleanup
  dispose(): void;
}

/**
 * Create the SessionRunner ViewModel.
 */
export function createSessionRunnerViewModel(
  deps: SessionRunnerViewModelDeps
): SessionRunnerViewModel {
  const {
    mapFeature,
    partyFeature,
    travelFeature,
    timeFeature,
    notificationService,
    eventBus,
    weatherFeature,
    encounterFeature,
  } = deps;

  // Internal state
  let state: RenderState = createInitialRenderState();
  let lastTravel: TravelInfo | null = null;
  const subscribers: Set<RenderCallback> = new Set();

  // Track EventBus subscriptions for cleanup
  const eventSubscriptions: Unsubscribe[] = [];

  // =========================================================================
  // Helpers
  // =========================================================================

  function notify(hints: RenderHint[]): void {
    for (const callback of subscribers) {
      callback(state, hints);
    }
  }

  function updateState(partial: Partial<RenderState>, hints: RenderHint[]): void {
    state = { ...state, ...partial };
    notify(hints);
  }

  function syncFromFeatures(): void {
    const map = mapFeature.getCurrentMap();
    const position = partyFeature.getPosition();
    const transport = partyFeature.getActiveTransport();
    const currentTime = timeFeature.isLoaded() ? timeFeature.getCurrentTime() : null;
    const timeSegment = timeFeature.isLoaded() ? timeFeature.getTimeSegment() : null;

    // Weather (optional)
    const weather = weatherFeature?.getCurrentWeather();
    const currentWeather = weather && isSome(weather) ? weather.value : null;

    // Encounter (optional)
    const encounter = encounterFeature?.getCurrentEncounter();
    const currentEncounter = encounter && isSome(encounter) ? encounter.value : null;

    // Get terrain name at party position
    const partyPos = isSome(position) ? position.value : null;
    let currentTerrain: string | null = null;
    if (partyPos) {
      const terrain = mapFeature.getTerrainAt(partyPos);
      currentTerrain = isSome(terrain) ? terrain.value.name : null;
    }

    // Build weather summary for header
    let weatherSummary = null;
    if (currentWeather) {
      const { categories, params } = currentWeather;
      weatherSummary = {
        icon: getWeatherIcon(categories.precipitation),
        label: capitalizeFirst(categories.precipitation),
        temperature: Math.round(params.temperature),
      };
    }

    state = {
      ...state,
      map: isSome(map) ? map.value : null,
      partyPosition: partyPos,
      activeTransport: transport,
      currentTime,
      timeSegment,
      currentWeather,
      currentEncounter,
      // Header state
      header: {
        currentTime,
        timeSegment,
        weatherSummary,
      },
      // Sidebar state
      sidebar: {
        travel: {
          status: 'idle', // TODO: Get from travel feature when implemented
          speed: getBaseSpeed(transport),
          currentTerrain,
        },
        actions: {
          canGenerateEncounter: !!partyPos,
          canTeleport: isSome(map),
        },
      },
    };
  }

  // Helper: Get weather icon
  function getWeatherIcon(precipitation: string): string {
    const lower = precipitation.toLowerCase();
    if (lower === 'none' || lower === 'clear') return 'sunny';
    if (lower.includes('rain')) return 'rainy';
    if (lower.includes('snow')) return 'snowy';
    if (lower.includes('storm')) return 'stormy';
    return 'cloudy';
  }

  // Helper: Capitalize first letter
  function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Helper: Get base travel speed by transport
  function getBaseSpeed(transport: string): number {
    switch (transport) {
      case 'horse': return 48;
      case 'boat': return 36;
      case 'foot':
      default: return 24;
    }
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  function setupEventHandlers(): void {
    if (!eventBus) return;

    // Map loaded/unloaded - sync map state
    eventSubscriptions.push(
      eventBus.subscribe<MapLoadedPayload>(
        EventTypes.MAP_LOADED,
        () => {
          syncFromFeatures();
          notify(['full']);
        }
      )
    );

    eventSubscriptions.push(
      eventBus.subscribe<MapUnloadedPayload>(
        EventTypes.MAP_UNLOADED,
        () => {
          syncFromFeatures();
          notify(['full']);
        }
      )
    );

    // Party position changed - update map display
    eventSubscriptions.push(
      eventBus.subscribe<PartyPositionChangedPayload>(
        EventTypes.PARTY_POSITION_CHANGED,
        (event) => {
          const { newPosition } = event.payload;
          updateState({ partyPosition: newPosition }, ['party']);
        }
      )
    );

    // Party loaded - sync party state
    eventSubscriptions.push(
      eventBus.subscribe<PartyLoadedPayload>(
        EventTypes.PARTY_LOADED,
        () => {
          syncFromFeatures();
          notify(['full']);
        }
      )
    );

    // Time state changed - update time display
    eventSubscriptions.push(
      eventBus.subscribe<TimeStateChangedPayload>(
        EventTypes.TIME_STATE_CHANGED,
        (event) => {
          const { currentTime } = event.payload;
          const timeSegment = timeFeature.getTimeSegment();
          updateState({ currentTime, timeSegment }, ['full']);
        }
      )
    );

    // Travel position changed - update travel info and position
    eventSubscriptions.push(
      eventBus.subscribe<TravelPositionChangedPayload>(
        EventTypes.TRAVEL_POSITION_CHANGED,
        (event) => {
          const { from, position, terrainId, timeCostHours } = event.payload;

          // Get terrain name for display
          const terrain = mapFeature.getTerrainAt(position);
          const terrainName = isSome(terrain) ? terrain.value.name : terrainId;

          lastTravel = {
            from,
            to: position,
            timeCostHours: timeCostHours ?? 0,
            terrainName,
          };

          // Sync all features since travel affects time too
          syncFromFeatures();
          notify(['party']);
        }
      )
    );

    // Weather changed - update weather display
    eventSubscriptions.push(
      eventBus.subscribe(
        EventTypes.ENVIRONMENT_WEATHER_CHANGED,
        () => {
          syncFromFeatures();
          notify(['full']);
        }
      )
    );

    // Encounter generated - update encounter display
    eventSubscriptions.push(
      eventBus.subscribe(
        EventTypes.ENCOUNTER_GENERATED,
        () => {
          syncFromFeatures();
          notify(['full']);
        }
      )
    );

    // Encounter state changed - update encounter display
    eventSubscriptions.push(
      eventBus.subscribe(
        EventTypes.ENCOUNTER_STATE_CHANGED,
        () => {
          syncFromFeatures();
          notify(['full']);
        }
      )
    );

  }

  // Set up event handlers immediately if eventBus is provided
  setupEventHandlers();

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    getState(): Readonly<RenderState> {
      return state;
    },

    getLastTravel(): TravelInfo | null {
      return lastTravel;
    },

    subscribe(callback: RenderCallback): () => void {
      subscribers.add(callback);
      // Immediately call with current state
      callback(state, ['full']);
      return () => subscribers.delete(callback);
    },

    async initialize(mapId: MapId, partyId: PartyId): Promise<void> {
      // Load map
      const mapResult = await mapFeature.loadMap(mapId);
      if (!isOk(mapResult)) {
        notificationService.errorFromResult(mapResult.error);
        return;
      }

      // Load party
      const partyResult = await partyFeature.loadParty(partyId);
      if (!isOk(partyResult)) {
        notificationService.errorFromResult(partyResult.error);
        return;
      }

      // Sync state from features
      syncFromFeatures();

      // Center camera on party position
      if (state.partyPosition) {
        // Camera centering will be handled by the view
      }

      notify(['full']);
    },

    onTileClick(coord: HexCoordinate): void {
      // Check if we can move there
      if (!travelFeature.canMoveTo(coord)) {
        // Just select the tile for info
        updateState({ selectedTile: coord }, ['selection']);
        return;
      }

      // Try to move
      const result = travelFeature.moveToNeighbor(coord);

      if (isOk(result)) {
        const travel = result.value;

        // Get terrain name for display
        const terrain = mapFeature.getTerrainAt(coord);
        const terrainName = isSome(terrain) ? terrain.value.name : 'Unknown';

        lastTravel = {
          from: travel.from,
          to: travel.to,
          timeCostHours: travel.timeCostHours,
          terrainName,
        };

        // Update state
        syncFromFeatures();
        notify(['party', 'selection']);

        // Persist party position and time state
        partyFeature.saveParty().then(saveResult => {
          if (!saveResult.ok) {
            notificationService.errorFromResult(saveResult.error);
          }
        });
        timeFeature.saveTime().then(saveResult => {
          if (!saveResult.ok) {
            console.warn('Failed to save time:', saveResult.error);
          }
        });
      } else {
        notificationService.errorFromResult(result.error);
      }
    },

    onTileHover(coord: HexCoordinate | null): void {
      if (
        coord?.q === state.hoveredTile?.q &&
        coord?.r === state.hoveredTile?.r
      ) {
        return; // No change
      }

      updateState({ hoveredTile: coord }, ['hover']);
    },

    onPan(deltaX: number, deltaY: number): void {
      updateState(
        {
          cameraOffset: {
            x: state.cameraOffset.x + deltaX,
            y: state.cameraOffset.y + deltaY,
          },
        },
        ['camera']
      );
    },

    onZoom(delta: number): void {
      const newZoom = Math.max(0.25, Math.min(4, state.zoom + delta));
      updateState({ zoom: newZoom }, ['camera']);
    },

    onTimeAdvance(hours: number): void {
      // Advance time by the specified hours
      timeFeature.advanceTime({ hours: Math.abs(hours), minutes: 0 });

      // Sync and notify
      syncFromFeatures();
      notify(['full', 'header']);

      // Persist time
      timeFeature.saveTime().then(saveResult => {
        if (!saveResult.ok) {
          console.warn('Failed to save time:', saveResult.error);
        }
      });
    },

    onToggleSidebar(): void {
      updateState(
        { sidebarCollapsed: !state.sidebarCollapsed },
        ['sidebar']
      );
    },

    dispose(): void {
      // Clean up EventBus subscriptions
      for (const unsubscribe of eventSubscriptions) {
        unsubscribe();
      }
      eventSubscriptions.length = 0;

      // Clean up render subscribers
      subscribers.clear();

      // Unload features
      mapFeature.unloadMap();
      partyFeature.unloadParty();
    },
  };
}
