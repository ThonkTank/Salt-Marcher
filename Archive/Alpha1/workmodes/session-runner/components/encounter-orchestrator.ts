/**
 * Encounter Controller for Session Runner
 *
 * Manages random encounter generation lifecycle including:
 * - Building encounter context from current hex
 * - Generating balanced habitat-based encounters
 * - Managing initiative tracker UI
 * - Coordinating with loot and audio systems
 *
 * Uses global CreatureStore (initialized at plugin load).
 * Uses TravelStore for reactive context updates via subscribeToTravelStore().
 */

import type { App, TFile } from "obsidian";
import { Notice } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";
import {
    generateEncounterFromHabitat,
    type EncounterGenerationContext,
} from "@features/encounters/encounter-generator";

const logger = configurableLogger.forModule("session-encounter-orchestrator");
import { getCreatureStore, type CreatureStoreInstance } from "@features/encounters/creature-store";
import {
    createPartyRepository,
    type PartyRepository,
} from "@features/encounters/party-repository";
import type {
    Combatant,
    Encounter,
} from "@features/encounters/encounter-types";
import type { LogicStateSnapshot } from "../travel/engine/playback";
import { buildEncounterContext } from "../encounter-context-builder";
import {
    openEncounterTracker,
    type EncounterTrackerView,
} from "../view/controllers/encounter/encounter-tracker-view";
import { loadTile } from "@features/maps";
import { getTravelStore, type Store } from "../travel/engine/travel-store-registry";

export type EncounterControllerHandle = {
    /**
     * Subscribe to the TravelStore for reactive state updates.
     * Call this after TravelLogic is created (e.g., in onFileChange).
     */
    subscribeToTravelStore(): void;
    handleTravelEncounter(): Promise<void>;
    handleManualEncounter(coord: { q: number; r: number }): Promise<void>;
    generateRandomEncounter(context: EncounterGenerationContext): Promise<void>;
    clearEncounter(): void;
    dispose(): void;
};

type EncounterControllerOptions = {
    app: App;
    host: HTMLElement;
    /**
     * Getter for current map file. Required for reactive mode.
     * The controller will get travel state from TravelStore automatically.
     */
    getMapFile: () => TFile | null;
    onLootRequested?: (encounter: Encounter) => Promise<void>;
    onCombatStart?: () => void;
    onCombatEnd?: () => void;
    partyRepository?: PartyRepository;
    /**
     * Optional TravelStore instance for dependency injection.
     * If not provided, falls back to global getTravelStore().
     */
    travelStore?: Store | null;
    /**
     * Optional CreatureStore instance for dependency injection.
     * If not provided, falls back to global getCreatureStore().
     */
    creatureStore?: CreatureStoreInstance | null;
};

