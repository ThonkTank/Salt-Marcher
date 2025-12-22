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
