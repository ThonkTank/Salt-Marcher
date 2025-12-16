/**
 * Library Orchestration Service
 *
 * Provides access to Library workmode data sources for other workmodes.
 * This facade layer prevents direct cross-workmode imports while allowing
 * other workmodes to discover and load library entities.
 *
 * Architecture: Workmodes → Services → Workmodes (via orchestration)
 * This service acts as a bridge, maintaining proper layer separation.
 *
 * Types come from @services/domain/library-types (centralized type layer).
 * Runtime implementations come from @workmodes/library/storage (workmode layer).
 *
 * @module services/orchestration/library-orchestrator
 */

// Re-export data source discovery from Library workmode (runtime implementation)
export { LIBRARY_DATA_SOURCES } from "@workmodes/library/storage/data-sources";

// Re-export types from centralized domain layer
export type {
	FilterableLibraryMode,
	LibraryEntry,
	LibraryDataSourceMap,
} from "@services/domain/library-types";
