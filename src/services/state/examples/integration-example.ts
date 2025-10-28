// src/services/state/examples/integration-example.ts
// Example integration showing how to use the new state management system
// This demonstrates writable, persistent, and derived stores with event bus integration

import { App } from "obsidian";
import { writable, derived } from "../writable-store";
import { persistent } from "../persistent-store";
import { getStoreManager } from "../store-manager";
import { createEncounterStoreAdapters } from "../adapters/encounter-store-adapter";
import {
    eventBus,
    EventTopic,
    createEvent,
    type TravelProgressEvent,
    type EncounterStartedEvent,
} from "../../events";
import { logger } from "../../../app/plugin-logger";

/**
 * Example: Party state management
 */
interface PartyState {
    members: Array<{
        id: string;
        name: string;
        level: number;
        hp: number;
        maxHp: number;
    }>;
    location: { r: number; c: number } | null;
    travelProgress: number; // 0-1
}

/**
 * Example: Game session state
 */
interface SessionState {
    sessionId: string;
    startTime: string;
    encounterCount: number;
    distanceTraveled: number;
}

/**
 * Initialize example stores and demonstrate usage
 */
export async function initializeExampleStores(app: App) {
    logger.info("[Example] Initializing example stores");

    const manager = getStoreManager();

    // ========================================
    // 1. Simple writable store for party state
    // ========================================

    const partyStore = writable<PartyState>(
        {
            members: [],
            location: null,
            travelProgress: 0,
        },
        {
            name: "party-state",
            debug: true,
        }
    );

    // Register with manager
    manager.register("party", partyStore);

    // Subscribe to changes
    const unsubParty = partyStore.subscribe(state => {
        logger.info("[Example] Party state changed:", state);
    });

    // ========================================
    // 2. Persistent store for session data
    // ========================================

    const sessionStore = persistent<SessionState>(
        {
            sessionId: `session-${Date.now()}`,
            startTime: new Date().toISOString(),
            encounterCount: 0,
            distanceTraveled: 0,
        },
        {
            app,
            filePath: ".obsidian/plugins/salt-marcher/session-state.json",
            version: 1,
            autoSave: true,
            autoSaveDelay: 5000,
            name: "session-state",
        }
    );

    // Register with manager
    manager.register("session", sessionStore);

    // Load existing session data
    await sessionStore.load();

    // ========================================
    // 3. Derived store for party status
    // ========================================

    const partyStatusStore = derived(
        [partyStore],
        (party: PartyState) => {
            const totalMembers = party.members.length;
            const averageLevel = totalMembers > 0
                ? party.members.reduce((sum, m) => sum + m.level, 0) / totalMembers
                : 0;
            const totalHp = party.members.reduce((sum, m) => sum + m.hp, 0);
            const totalMaxHp = party.members.reduce((sum, m) => sum + m.maxHp, 0);
            const healthPercent = totalMaxHp > 0 ? (totalHp / totalMaxHp) * 100 : 0;

            return {
                memberCount: totalMembers,
                averageLevel: Math.round(averageLevel * 10) / 10,
                healthPercent: Math.round(healthPercent),
                isInCombat: party.travelProgress === 0, // Simplified logic
                canTravel: totalMembers > 0 && party.location !== null,
            };
        }
    );

    manager.register("party-status", partyStatusStore);

    // ========================================
    // 4. Adapt existing encounter stores
    // ========================================

    const encounterAdapters = createEncounterStoreAdapters();
    manager.register("encounter-events", encounterAdapters.events);
    manager.register("encounter-xp", encounterAdapters.xpState);

    // ========================================
    // 5. Event bus integration
    // ========================================

    // Listen for travel events and update party location
    const unsubTravel = eventBus.subscribe<TravelProgressEvent>(
        (event) => {
            if (event.type === "progress") {
                partyStore.update(state => ({
                    ...state,
                    location: event.data.currentCoord,
                    travelProgress: event.data.progress,
                }));
            }
        },
        {
            topics: EventTopic.TRAVEL,
        }
    );

    // Listen for encounter events and update session stats
    const unsubEncounter = eventBus.subscribe<EncounterStartedEvent>(
        async (event) => {
            if (event.type === "started") {
                sessionStore.update(state => ({
                    ...state,
                    encounterCount: state.encounterCount + 1,
                }));

                // Emit to encounter store adapter
                encounterAdapters.events.set({
                    id: event.id,
                    source: "travel",
                    triggeredAt: event.timestamp,
                    coord: event.data.coord || null,
                    regionName: event.data.regionName,
                    encounterOdds: event.data.encounterOdds,
                });
            }
        },
        {
            topics: EventTopic.ENCOUNTER,
            async: true, // Run asynchronously
        }
    );

    // ========================================
    // 6. Example operations
    // ========================================

    // Add party members
    partyStore.update(state => ({
        ...state,
        members: [
            { id: "p1", name: "Aragorn", level: 8, hp: 72, maxHp: 72 },
            { id: "p2", name: "Legolas", level: 7, hp: 58, maxHp: 63 },
            { id: "p3", name: "Gimli", level: 7, hp: 45, maxHp: 70 },
            { id: "p4", name: "Gandalf", level: 10, hp: 38, maxHp: 38 },
        ],
        location: { r: 10, c: 15 },
    }));

    // Simulate travel event
    const travelEvent = createEvent<TravelProgressEvent>(
        EventTopic.TRAVEL,
        "progress",
        "example",
        {
            currentCoord: { r: 11, c: 15 },
            progress: 0.25,
            hoursElapsed: 2,
        }
    );
    await eventBus.emit(travelEvent);

    // Simulate encounter event
    const encounterEvent = createEvent<EncounterStartedEvent>(
        EventTopic.ENCOUNTER,
        "started",
        "example",
        {
            coord: { r: 11, c: 15 },
            regionName: "Dark Forest",
            encounterOdds: 6,
            creatures: ["Dire Wolf", "Dire Wolf", "Wolf"],
        }
    );
    await eventBus.emit(encounterEvent);

    // ========================================
    // 7. Demonstrate store manager capabilities
    // ========================================

    // List all stores
    logger.info("[Example] Registered stores:", manager.list());

    // Get store stats
    const stats = (manager as any).getStats();
    logger.info("[Example] Store statistics:", stats);

    // Save all persistent stores
    await manager.saveAll();

    // ========================================
    // 8. Cleanup function
    // ========================================

    return () => {
        logger.info("[Example] Cleaning up example stores");

        // Unsubscribe from stores
        unsubParty();
        unsubTravel();
        unsubEncounter();

        // Clear event bus subscriptions
        eventBus.clear();

        // Dispose of store manager
        manager.dispose();
    };
}

/**
 * Example usage in a plugin context
 */
export async function examplePluginUsage(app: App) {
    // Initialize stores on plugin load
    const cleanup = await initializeExampleStores(app);

    // Use stores throughout the plugin...
    const manager = getStoreManager();
    const partyStore = manager.get<PartyState>("party");

    if (partyStore) {
        const currentParty = partyStore.get();
        logger.info("[Example] Current party:", currentParty);
    }

    // Save all stores on plugin unload
    await manager.saveAll();

    // Cleanup on plugin unload
    cleanup();
}