// src/services/state/party-store.ts
// Shared party roster store used across workmodes (Session Runner, Encounter Calculator)
// Provides persistent storage for individual party member tracking

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('state-party-store');
import { persistent } from "./persistent-store";
import type { PersistentStore } from "./store.interface";
import type { Character } from "@services/domain";

/**
 * Party member with individual tracking (name, level, XP)
 * Shared type used across Session Runner and Encounter Calculator
 */
export interface PartyMember {
    readonly id: string;
    readonly characterId?: string;     // Optional reference to Character in library (tight coupling for auto-sync)
    readonly name: string;
    readonly level: number;
    readonly currentXp?: number;
}

/**
 * Party roster state
 */
export interface PartyState {
    readonly members: ReadonlyArray<PartyMember>;
}

/**
 * Mutable draft for party state updates
 */
interface PartyStateDraft {
    members: PartyMember[];
}

// Store instance
let partyStore: PersistentStore<PartyState> | null = null;

/**
 * Initialize party store with Obsidian app context
 * Must be called during plugin load
 */
export function initializePartyStore(app: App): PersistentStore<PartyState> {
    if (partyStore) {
        logger.warn("Already initialized, returning existing instance");
        return partyStore;
    }

    const initialState: PartyState = {
        members: [],
    };

    partyStore = persistent(initialState, {
        app,
        filePath: ".obsidian/plugins/salt-marcher/data/party-roster.json",
        version: 1,
        name: "party-roster",
        autoSave: true,
        autoSaveDelay: 500,
    });

    logger.info("Initialized");
    return partyStore;
}

/**
 * Get party store instance (must call initializePartyStore first)
 */
export function getPartyStore(): PersistentStore<PartyState> {
    if (!partyStore) {
        throw new Error(
            "Not initialized. Call initializePartyStore() during plugin load."
        );
    }
    return partyStore;
}

/**
 * Load party data from vault storage
 */
export async function loadPartyData(): Promise<void> {
    const store = getPartyStore();
    await store.load();
}

/**
 * Save party data to vault storage
 */
export async function savePartyData(): Promise<void> {
    const store = getPartyStore();
    await store.save();
}

// ============================================================================
// Party Member CRUD Operations
// ============================================================================

/**
 * Clone party member for immutability
 */
function clonePartyMember(member: PartyMember): PartyMember {
    return { ...member };
}

/**
 * Update party state with mutator function
 */
function updatePartyState(mutator: (draft: PartyStateDraft) => void): PartyState {
    const store = getPartyStore();
    const current = store.get();

    // Create mutable draft
    const draft: PartyStateDraft = {
        members: current.members.map(clonePartyMember),
    };

    // Apply mutation
    mutator(draft);

    // Create immutable result
    const next: PartyState = {
        members: Object.freeze(draft.members.map(clonePartyMember)),
    };

    // Update store
    store.set(next);

    return next;
}

/**
 * Add new party member
 */
export function addPartyMember(member: PartyMember): PartyState {
    logger.info(`Adding party member: ${member.name} (L${member.level})`);

    return updatePartyState((draft) => {
        // Check for duplicate ID
        if (draft.members.some((m) => m.id === member.id)) {
            logger.warn(`Member with ID ${member.id} already exists, skipping add`);
            return;
        }

        draft.members.push(clonePartyMember(member));
    });
}

/**
 * Update existing party member with partial patch
 */
export function updatePartyMember(id: string, patch: Partial<PartyMember>): PartyState {
    logger.info(`Updating party member: ${id}`, patch);

    return updatePartyState((draft) => {
        const index = draft.members.findIndex((member) => member.id === id);

        if (index === -1) {
            logger.warn(`Member with ID ${id} not found, skipping update`);
            return;
        }

        draft.members[index] = { ...draft.members[index], ...patch };
    });
}

/**
 * Remove party member by ID
 */
export function removePartyMember(id: string): PartyState {
    logger.info(`Removing party member: ${id}`);

    return updatePartyState((draft) => {
        const initialLength = draft.members.length;
        draft.members = draft.members.filter((member) => member.id !== id);

        if (draft.members.length === initialLength) {
            logger.warn(`Member with ID ${id} not found, no removal performed`);
        }
    });
}

/**
 * Replace entire party roster (e.g., for bulk import)
 */
export function replacePartyRoster(members: PartyMember[]): PartyState {
    logger.info(`Replacing party roster with ${members.length} members`);

    const store = getPartyStore();
    const next: PartyState = {
        members: Object.freeze(members.map(clonePartyMember)),
    };

    store.set(next);
    return next;
}

/**
 * Get current party state (synchronous)
 */
export function getPartyState(): PartyState {
    const store = getPartyStore();
    return store.get();
}

/**
 * Subscribe to party state changes
 * Returns unsubscribe function
 */
export function subscribePartyState(listener: (state: PartyState) => void): () => void {
    const store = getPartyStore();
    return store.subscribe(listener);
}

/**
 * Clear all party members (useful for testing or full reset)
 */
export function clearPartyRoster(): PartyState {
    logger.info("Clearing party roster");

    const store = getPartyStore();
    const next: PartyState = {
        members: Object.freeze([]),
    };

    store.set(next);
    return next;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate average party level (rounded down)
 * Returns 1 if party is empty
 */
export function getAveragePartyLevel(state?: PartyState): number {
    const members = state ? state.members : getPartyState().members;

    if (members.length === 0) {
        return 1;
    }

    const sum = members.reduce((total, member) => total + member.level, 0);
    return Math.floor(sum / members.length);
}

/**
 * Get party size (member count)
 */
export function getPartySize(state?: PartyState): number {
    const members = state ? state.members : getPartyState().members;
    return members.length;
}

/**
 * Find party member by ID
 */
export function findPartyMember(id: string, state?: PartyState): PartyMember | undefined {
    const members = state ? state.members : getPartyState().members;
    return members.find((member) => member.id === id);
}

/**
 * Find party member by name (case-insensitive)
 */
export function findPartyMemberByName(name: string, state?: PartyState): PartyMember | undefined {
    const members = state ? state.members : getPartyState().members;
    const lowerName = name.toLowerCase();
    return members.find((member) => member.name.toLowerCase() === lowerName);
}

/**
 * Look up Character from library for a party member (if characterId is set)
 * Returns null if party member has no characterId or character not found
 */
export function getPartyMemberCharacter(memberId: string): Promise<Character | null> {
    // Lazy import to avoid circular dependency
    return import("./character-store").then(async ({ getCharacterById }) => {
        const member = findPartyMember(memberId);
        if (!member?.characterId) {
            return null;
        }
        return getCharacterById(member.characterId);
    });
}

/**
 * Dispose of party store resources
 * Clears pending auto-save timeouts and optionally saves dirty data
 * Should be called during plugin unload
 */
export async function disposePartyStore(forceSave: boolean = true): Promise<void> {
    if (!partyStore) {
        logger.warn("Not initialized, nothing to dispose");
        return;
    }

    logger.info("Disposing...");
    await partyStore.dispose(forceSave);
    partyStore = null;
    logger.info("Disposed");
}

/**
 * Test utility to reset store state (for vitest)
 */
export function __resetPartyStore(): void {
    if (partyStore) {
        partyStore.set({
            members: Object.freeze([]),
        });
    }
}
