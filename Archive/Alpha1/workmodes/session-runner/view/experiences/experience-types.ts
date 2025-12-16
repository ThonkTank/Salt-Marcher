/**
 * Shared Types for Session Runner Experiences
 *
 * Defines the ExperienceHandle interface that all experience modules implement,
 * and the ExperienceCoordinator that provides shared context.
 *
 * @module workmodes/session-runner/view/experiences/types
 */

import type { TFile } from "obsidian";
import type { RenderHandles } from "@features/maps";
import type { ErrorNotificationService } from "@services/error-notification-service";
import type { SessionRunnerLifecycleContext } from "../../controller";
import type { Sidebar } from "../../travel/ui/sidebar";

/**
 * Handle interface for individual experience modules.
 * Each experience (travel, audio, encounter, calendar) implements this.
 *
 * @template TState - Optional state type returned by getState()
 */
export interface ExperienceHandle<TState = void> {
    /**
     * Initialize the experience.
     * Called when Session Runner enters travel mode.
     */
    init(ctx: SessionRunnerLifecycleContext): Promise<void>;

    /**
     * Dispose of the experience and release all resources.
     * Called when Session Runner exits travel mode.
     */
    dispose(): Promise<void>;

    /**
     * Handle file change events.
     * Called when the user switches to a different map file.
     */
    onFileChange?(
        file: TFile | null,
        handles: RenderHandles | null,
        ctx: SessionRunnerLifecycleContext
    ): Promise<void>;

    /**
     * Get current state of the experience (optional).
     */
    getState?(): TState;
}

/**
 * Shared context provided to all experience modules.
 * Acts as a minimal dependency injection container.
 */
export interface ExperienceCoordinator {
    /** The sidebar UI component (null before init) */
    readonly sidebar: Sidebar | null;

    /** The currently loaded map file (null if no map selected) */
    readonly currentMapFile: TFile | null;

    /** Error notification service for user-facing errors */
    readonly notificationService: ErrorNotificationService;

    /** Check if lifecycle has been aborted */
    isAborted(): boolean;
}

/**
 * Mutable coordinator state for internal use.
 * The experience.ts coordinator updates these values.
 */
export interface MutableCoordinatorState {
    sidebar: Sidebar | null;
    currentMapFile: TFile | null;
}
