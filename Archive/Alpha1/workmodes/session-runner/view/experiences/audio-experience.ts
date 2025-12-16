/**
 * Audio Experience Module
 *
 * Manages audio playback for Session Runner including:
 * - Audio controller lifecycle
 * - Combat music switching
 * - Context-based playlist auto-selection
 *
 * @module workmodes/session-runner/view/experiences/audio-experience
 */

import { configurableLogger } from "@services/logging/configurable-logger";
import type { TFile } from "obsidian";
import type { RenderHandles } from "@features/maps";
import type { SessionRunnerLifecycleContext } from "../../controller";
import {
    createAudioController,
    type AudioControllerHandle,
} from "../../components/audio-controller";
import type { ExperienceCoordinator, ExperienceHandle } from "./experience-types";

const logger = configurableLogger.forModule("session-audio-experience");

/**
 * Extended handle for audio experience with music control methods
 */
export interface AudioExperienceHandle extends ExperienceHandle {
    /** Switch to combat music when combat starts */
    switchToCombatMusic(): Promise<void>;

    /** Restore previous music when combat ends */
    restorePreviousMusic(): Promise<void>;

    /**
     * Update audio context based on current position.
     * Triggers playlist auto-selection based on terrain, weather, etc.
     */
    updateContext(
        mapFile: TFile | null,
        coord: { q: number; r: number } | null
    ): Promise<void>;

    /** Get the underlying audio controller (for direct access if needed) */
    getController(): AudioControllerHandle | null;
}

/**
 * Create the audio experience module.
 *
 * @param coordinator - Shared experience coordinator
 * @returns Audio experience handle
 */
export function createAudioExperience(
    coordinator: ExperienceCoordinator
): AudioExperienceHandle {
    // State
    let audioController: AudioControllerHandle | null = null;

    return {
        async init(ctx: SessionRunnerLifecycleContext): Promise<void> {
            if (!coordinator.sidebar) {
                logger.warn("Cannot initialize audio - sidebar not available");
                return;
            }

            try {
                audioController = await createAudioController({
                    app: ctx.app,
                    host: coordinator.sidebar.root,
                });
                logger.info("Audio controller initialized");
            } catch (error) {
                logger.error("Failed to initialize audio controller", error);
            }
        },

        async dispose(): Promise<void> {
            if (audioController) {
                audioController.dispose();
                audioController = null;
                logger.info("Audio controller disposed");
            }
        },

        async onFileChange(
            file: TFile | null,
            handles: RenderHandles | null,
            ctx: SessionRunnerLifecycleContext
        ): Promise<void> {
            // Audio context updates happen via updateContext() called from travel experience
        },

        async switchToCombatMusic(): Promise<void> {
            if (audioController) {
                await audioController.switchToCombatMusic();
                logger.info("Switched to combat music");
            }
        },

        async restorePreviousMusic(): Promise<void> {
            if (audioController) {
                await audioController.restorePreviousMusic();
                logger.info("Restored previous music");
            }
        },

        async updateContext(
            mapFile: TFile | null,
            coord: { q: number; r: number } | null
        ): Promise<void> {
            if (audioController) {
                await audioController.updateContext(mapFile, coord);
            }
        },

        getController(): AudioControllerHandle | null {
            return audioController;
        },
    };
}
