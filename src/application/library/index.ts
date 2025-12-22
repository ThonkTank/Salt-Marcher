/**
 * Library module exports.
 *
 * The Library is the central CRUD interface for all entity types.
 *
 * @see docs/application/Library.md
 */

// Types
export {
  VIEW_TYPE_LIBRARY,
  type FilterValue,
  type FilterState,
  type SortDirection,
  type SortConfig,
  type ViewMode,
  type ModalMode,
  type ModalState,
  type LibraryState,
  type LibraryRenderHint,
  type LibraryRenderCallback,
  type Unsubscribe,
  createInitialLibraryState,
} from './types';

// ViewModel
export {
  type LibraryViewModelDeps,
  type LibraryViewModel,
  createLibraryViewModel,
} from './viewmodel';
