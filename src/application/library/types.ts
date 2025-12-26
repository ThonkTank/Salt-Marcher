/**
 * Library types.
 *
 * State types for the Library view - the central CRUD interface for all entities.
 *
 * @see docs/application/Library.md
 */

import type { EntityType } from '@core/types/common';

// ============================================================================
// View Types
// ============================================================================

/** View type identifier for Obsidian */
export const VIEW_TYPE_LIBRARY = 'salt-marcher-library';

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Filter value can be string, number, boolean, or array of strings.
 */
export type FilterValue = string | number | boolean | string[] | null;

/**
 * Filter state for a single filter control.
 */
export interface FilterState {
  key: string;
  value: FilterValue;
  label: string;
}

// ============================================================================
// Sort Types
// ============================================================================

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort configuration.
 */
export interface SortConfig {
  field: string;
  direction: SortDirection;
}

// ============================================================================
// View Mode Types
// ============================================================================

/** Available view modes */
export type ViewMode = 'list' | 'grid' | 'tree';

// ============================================================================
// Modal Types
// ============================================================================

/** Modal mode for create/edit */
export type ModalMode = 'create' | 'edit';

/**
 * Modal state.
 */
export interface ModalState {
  open: boolean;
  mode: ModalMode;
  entityId: string | null;
  currentSection: string;
  isDirty: boolean;
}

// ============================================================================
// Modal Section Types
// ============================================================================

/**
 * Configuration for a modal section (tab).
 *
 * @see Library.md#modal-navigation
 */
export interface ModalSectionConfig {
  /** Unique section identifier (e.g., 'basic', 'stats') */
  id: string;

  /** Display label for the tab */
  label: string;

  /** Optional icon for the tab */
  icon?: string;
}

/**
 * Entity-specific section configurations.
 *
 * Each entity type can have different sections (tabs) in the modal.
 * Falls back to DEFAULT_SECTIONS if not specified.
 */
const ENTITY_SECTIONS: Partial<Record<EntityType, ModalSectionConfig[]>> = {
  creature: [
    { id: 'basic', label: 'Basic Info' },
    { id: 'stats', label: 'Stats' },
    { id: 'abilities', label: 'Abilities' },
    { id: 'actions', label: 'Actions' },
    { id: 'habitat', label: 'Habitat' },
  ],
  character: [
    { id: 'basic', label: 'Basic Info' },
    { id: 'stats', label: 'Stats' },
    { id: 'inventory', label: 'Inventory' },
  ],
  npc: [
    { id: 'basic', label: 'Basic Info' },
    { id: 'personality', label: 'Personality' },
    { id: 'faction', label: 'Faction' },
  ],
  item: [
    { id: 'basic', label: 'Basic Info' },
    { id: 'properties', label: 'Properties' },
  ],
  quest: [
    { id: 'basic', label: 'Basic Info' },
    { id: 'objectives', label: 'Objectives' },
    { id: 'rewards', label: 'Rewards' },
  ],
  encounter: [
    { id: 'basic', label: 'Basic Info' },
    { id: 'creatures', label: 'Creatures' },
    { id: 'triggers', label: 'Triggers' },
  ],
  shop: [
    { id: 'basic', label: 'Basic Info' },
    { id: 'inventory', label: 'Inventory' },
  ],
  faction: [
    { id: 'basic', label: 'Basic Info' },
    { id: 'culture', label: 'Culture' },
    { id: 'territory', label: 'Territory' },
  ],
  map: [
    { id: 'basic', label: 'Basic Info' },
    { id: 'settings', label: 'Settings' },
  ],
  poi: [
    { id: 'basic', label: 'Basic Info' },
    { id: 'content', label: 'Content' },
  ],
  terrain: [
    { id: 'basic', label: 'Basic Info' },
    { id: 'mechanics', label: 'Mechanics' },
    { id: 'climate', label: 'Climate' },
  ],
};

/**
 * Default sections for entity types without specific configuration.
 */