export async function createEncounterController(
    options: EncounterControllerOptions
): Promise<EncounterControllerHandle> {
    const { app, getMapFile, onLootRequested, onCombatStart, onCombatEnd } = options;

    // Dependency injection
    const partyRepo = options.partyRepository ?? createPartyRepository();

    // Travel Context State - updated reactively via TravelStore subscription
    let currentState: LogicStateSnapshot | null = null;
    let travelStoreUnsubscribe: (() => void) | null = null;

    // Encounter State
    let currentEncounter: Encounter | null = null;
    let combatants: Combatant[] = [];
    let activeTurnIndex = -1;

    // Encounter Tracker Handle
    let encounterTrackerHandle: import("../encounter-tracker-handle").EncounterTrackerHandle | null =
        null;

    /**
     * Subscribe to TravelStore for reactive state updates.
     * Uses injected travelStore if provided, otherwise falls back to global.
     */
    function subscribeToTravelStore(): void {
        // Cleanup existing subscription
        if (travelStoreUnsubscribe) {
            travelStoreUnsubscribe();
            travelStoreUnsubscribe = null;
        }

        // Use injected store or fall back to global
        const store = options.travelStore ?? getTravelStore();
        if (!store) {
            logger.debug("TravelStore not available yet");
            currentState = null;
            return;
        }

        travelStoreUnsubscribe = store.subscribe((state) => {
            currentState = state;
            logger.debug("State updated from TravelStore", {
                currentTile: state.currentTile,
                tokenCoord: state.tokenCoord,
            });
        });

        logger.info("Subscribed to TravelStore", {
            injected: !!options.travelStore,
        });
    }

    // Verify creature store is ready (it should be - initialized at plugin load)
    // Uses injected creatureStore if provided, otherwise falls back to global
    try {
        const store = options.creatureStore ?? getCreatureStore();
        const state = store.get();
        if (state.creatures.length === 0 && !state.loading) {
            logger.warn(
                "CreatureStore is empty - encounters may not work"
            );
        } else {
            logger.info("CreatureStore ready", {
                creatures: state.creatures.length,
                injected: !!options.creatureStore,
            });
        }
    } catch (err) {
        logger.error("CreatureStore not initialized", err);
        new Notice(
            "Creature store not ready. Please restart the plugin."
        );
        throw err;
    }

    /**
     * Load player characters as combatants
     */
    async function loadPlayerCharactersAsCombatants(
        party: readonly {
            id: string;
            characterId?: string;
            name: string;
            level: number;
        }[]
    ): Promise<Combatant[]> {
        const playerCombatants: Combatant[] = [];

        for (const member of party) {
            if (!member.characterId) continue;

            try {
                const character = partyRepo.getCharacterById(member.characterId);
                if (!character) {
                    logger.warn("Character not found", {
                        characterId: member.characterId,
                    });
                    continue;
                }

                const initiative = Math.floor(Math.random() * 20) + 1;

                playerCombatants.push({
                    id: `player-${character.id}`,
                    name: character.name,
                    cr: 0,
                    initiative,
                    currentHp: character.maxHp,
                    maxHp: character.maxHp,
                    tempHp: 0,
                    ac: character.ac,
                    defeated: false,
                    characterId: character.id,
                    characterClass: character.characterClass,
                });

                logger.info("Added player", {
                    name: character.name,
                    initiative,
                });
            } catch (err) {
                logger.error("Failed to load character", err);
            }
        }

        return playerCombatants;
    }

    /**
     * Generate random encounter using habitat-based generation
     */
    async function generateRandomEncounter(
        context: EncounterGenerationContext
    ): Promise<void> {
        try {
            logger.info("Generating encounter", {
                hasTileData: !!context.tileData,
                partySize: context.party.length,
            });

            // Generate encounter (uses global CreatureStore internally)
            const encounter = generateEncounterFromHabitat(context);

            logger.info("Encounter generated", {
                combatants: encounter.combatants.length,
                difficulty: encounter.difficulty,
                totalXp: encounter.totalXp,
            });

            currentEncounter = encounter;
            combatants = [...encounter.combatants];

            // Add player characters
            const playerCombatants = await loadPlayerCharactersAsCombatants(
                context.party
            );
            if (playerCombatants.length > 0) {
                combatants.push(...playerCombatants);
            }

            // Sort by initiative (descending)
            combatants.sort((a, b) => b.initiative - a.initiative);
            activeTurnIndex = 0;

            // Show notice
            if (encounter.warnings?.length > 0) {
                logger.warn("Warnings", {
                    warnings: encounter.warnings,
                });
                new Notice(`Encounter: ${encounter.warnings.join(", ")}`);
            } else {
                new Notice(
                    `${encounter.difficulty.toUpperCase()}: ${encounter.combatants.length} creatures (${encounter.adjustedXp} XP)`
                );
            }

            // Send to tracker view
            if (encounterTrackerHandle) {
                await encounterTrackerHandle.receiveEncounter(encounter);
            }

            onCombatStart?.();
        } catch (err) {
            logger.error("Generation failed", err);
            new Notice("Failed to generate encounter.");
        }
    }

    /**
     * Handle travel encounter - uses getMapFile() and reactive state
     */
    async function handleTravelEncounter(): Promise<void> {
        const currentMapFile = getMapFile();

        if (!currentMapFile || !currentState) {
            logger.warn("Missing context for travel encounter", {
                hasMapFile: !!currentMapFile,
                hasState: !!currentState,
            });
            new Notice("Begegnung konnte nicht gestartet werden.");
            return;
        }

        try {
            const currentCoord =
                currentState.currentTile ?? currentState.tokenCoord ?? null;
            let tileData: import("@features/maps").TileData | null =
                null;
            if (currentCoord) {
                tileData = await loadTile(app, currentMapFile, currentCoord);
            }

            const context = await buildEncounterContext(
                app,
                currentMapFile,
                currentState,
                tileData
            );

            // Random difficulty: Easy 50%, Medium 30%, Hard 20%
            const roll = Math.random();
            context.difficulty = roll < 0.5 ? "easy" : roll < 0.8 ? "medium" : "hard";

            encounterTrackerHandle = await openEncounterTracker(app);
            await generateRandomEncounter(context);
        } catch (err) {
            logger.error("Travel encounter failed", err);
            new Notice("Reisebegegnung konnte nicht generiert werden.");
        }
    }

    /**
     * Handle manual encounter at specific coordinate
     */
    async function handleManualEncounter(coord: {
        q: number;
        r: number;
    }): Promise<void> {
        const currentMapFile = getMapFile();

        if (!currentMapFile || !currentState) {
            logger.warn("Missing context for manual encounter", {
                hasMapFile: !!currentMapFile,
                hasState: !!currentState,
            });
            new Notice("Begegnung konnte nicht gestartet werden.");
            return;
        }

        try {
            const tileData = await loadTile(app, currentMapFile, coord);

            const stateWithCoord: LogicStateSnapshot = {
                ...currentState,
                currentTile: coord,
                tokenCoord: coord,
            };
            const context = await buildEncounterContext(
                app,
                currentMapFile,
                stateWithCoord,
                tileData
            );
            context.difficulty = "medium";

            encounterTrackerHandle = await openEncounterTracker(app);
            await generateRandomEncounter(context);
        } catch (err) {
            logger.error("Manual encounter failed", err);
            new Notice("Manuelle Begegnung konnte nicht generiert werden.");
        }
    }

    function clearEncounter(): void {
        currentEncounter = null;
        combatants = [];
        activeTurnIndex = -1;
        logger.info("Cleared");
    }

    async function dispose(): Promise<void> {
        // Cleanup TravelStore subscription
        if (travelStoreUnsubscribe) {
            travelStoreUnsubscribe();
            travelStoreUnsubscribe = null;
            logger.info("Unsubscribed from TravelStore");
        }

        clearEncounter();

        if (encounterTrackerHandle) {
            await encounterTrackerHandle.close();
            encounterTrackerHandle = null;
        }

        logger.info("Disposed");
    }

    return {
        subscribeToTravelStore,
        handleTravelEncounter,
        handleManualEncounter,
        generateRandomEncounter,
        clearEncounter,
        dispose,
    };
}
