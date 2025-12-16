/**
 * SessionRunner ViewModel.
 *
 * Coordinates between UI (View/Panels) and Features.
 * Manages render state and handles user interactions.
 */

import type { MapId, PartyId } from '@core/index';
import { isOk, isSome } from '@core/index';
import type { HexCoordinate } from '@core/schemas';
import type { MapFeaturePort } from '@/features/map';
import type { PartyFeaturePort } from '@/features/party';
import type { TravelFeaturePort } from '@/features/travel';
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

  // Interactions
  onTileClick(coord: HexCoordinate): void;
  onTileHover(coord: HexCoordinate | null): void;
  onPan(deltaX: number, deltaY: number): void;
  onZoom(delta: number): void;

  // Cleanup
  dispose(): void;
}

/**
 * Create the SessionRunner ViewModel.
 */
export function createSessionRunnerViewModel(
  deps: SessionRunnerViewModelDeps
): SessionRunnerViewModel {
  const { mapFeature, partyFeature, travelFeature } = deps;

  // Internal state
  let state: RenderState = createInitialRenderState();
  let lastTravel: TravelInfo | null = null;
  const subscribers: Set<RenderCallback> = new Set();

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

    state = {
      ...state,
      map: isSome(map) ? map.value : null,
      partyPosition: isSome(position) ? position.value : null,
      activeTransport: transport,
    };
  }

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
        console.error('Failed to load map:', mapResult.error);
        return;
      }

      // Load party
      const partyResult = await partyFeature.loadParty(partyId);
      if (!isOk(partyResult)) {
        console.error('Failed to load party:', partyResult.error);
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
      } else {
        console.warn('Move failed:', result.error.message);
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

    dispose(): void {
      subscribers.clear();
      mapFeature.unloadMap();
      partyFeature.unloadParty();
    },
  };
}