const DEFAULT_SECTIONS: ModalSectionConfig[] = [
  { id: 'basic', label: 'Basic Info' },
];

/**
 * Get the section configuration for an entity type.
 *
 * @param entityType - The entity type to get sections for
 * @returns Array of section configurations
 *
 * @example
 * ```typescript
 * const sections = getEntitySections('creature');
 * // [{ id: 'basic', label: 'Basic Info' }, { id: 'stats', label: 'Stats' }, ...]
 * ```
 */
export function getEntitySections(entityType: EntityType): ModalSectionConfig[] {
  return ENTITY_SECTIONS[entityType] ?? DEFAULT_SECTIONS;
}

// ============================================================================
// Library State
// ============================================================================

/**
 * State for the Library view.
 *
 * Manages navigation, filtering, sorting, selection, and modal state
 * for the entity browser.
 *
 * @see Library.md#state-management
 */
export interface LibraryState {
  // ─────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────

  /** Currently active entity type tab */
  activeTab: EntityType;

  // ─────────────────────────────────────────────────────────────────────────
  // Browse
  // ─────────────────────────────────────────────────────────────────────────

  /** Search query text */
  searchQuery: string;

  /** Active filters (key-value pairs) */
  filters: Record<string, FilterValue>;

  /** Sort configuration */
  sort: SortConfig;

  // ─────────────────────────────────────────────────────────────────────────
  // Data
  // ─────────────────────────────────────────────────────────────────────────

  /** Current page of entities (filtered, sorted, paginated) */
  entities: unknown[];

  /** Total count of entities matching current filters */
  totalCount: number;

  /** Current page number (0-indexed) */
  page: number;

  /** Number of items per page */
  pageSize: number;

  // ─────────────────────────────────────────────────────────────────────────
  // Selection
  // ─────────────────────────────────────────────────────────────────────────

  /** Currently selected entity ID (single selection) */
  selectedEntityId: string | null;

  /** Multi-select entity IDs (for bulk operations) */
  multiSelect: string[];

  // ─────────────────────────────────────────────────────────────────────────
  // Modal
  // ─────────────────────────────────────────────────────────────────────────

  /** Modal state */
  modal: ModalState;

  // ─────────────────────────────────────────────────────────────────────────
  // View
  // ─────────────────────────────────────────────────────────────────────────

  /** Current view mode */
  viewMode: ViewMode;

  // ─────────────────────────────────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────────────────────────────────

  /** Whether data is currently loading */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;
}

/**
 * Create initial Library state.
 *
 * @param defaultTab - Default entity type tab to show (defaults to 'creature')
 */
export function createInitialLibraryState(
  defaultTab: EntityType = 'creature'
): LibraryState {
  return {
    // Navigation
    activeTab: defaultTab,

    // Browse
    searchQuery: '',
    filters: {},
    sort: {
      field: 'name',
      direction: 'asc',
    },

    // Data
    entities: [],
    totalCount: 0,
    page: 0,
    pageSize: 20,

    // Selection
    selectedEntityId: null,
    multiSelect: [],

    // Modal
    modal: {
      open: false,
      mode: 'create',
      entityId: null,
      currentSection: 'basic',
      isDirty: false,
    },

    // View
    viewMode: 'list',

    // Loading
    isLoading: false,
    error: null,
  };
}

// ============================================================================
// Render Hints
// ============================================================================

/**
 * Hints for optimized rendering.
 *
 * Used to notify the view which parts need to be re-rendered.
 */
export type LibraryRenderHint =
  | 'full'       // Full re-render
  | 'tabs'       // Tab navigation changed
  | 'list'       // Entity list changed
  | 'filters'    // Filter/search controls changed
  | 'selection'  // Selection state changed
  | 'modal'      // Modal state changed
  | 'loading';   // Loading state changed

// ============================================================================
// Callbacks
// ============================================================================

/** Callback for render updates */
export type LibraryRenderCallback = (
  state: Readonly<LibraryState>,
  hints: LibraryRenderHint[]
) => void;

/** Unsubscribe function type */
export type Unsubscribe = () => void;
