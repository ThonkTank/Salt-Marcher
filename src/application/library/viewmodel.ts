/**
 * Library ViewModel.
 *
 * Coordinates between Library UI and EntityRegistry.
 * Manages state for browsing, filtering, sorting, and CRUD operations.
 *
 * @see docs/application/Library.md
 */

import type { EventBus } from '@core/index';
import type { Result } from '@core/types/result';
import { ok, err } from '@core/types/result';
import type { EntityType, EntityId } from '@core/types/common';
import type {
  EntityRegistryPort,
  Entity,
  ValidationError,
  NotFoundError,
  IOError,
} from '@core/types/entity-registry.port';
import type {
  LibraryState,
  LibraryRenderHint,
  LibraryRenderCallback,
  FilterValue,
  ViewMode,
  SortDirection,
  Unsubscribe,
} from './types';
import { createInitialLibraryState } from './types';

// ============================================================================
// ViewModel Dependencies
// ============================================================================

export interface LibraryViewModelDeps {
  entityRegistry: EntityRegistryPort;
  eventBus?: EventBus;
}

// ============================================================================
// ViewModel Interface
// ============================================================================

export interface LibraryViewModel {
  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────

  /** Get current state (readonly) */
  getState(): Readonly<LibraryState>;

  /** Subscribe to state changes */
  subscribe(callback: LibraryRenderCallback): Unsubscribe;

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────

  /** Switch to a different entity type tab */
  setActiveTab(tab: EntityType): void;

  // ─────────────────────────────────────────────────────────────────────────
  // Browse
  // ─────────────────────────────────────────────────────────────────────────

  /** Set search query text */
  setSearchQuery(query: string): void;

  /** Set a filter value */
  setFilter(key: string, value: FilterValue): void;

  /** Clear all filters */
  clearFilters(): void;

  /** Set sort configuration */
  setSort(field: string, direction: SortDirection): void;

  // ─────────────────────────────────────────────────────────────────────────
  // Pagination
  // ─────────────────────────────────────────────────────────────────────────

  /** Go to a specific page */
  setPage(page: number): void;

  /** Load more items (append to current list) */
  loadMore(): void;

  // ─────────────────────────────────────────────────────────────────────────
  // Selection
  // ─────────────────────────────────────────────────────────────────────────

  /** Select a single entity */
  selectEntity(id: string | null): void;

  /** Toggle an entity in multi-select */
  toggleMultiSelect(id: string): void;

  /** Clear all selections */
  clearSelection(): void;

  // ─────────────────────────────────────────────────────────────────────────
  // Modal
  // ─────────────────────────────────────────────────────────────────────────

  /** Open create modal */
  openCreateModal(): void;

  /** Open edit modal for an entity */
  openEditModal(id: string): void;

  /** Close modal */
  closeModal(): void;

  /** Set current modal section */
  setModalSection(section: string): void;

  /** Mark modal as dirty (has unsaved changes) */
  setModalDirty(isDirty: boolean): void;

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────────────────────────────────────

  /** Save an entity (create or update) */
  saveEntity<T extends EntityType>(
    type: T,
    entity: Entity<T>
  ): Result<void, ValidationError | IOError>;

  /** Delete an entity */
  deleteEntity<T extends EntityType>(
    type: T,
    id: string
  ): Result<void, NotFoundError | IOError>;

  /** Duplicate an entity */
  duplicateEntity(id: string): void;

  // ─────────────────────────────────────────────────────────────────────────
  // View
  // ─────────────────────────────────────────────────────────────────────────

  /** Set view mode */
  setViewMode(mode: ViewMode): void;

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /** Initialize the ViewModel (load initial data) */
  initialize(): void;

  /** Clean up subscriptions and resources */
  dispose(): void;
}

// ============================================================================
// ViewModel Implementation
// ============================================================================

/**
 * Create the Library ViewModel.
 *
 * @param deps - Dependencies (entityRegistry, eventBus)
 * @returns LibraryViewModel instance
 *
 * @example
 * ```typescript
 * const viewModel = createLibraryViewModel({
 *   entityRegistry,
 *   eventBus,
 * });
 *
 * viewModel.subscribe((state, hints) => {
 *   if (hints.includes('list')) {
 *     renderEntityList(state.entities);
 *   }
 * });
 *
 * viewModel.initialize();
 * ```
 */
