/**
 * Encounter Experience Module
 *
 * Manages encounter generation and combat for Session Runner including:
 * - Encounter controller lifecycle
 * - Encounter tracker UI
 * - Random and manual encounter handling
 * - Combat start/end coordination with audio
 * - Loot generation
 *
 * @module workmodes/session-runner/view/experiences/encounter-experience
 */

import { configurableLogger } from "@services/logging/configurable-logger";
import { getPartyStore, getAveragePartyLevel, getPartySize } from "@services/state/party-store";
import type { TFile } from "obsidian";
import type { RenderHandles } from "@features/maps";
import type { EncounterGenerationContext } from "@features/encounters";
import { getCreatureStore } from "@features/encounters/creature-store";
import type { SessionRunnerLifecycleContext } from "../../controller";
import {
    createEncounterController,
    type EncounterControllerHandle,
} from "../../components/encounter-orchestrator";
import { getTravelStore } from "../../travel/engine/travel-store-registry";
import type { EncounterTrackerHandle } from "../../encounter-tracker-handle";
import type { ExperienceCoordinator, ExperienceHandle } from "./experience-types";
import type { AudioExperienceHandle } from "./audio-experience";
import type { Encounter } from "@features/encounters/encounter-types";

const logger = configurableLogger.forModule("session-encounter-experience");

/**
 * Extended handle for encounter experience with encounter management methods
 */
export interface EncounterExperienceHandle extends ExperienceHandle {
    /** Handle travel encounter (triggered by travel playback) */
    handleTravelEncounter(): Promise<void>;

    /** Handle manual encounter at a specific coordinate */
    handleManualEncounter(coord: { q: number; r: number }): Promise<void>;

    /** Generate a random encounter with the given context */
    generateRandomEncounter(context: EncounterGenerationContext): Promise<void>;

    /** Subscribe controller to TravelStore for reactive updates */
    subscribeToTravelStore(): void;

    /** Set the encounter tracker handle from controller */
    setTrackerHandle(handle: EncounterTrackerHandle): void;

    /** Get the encounter tracker handle */
    getTrackerHandle(): EncounterTrackerHandle | null;
}

/**
 * Create the encounter experience module.
 *
 * @param coordinator - Shared experience coordinator
 * @param audio - Audio experience for combat music coordination
 * @returns Encounter experience handle
 */
export function createEncounterExperience(
    coordinator: ExperienceCoordinator,
    audio: AudioExperienceHandle
): EncounterExperienceHandle {
    // State
    let encounterController: EncounterControllerHandle | null = null;
    let encounterTrackerHandle: EncounterTrackerHandle | null = null;
    let app: import("obsidian").App | null = null;

    /**
     * Handle loot generation after an encounter.
     */
    const handleLootRequested = async (enc: Encounter): Promise<void> => {
        if (coordinator.isAborted() || !coordinator.currentMapFile) return;

        try {
            // Build loot context from encounter
            const { generateLoot } = await import("@features/loot/loot-generator");

            // Extract tags from hex data for loot filtering
            let tags: string[] = [];
            // Note: Current coordinate would need to be passed through - for now use encounter data

            const partyStore = getPartyStore();
            const partyState = partyStore.get();
            const lootResult = generateLoot({
                partyLevel: getAveragePartyLevel(partyState),
                partySize: getPartySize(partyState),
                encounterXp: enc.totalXp,
                tags: tags.length > 0 ? tags : undefined,
            });

            logger.info("Loot generated", {
                gold: lootResult.bundle.gold,
                itemCount: lootResult.bundle.items.length,
                totalValue: lootResult.bundle.totalValue,
                warnings: lootResult.warnings,
            });

            // Display loot in interactive modal
            if (app) {
                const { openLootModal } = await import("../components/loot-modal");
                openLootModal(app, {
                    loot: lootResult.bundle,
                    onDistribute: (loot) => {
                        logger.info("Loot distributed to party", {
                            gold: loot.gold,
                            itemCount: loot.items.length,
                        });
                    },
                    onDismiss: () => {
                        logger.info("Loot dismissed");
                    },
                });
            }
        } catch (err) {
            logger.error("Failed to generate loot", err);
        }
    };

    return {
        async init(ctx: SessionRunnerLifecycleContext): Promise<void> {
            app = ctx.app;

            if (!coordinator.sidebar) {
                logger.warn("Cannot initialize encounters - sidebar not available");
                return;
            }

            // Open Encounter Tracker in right sidebar
            try {
                const { openEncounterTracker } = await import(
                    "../controllers/encounter/encounter-tracker-view"
                );
                encounterTrackerHandle = await openEncounterTracker(ctx.app);
                logger.info("Encounter Tracker opened");
            } catch (error) {
                logger.warn("Failed to open Encounter Tracker", error);
            }

            // Initialize encounter controller with explicit store injection
            try {
                encounterController = await createEncounterController({
                    app: ctx.app,
                    host: coordinator.sidebar.root,
                    getMapFile: () => coordinator.currentMapFile,
                    // Explicit DI: pass stores instead of relying on globals
                    travelStore: getTravelStore(),
                    creatureStore: getCreatureStore(),
                    onCombatStart: () => {
                        void audio.switchToCombatMusic();
                        logger.info("Combat started - switching to combat music");
                    },
                    onCombatEnd: () => {
                        void audio.restorePreviousMusic();
                        logger.info("Combat ended - restoring music");
                    },
                    onLootRequested: handleLootRequested,
                });
                logger.info("Encounter controller initialized");
            } catch (error) {
                logger.error("Failed to initialize encounter controller", error);
            }
        },

        async dispose(): Promise<void> {
            // Close encounter tracker
            if (encounterTrackerHandle) {
                try {
                    await encounterTrackerHandle.close();
                    logger.info("Encounter Tracker closed");
                } catch (error) {
                    logger.warn("Failed to close Encounter Tracker", error);
                }
                encounterTrackerHandle = null;
            }

            // Dispose encounter controller
            if (encounterController) {
                encounterController.dispose();
                encounterController = null;
                logger.info("Encounter controller disposed");
            }

            app = null;
        },

        async onFileChange(
            file: TFile | null,
            handles: RenderHandles | null,
            ctx: SessionRunnerLifecycleContext
        ): Promise<void> {
            // Encounter context updates happen via subscribeToTravelStore()
        },

        async handleTravelEncounter(): Promise<void> {
            if (encounterController) {
                await encounterController.handleTravelEncounter();
            }
        },

        async handleManualEncounter(coord: { q: number; r: number }): Promise<void> {
            if (encounterController) {
                await encounterController.handleManualEncounter(coord);
            }
        },

        async generateRandomEncounter(context: EncounterGenerationContext): Promise<void> {
            if (encounterController) {
                await encounterController.generateRandomEncounter(context);
            }
        },

        subscribeToTravelStore(): void {
            if (encounterController) {
                encounterController.subscribeToTravelStore();
                logger.info("EncounterController subscribed to TravelStore");
            }
        },

        setTrackerHandle(handle: EncounterTrackerHandle): void {
            encounterTrackerHandle = handle;
            logger.info("Encounter tracker handle set");
        },

        getTrackerHandle(): EncounterTrackerHandle | null {
            return encounterTrackerHandle;
        },
    };
}
