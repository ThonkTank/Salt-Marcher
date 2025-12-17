/**
 * SessionRunner types.
 */

import type {
  HexCoordinate,
  OverworldMap,
  TransportMode,
  GameDateTime,
  TimeSegment,
  WeatherState,
  EncounterInstance,
} from '@core/schemas';

// ============================================================================
// View Types
// ============================================================================

/** View type identifier for Obsidian */
export const VIEW_TYPE_SESSION_RUNNER = 'salt-marcher-session-runner';

// ============================================================================
// Header State
// ============================================================================

/**
 * Compact weather summary for header display.
 */
export interface WeatherSummary {
  /** Weather icon identifier */
  icon: string;
  /** Short weather label (e.g. "Clear", "Rainy") */
  label: string;
  /** Temperature in Celsius */
  temperature: number;
}

/**
 * State for header panel.
 */
export interface HeaderState {
  /** Current game time */
  currentTime: GameDateTime | null;
  /** Current time segment */
  timeSegment: TimeSegment | null;
  /** Weather summary for compact display */
  weatherSummary: WeatherSummary | null;
}

// ============================================================================
// Sidebar State
// ============================================================================

/**
 * Travel section state.
 */
export interface TravelSectionState {
  /** Current travel status */
  status: 'idle' | 'planning' | 'traveling' | 'paused';
  /** Travel speed in miles/day */
  speed: number;
  /** Current terrain name at party position */
  currentTerrain: string | null;
}

/**
 * Actions section state.
 */
export interface ActionsSectionState {
  /** Whether encounter generation is available */
  canGenerateEncounter: boolean;
  /** Whether teleport is available */
  canTeleport: boolean;
}

/**
 * State for sidebar panel (Quick Controls).
 */
export interface SidebarState {
  /** Travel section */
  travel: TravelSectionState;
  /** Actions section */
  actions: ActionsSectionState;
}

// ============================================================================
// Render State
// ============================================================================

/**
 * State needed for rendering the SessionRunner.
 */
export interface RenderState {
  // === Map & Party ===
  /** Currently loaded map */
  map: OverworldMap | null;
  /** Party position */
  partyPosition: HexCoordinate | null;
  /** Active transport mode */
  activeTransport: TransportMode;

  // === Time ===
  /** Current game time */
  currentTime: GameDateTime | null;
  /** Current time segment (dawn, morning, etc.) */
  timeSegment: TimeSegment | null;

  // === Map Interaction ===
  /** Hovered tile (for highlighting) */
  hoveredTile: HexCoordinate | null;
  /** Selected tile (for info display) */
  selectedTile: HexCoordinate | null;
  /** Camera offset for panning */
  cameraOffset: { x: number; y: number };
  /** Zoom level */
  zoom: number;

  // === Weather & Encounter (for data access) ===
  /** Current weather state */
  currentWeather: WeatherState | null;
  /** Current encounter */
  currentEncounter: EncounterInstance | null;

  // === UI Layout ===
  /** Header state */
  header: HeaderState;
  /** Sidebar state */
  sidebar: SidebarState;
  /** Whether sidebar is collapsed */
  sidebarCollapsed: boolean;
}

/**
 * Create initial render state.
 */
export function createInitialRenderState(): RenderState {
  return {
    // Map & Party
    map: null,
    partyPosition: null,
    activeTransport: 'foot',

    // Time
    currentTime: null,
    timeSegment: null,

    // Map Interaction
    hoveredTile: null,
    selectedTile: null,
    cameraOffset: { x: 0, y: 0 },
    zoom: 1.0,

    // Weather & Encounter
    currentWeather: null,
    currentEncounter: null,

    // UI Layout
    header: {
      currentTime: null,
      timeSegment: null,
      weatherSummary: null,
    },
    sidebar: {
      travel: {
        status: 'idle',
        speed: 24, // Default: 24 mi/day on foot
        currentTerrain: null,
      },
      actions: {
        canGenerateEncounter: false,
        canTeleport: false,
      },
    },
    sidebarCollapsed: false,
  };
}

// ============================================================================
// Render Hints
// ============================================================================

/**
 * Hints for optimized rendering.
 */
export type RenderHint =
  | 'full' // Full re-render
  | 'tiles' // Only tiles changed
  | 'party' // Party position changed
  | 'hover' // Hover state changed
  | 'camera' // Camera/zoom changed
  | 'selection' // Selection changed
  | 'header' // Header state changed
  | 'sidebar'; // Sidebar state changed

// ============================================================================
// ViewModel Events
// ============================================================================

/** Callback for render updates */
export type RenderCallback = (state: RenderState, hints: RenderHint[]) => void;

// ============================================================================
// Travel Info
// ============================================================================

/**
 * Info about last travel move (for display).
 */
export interface TravelInfo {
  from: HexCoordinate;
  to: HexCoordinate;
  timeCostHours: number;
  terrainName: string;
}
