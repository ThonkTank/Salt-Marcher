/**
 * Base Panel Interface
 *
 * Abstract interface for modular sidebar panels in SessionRunner.
 * Each panel is self-contained and can be added/removed dynamically.
 *
 * Extension Point for Weather, Encounter, Music panels etc.
 */

import type { EntityId } from '@core/types/common';
import type { HexCoordinate } from '@core/schemas/coordinates';
import type { TravelState } from '@/features/travel';
import type { EncounterState, GeneratedEncounter } from '@/features/encounter';
import type {
  DateTime,
  CalendarConfig,
  TimeOfDay,
  SeasonConfig,
} from '@core/schemas/time';
import { GREGORIAN_CALENDAR, createDateTime } from '@core/schemas/time';
import type { MoonPhaseInfo } from '@/features/time';
import { toEntityId } from '@core/types/common';

// ═══════════════════════════════════════════════════════════════
// Panel Context
// ═══════════════════════════════════════════════════════════════

/**
 * Shared context passed to all panels on update.
 * Contains all state that panels need to render.
 * Panels should NOT modify this context - it's read-only.
 */
export interface PanelContext {
  // ─────────────────────────────────────────────────────────────
  // Map State
  // ─────────────────────────────────────────────────────────────

  /** Currently loaded map ID */
  mapId: EntityId<'map'> | null;

  /** Map name for display */
  mapName: string;

  // ─────────────────────────────────────────────────────────────
  // Travel State
  // ─────────────────────────────────────────────────────────────

  /** Current party position on map */
  partyPosition: HexCoordinate;

  /** Complete travel state from orchestrator */
  travelState: TravelState;

  // ─────────────────────────────────────────────────────────────
  // Time State
  // ─────────────────────────────────────────────────────────────

  /** Current game date/time */
  currentDateTime: DateTime;

  /** Calendar configuration */
  calendar: CalendarConfig;

  /** Current time of day (dawn, day, dusk, night) */
  timeOfDay: TimeOfDay;

  /** Current season (undefined if calendar has no seasons) */
  season: SeasonConfig | undefined;

  /** Current moon phases */
  moonPhases: MoonPhaseInfo[];

  // ─────────────────────────────────────────────────────────────
  // Encounter State
  // ─────────────────────────────────────────────────────────────

  /** Current encounter state from orchestrator */
  encounterState: EncounterState;

  /** Active encounter (convenience - same as encounterState.activeEncounter) */
  activeEncounter: GeneratedEncounter | null;
}

// ═══════════════════════════════════════════════════════════════
// Sidebar Panel Interface
// ═══════════════════════════════════════════════════════════════

/**
 * SidebarPanel - Abstract interface for modular sidebar panels.
 *
 * Each panel is responsible for:
 * - Rendering its own UI into a container
 * - Managing its own state and subscriptions
 * - Cleaning up resources on dispose
 */
export interface SidebarPanel {
  /** Unique panel identifier */
  readonly id: string;

  /** Display name (shown in collapse header) */
  readonly displayName: string;

  /** Icon name (Obsidian/Lucide icon) */
  readonly icon: string;

  /** Priority for ordering (lower = higher in list) */
  readonly priority: number;

  /** Whether panel is collapsible (default: true) */
  readonly collapsible?: boolean;

  /** Default collapsed state */
  readonly defaultCollapsed?: boolean;

  /**
   * Render panel content into container
   * Called once when panel is first mounted
   */
  render(container: HTMLElement): void;

  /**
   * Update panel with new context
   * Called whenever global context changes (map loaded, position changed, etc.)
   */
  update(context: PanelContext): void;

  /**
   * Cleanup subscriptions and resources
   * Called when panel is unmounted
   */
  dispose(): void;
}

// ═══════════════════════════════════════════════════════════════
// Panel Registry
// ═══════════════════════════════════════════════════════════════

/**
 * Registry for managing sidebar panels
 */
export interface PanelRegistry {
  /** Register a new panel */
  register(panel: SidebarPanel): void;

  /** Unregister panel by ID */
  unregister(panelId: string): void;

  /** Get all registered panels (sorted by priority) */
  getAll(): SidebarPanel[];

  /** Get panel by ID */
  getById(id: string): SidebarPanel | undefined;

  /** Check if panel is registered */
  has(panelId: string): boolean;
}

// ═══════════════════════════════════════════════════════════════
// Panel State (for persistence)
// ═══════════════════════════════════════════════════════════════

/**
 * Persisted panel state
 */
export interface PanelState {
  /** Panel ID */
  id: string;

  /** Whether panel is collapsed */
  collapsed: boolean;

  /** Panel-specific state (optional) */
  customState?: Record<string, unknown>;
}

/**
 * All panels state (for saving/restoring)
 */
export interface PanelsState {
  panels: PanelState[];
}

// ═══════════════════════════════════════════════════════════════
// Helper Types
// ═══════════════════════════════════════════════════════════════

/**
 * Panel configuration for creating panels
 */
export interface PanelConfig {
  id: string;
  displayName: string;
  icon: string;
  priority: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

/**
 * Create default panel context with placeholder values.
 * This is used when the View hasn't yet received real state from the ViewModel.
 */
export function createDefaultContext(): PanelContext {
  const defaultDateTime = createDateTime(
    1,
    1,
    1,
    8,
    0,
    toEntityId<'calendar'>('gregorian')
  );

  const defaultTravelState: TravelState = {
    status: 'idle',
    route: null,
    progress: null,
    partyPosition: { q: 0, r: 0 },
  };

  const defaultEncounterState: EncounterState = {
    status: 'idle',
    activeEncounter: null,
    travelHoursElapsed: 0,
    lastCheckHour: 0,
  };

  return {
    mapId: null,
    mapName: '',
    partyPosition: { q: 0, r: 0 },
    travelState: defaultTravelState,
    currentDateTime: defaultDateTime,
    calendar: GREGORIAN_CALENDAR,
    timeOfDay: 'morning',
    season: undefined,
    moonPhases: [],
    encounterState: defaultEncounterState,
    activeEncounter: null,
  };
}
