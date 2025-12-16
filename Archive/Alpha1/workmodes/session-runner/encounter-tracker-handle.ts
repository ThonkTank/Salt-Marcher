/**
 * Handle interface for encounter tracker
 * Provides abstracted access to encounter tracker functionality
 */

import type { Encounter } from "@features/encounters/encounter-types";

export interface EncounterTrackerHandle {
    /**
     * Update the encounter tracker with current hex data
     * Uses global CreatureStore internally
     * @param coord - Hex coordinate
     * @param tileData - Habitat data from the tile
     */
    updateHex(
        coord: { x: number; y: number },
        tileData: { terrain?: string; flora?: string; moisture?: string }
    ): Promise<void>;

    /**
     * Receive a generated encounter and prepare it for combat
     * @param encounter - The generated encounter with combatants
     */
    receiveEncounter(encounter: Encounter): Promise<void>;

    /**
     * Close the encounter tracker view
     */
    close(): Promise<void>;
}