export function createLibraryViewModel(
  deps: LibraryViewModelDeps
): LibraryViewModel {
  const { entityRegistry } = deps;

  // Internal state
  let state: LibraryState = createInitialLibraryState();
  const subscribers: Set<LibraryRenderCallback> = new Set();

  // Track EventBus subscriptions for cleanup
  const eventSubscriptions: Unsubscribe[] = [];

  // =========================================================================
  // Helpers
  // =========================================================================

  /**
   * Notify all subscribers of state changes.
   */
  function notify(hints: LibraryRenderHint[]): void {
    for (const callback of subscribers) {
      callback(state, hints);
    }
  }

  /**
   * Update state and notify subscribers.
   */
  function updateState(
    partial: Partial<LibraryState>,
    hints: LibraryRenderHint[]
  ): void {
    state = { ...state, ...partial };
    notify(hints);
  }

  /**
   * Refresh entities from EntityRegistry based on current filters.
   */
  function refreshEntities(): void {
    const { activeTab, searchQuery, filters, sort, page, pageSize } = state;

    try {
      // Get all entities of current type
      let entities = entityRegistry.getAll(activeTab) as unknown[];

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        entities = entities.filter((entity) => {
          // Search in name and other common fields
          const searchable = JSON.stringify(entity).toLowerCase();
          return searchable.includes(query);
        });
      }

      // Apply type-specific filters
      entities = applyFilters(entities, filters, activeTab);

      // Sort
      entities = sortEntities(entities, sort.field, sort.direction);

      // Get total count before pagination
      const totalCount = entities.length;

      // Paginate
      const startIndex = page * pageSize;
      const paginatedEntities = entities.slice(
        startIndex,
        startIndex + pageSize
      );

      updateState(
        {
          entities: paginatedEntities,
          totalCount,
          isLoading: false,
          error: null,
        },
        ['list']
      );
    } catch (error) {
      updateState(
        {
          entities: [],
          totalCount: 0,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        ['list', 'loading']
      );
    }
  }

  /**
   * Apply type-specific filters to entities.
   */
  function applyFilters(
    entities: unknown[],
    filters: Record<string, FilterValue>,
    _entityType: EntityType
  ): unknown[] {
    // Skip if no filters
    if (Object.keys(filters).length === 0) {
      return entities;
    }

    return entities.filter((entity) => {
      const record = entity as Record<string, unknown>;

      for (const [key, value] of Object.entries(filters)) {
        // Skip null/undefined filter values
        if (value === null || value === undefined) continue;

        const entityValue = record[key];

        // Handle array filter values (any match)
        if (Array.isArray(value)) {
          if (!value.includes(entityValue as string)) {
            return false;
          }
        }
        // Handle boolean filters
        else if (typeof value === 'boolean') {
          if (entityValue !== value) {
            return false;
          }
        }
        // Handle string/number filters
        else if (entityValue !== value) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort entities by field.
   */
  function sortEntities(
    entities: unknown[],
    field: string,
    direction: SortDirection
  ): unknown[] {
    return [...entities].sort((a, b) => {
      const aRecord = a as Record<string, unknown>;
      const bRecord = b as Record<string, unknown>;

      const aValue = aRecord[field];
      const bValue = bRecord[field];

      // Handle undefined values
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return direction === 'asc' ? 1 : -1;
      if (bValue === undefined) return direction === 'asc' ? -1 : 1;

      // String comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return direction === 'asc' ? comparison : -comparison;
      }

      // Number comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }

  /**
   * Generate a new ID for duplicated entity.
   */
  function generateDuplicateId(originalId: string): string {
    const timestamp = Date.now().toString(36);
    return `${originalId}-copy-${timestamp}`;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    getState(): Readonly<LibraryState> {
      return state;
    },

    subscribe(callback: LibraryRenderCallback): Unsubscribe {
      subscribers.add(callback);
      // Immediately call with current state
      callback(state, ['full']);
      return () => subscribers.delete(callback);
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Navigation
    // ─────────────────────────────────────────────────────────────────────────

    setActiveTab(tab: EntityType): void {
      if (tab === state.activeTab) return;

      // Reset browse state when switching tabs
      updateState(
        {
          activeTab: tab,
          searchQuery: '',
          filters: {},
          page: 0,
          selectedEntityId: null,
          multiSelect: [],
          isLoading: true,
        },
        ['tabs', 'filters', 'selection', 'loading']
      );

      // Refresh entities for new tab
      refreshEntities();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Browse
    // ─────────────────────────────────────────────────────────────────────────

    setSearchQuery(query: string): void {
      updateState(
        {
          searchQuery: query,
          page: 0, // Reset to first page on search
        },
        ['filters']
      );
      refreshEntities();
    },

    setFilter(key: string, value: FilterValue): void {
      const newFilters = { ...state.filters };

      if (value === null || value === undefined) {
        delete newFilters[key];
      } else {
        newFilters[key] = value;
      }

      updateState(
        {
          filters: newFilters,
          page: 0, // Reset to first page on filter change
        },
        ['filters']
      );
      refreshEntities();
    },

    clearFilters(): void {
      updateState(
        {
          searchQuery: '',
          filters: {},
          page: 0,
        },
        ['filters']
      );
      refreshEntities();
    },

    setSort(field: string, direction: SortDirection): void {
      updateState(
        {
          sort: { field, direction },
        },
        ['list']
      );
      refreshEntities();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Pagination
    // ─────────────────────────────────────────────────────────────────────────

    setPage(page: number): void {
      if (page === state.page) return;

      updateState({ page }, ['list']);
      refreshEntities();
    },

    loadMore(): void {
      const { page, pageSize, totalCount, entities } = state;
      const currentCount = (page + 1) * pageSize;

      // Check if there are more items to load
      if (currentCount >= totalCount) return;

      // Increment page and append new entities
      const newPage = page + 1;
      const { activeTab, searchQuery, filters, sort } = state;

      try {
        // Get all entities and apply filters
        let allEntities = entityRegistry.getAll(activeTab) as unknown[];

        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          allEntities = allEntities.filter((entity) =>
            JSON.stringify(entity).toLowerCase().includes(query)
          );
        }

        allEntities = applyFilters(allEntities, filters, activeTab);
        allEntities = sortEntities(allEntities, sort.field, sort.direction);

        // Get next page
        const startIndex = newPage * pageSize;
        const newEntities = allEntities.slice(startIndex, startIndex + pageSize);

        updateState(
          {
            page: newPage,
            entities: [...entities, ...newEntities],
          },
          ['list']
        );
      } catch (error) {
        updateState(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          ['loading']
        );
      }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Selection
    // ─────────────────────────────────────────────────────────────────────────

    selectEntity(id: string | null): void {
      if (id === state.selectedEntityId) return;
      updateState({ selectedEntityId: id }, ['selection']);
    },

    toggleMultiSelect(id: string): void {
      const newMultiSelect = state.multiSelect.includes(id)
        ? state.multiSelect.filter((i) => i !== id)
        : [...state.multiSelect, id];

      updateState({ multiSelect: newMultiSelect }, ['selection']);
    },

    clearSelection(): void {
      updateState(
        {
          selectedEntityId: null,
          multiSelect: [],
        },
        ['selection']
      );
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Modal
    // ─────────────────────────────────────────────────────────────────────────

    openCreateModal(): void {
      updateState(
        {
          modal: {
            open: true,
            mode: 'create',
            entityId: null,
            currentSection: 'basic',
            isDirty: false,
          },
        },
        ['modal']
      );
    },

    openEditModal(id: string): void {
      updateState(
        {
          modal: {
            open: true,
            mode: 'edit',
            entityId: id,
            currentSection: 'basic',
            isDirty: false,
          },
        },
        ['modal']
      );
    },

    closeModal(): void {
      updateState(
        {
          modal: {
            ...state.modal,
            open: false,
          },
        },
        ['modal']
      );
    },

    setModalSection(section: string): void {
      updateState(
        {
          modal: {
            ...state.modal,
            currentSection: section,
          },
        },
        ['modal']
      );
    },

    setModalDirty(isDirty: boolean): void {
      updateState(
        {
          modal: {
            ...state.modal,
            isDirty,
          },
        },
        ['modal']
      );
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD
    // ─────────────────────────────────────────────────────────────────────────

    saveEntity<T extends EntityType>(
      type: T,
      entity: Entity<T>
    ): Result<void, ValidationError | IOError> {
      const result = entityRegistry.save(type, entity);

      if (result.ok) {
        // Refresh list to show new/updated entity
        refreshEntities();
      }

      return result;
    },

    deleteEntity<T extends EntityType>(
      type: T,
      id: string
    ): Result<void, NotFoundError | IOError> {
      const result = entityRegistry.delete(type, id as EntityId<T>);

      if (result.ok) {
        // Clear selection if deleted entity was selected
        if (state.selectedEntityId === id) {
          updateState({ selectedEntityId: null }, ['selection']);
        }

        // Refresh list
        refreshEntities();
      }

      return result;
    },

    duplicateEntity(id: string): void {
      const { activeTab } = state;

      // Get original entity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const original = entityRegistry.get(activeTab, id as any);

      if (!original) {
        updateState({ error: `Entity not found: ${id}` }, ['loading']);
        return;
      }

      // Create duplicate with new ID
      const duplicate = {
        ...(original as Record<string, unknown>),
        id: generateDuplicateId(id),
        name: `${(original as Record<string, unknown>).name || id} (Copy)`,
      };

      // Save duplicate
      const result = entityRegistry.save(
        activeTab,
        duplicate as Entity<typeof activeTab>
      );

      if (result.ok) {
        refreshEntities();
      } else {
        updateState(
          {
            error: `Failed to duplicate: ${result.error.message}`,
          },
          ['loading']
        );
      }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // View
    // ─────────────────────────────────────────────────────────────────────────

    setViewMode(mode: ViewMode): void {
      if (mode === state.viewMode) return;
      updateState({ viewMode: mode }, ['list']);
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    initialize(): void {
      updateState({ isLoading: true }, ['loading']);
      refreshEntities();
    },

    dispose(): void {
      // Clean up EventBus subscriptions
      for (const unsubscribe of eventSubscriptions) {
        unsubscribe();
      }
      eventSubscriptions.length = 0;

      // Clean up render subscribers
      subscribers.clear();
    },
  };
}
