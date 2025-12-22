/**
 * Journal Feature public exports.
 *
 * Provides session logging and event history tracking.
 */

// Types and interfaces
export type { JournalFeaturePort, JournalStoragePort, InternalJournalState } from './types';
export { createInitialJournalState } from './types';

// Store
export { createJournalStore } from './journal-store';
export type { JournalStore } from './journal-store';

// Service (Orchestrator)
export { createJournalService } from './journal-service';
export type { JournalServiceDeps } from './journal-service';
