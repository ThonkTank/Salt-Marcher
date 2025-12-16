// src/workmodes/library/index.ts
// Entry point for Library workmode - exports public API

// ==================== View & Core ====================
export { LibraryView, VIEW_LIBRARY, openLibrary, LIBRARY_COPY } from './view';
export { LibraryController } from './library-controller';
export type { LibraryControllerContext } from './library-controller';

// ==================== Types ====================
export type { LibraryActionContext, LibraryViewConfig, LibraryMetadataField, LibraryAction } from './library-types';
export type { FilterableLibraryMode, LibraryEntry } from './storage/data-sources';

// ==================== Registry ====================
export {
    LIBRARY_CREATE_SPECS,
    LIBRARY_VIEW_CONFIGS,
    LIBRARY_LIST_SCHEMAS,
    getCreateSpec,
    getViewConfig,
    getListSchema,
} from './registry';
export type { LibraryEntity } from './registry';

// ==================== Entity Specs (Re-exports) ====================
export { calendarSpec } from './calendars';
export { characterCreateSpec } from './characters';
export { creatureSpec } from './creatures';
export { equipmentSpec } from './equipment';
export { factionSpec } from './factions';
export { itemSpec } from './items';
export { locationSpec } from './locations';
export { playlistSpec } from './playlists';
export { regionSpec } from './regions';
export { spellSpec } from './spells';
export { terrainSpec } from './terrains';

// ==================== Data Sources ====================
export { LIBRARY_DATA_SOURCES } from './storage/data-sources';

// ==================== Core Services ====================
export { describeLibrarySource, ensureLibrarySources } from './core/sources';
