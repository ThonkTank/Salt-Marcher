// src/services/state/character-store.ts
// Shared character store providing reactive state for characters
// Used by Library, Encounter Calculator, and Session Runner workmodes

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('state-character-store');
import { persistent } from "./persistent-store";
import type { PersistentStore } from "./store.interface";
import type { Character } from "@services/domain";

/**
 * Character state for reactive updates
 */
export interface CharacterState {
    readonly characters: ReadonlyArray<Character>;
}

/**
 * Mutable draft for character state updates
 */
interface CharacterStateDraft {
    characters: Character[];
}

// Store instance and app reference
let characterStore: PersistentStore<CharacterState> | null = null;
let appInstance: App | null = null;

/**
 * Initialize character store with Obsidian app context
 * Must be called during plugin load
 */
export function initializeCharacterStore(app: App): PersistentStore<CharacterState> {
    if (characterStore) {
        logger.warn("Already initialized, returning existing instance");
        return characterStore;
    }

    // Store app instance for later use
    appInstance = app;

    const initialState: CharacterState = {
        characters: [],
    };

    characterStore = persistent(initialState, {
        app,
        filePath: ".obsidian/plugins/salt-marcher/data/characters.json",
        version: 1,
        name: "characters",
        autoSave: true,
        autoSaveDelay: 500,
    });

    logger.info("Initialized");
    return characterStore;
}

/**
 * Get character store instance (must call initializeCharacterStore first)
 */
export function getCharacterStore(): PersistentStore<CharacterState> {
    if (!characterStore) {
        throw new Error(
            "Not initialized. Call initializeCharacterStore() during plugin load."
        );
    }
    return characterStore;
}

/**
 * Load character data from vault storage.
 * First loads persistent JSON store, then syncs with vault character presets.
 */
export async function loadCharacterData(): Promise<void> {
    const store = getCharacterStore();

    if (!appInstance) {
        logger.error("App instance not available - store not initialized");
        return;
    }

    // Load persisted state from JSON
    await store.load();

    // Now sync with vault character presets
    try {
        const { CharacterRepository } = await import("../../features/characters/character-repository");
        const repo = new CharacterRepository();
        const vaultCharacters = await repo.loadAllCharacters(appInstance);

        logger.info(`Loaded ${vaultCharacters.length} characters from vault presets`);

        // Merge vault characters into store (vault is source of truth for presets)
        if (vaultCharacters.length > 0) {
            updateCharacterState((draft) => {
                // Clear existing characters that came from vault presets
                draft.characters = [];

                // Add all vault characters
                for (const char of vaultCharacters) {
                    draft.characters.push({
                        id: char.id,
                        name: char.name,
                        level: char.level,
                        characterClass: char.characterClass,
                        maxHp: char.maxHp,
                        ac: char.ac,
                        notes: char.notes || "",
                    });
                }
            });

            logger.info(`Populated store with ${vaultCharacters.length} characters`);
        }
    } catch (error) {
        logger.error("Failed to load vault characters:", error);
    }
}

/**
 * Save character data to vault storage
 */
export async function saveCharacterData(): Promise<void> {
    const store = getCharacterStore();
    await store.save();
}

// ============================================================================
// Character CRUD Operations
// ============================================================================

/**
 * Clone character for immutability
 */
function cloneCharacter(character: Character): Character {
    return { ...character };
}

/**
 * Update character state with mutator function
 */
function updateCharacterState(mutator: (draft: CharacterStateDraft) => void): CharacterState {
    const store = getCharacterStore();
    const current = store.get();

    // Create mutable draft
    const draft: CharacterStateDraft = {
        characters: current.characters.map(cloneCharacter),
    };

    // Apply mutation
    mutator(draft);

    // Create immutable result
    const next: CharacterState = {
        characters: Object.freeze(draft.characters.map(cloneCharacter)),
    };

    // Update store
    store.set(next);

    return next;
}

/**
 * Add new character
 */
export function addCharacter(character: Character): CharacterState {
    logger.info(`Adding character: ${character.name} (${character.characterClass} L${character.level})`);

    return updateCharacterState((draft) => {
        // Check for duplicate ID
        if (draft.characters.some((c) => c.id === character.id)) {
            logger.warn(`Character with ID ${character.id} already exists, skipping add`);
            return;
        }

        draft.characters.push(cloneCharacter(character));
    });
}

/**
 * Update existing character with partial patch
 */
export function updateCharacter(id: string, patch: Partial<Character>): CharacterState {
    logger.info(`Updating character: ${id}`);

    return updateCharacterState((draft) => {
        const index = draft.characters.findIndex((c) => c.id === id);
        if (index === -1) {
            logger.warn(`Character ${id} not found for update`);
            return;
        }

        draft.characters[index] = {
            ...draft.characters[index],
            ...patch,
        };
    });
}

/**
 * Remove character by ID
 */
export function removeCharacter(id: string): CharacterState {
    logger.info(`Removing character: ${id}`);

    return updateCharacterState((draft) => {
        const index = draft.characters.findIndex((c) => c.id === id);
        if (index === -1) {
            logger.warn(`Character ${id} not found for removal`);
            return;
        }

        draft.characters.splice(index, 1);
    });
}

/**
 * Get character by ID
 */
export function getCharacterById(id: string): Character | null {
    const store = getCharacterStore();
    const state = store.get();
    return state.characters.find((c) => c.id === id) || null;
}

/**
 * Get all characters
 */
export function getAllCharacters(): ReadonlyArray<Character> {
    const store = getCharacterStore();
    return store.get().characters;
}

/**
 * Get characters by class
 */
export function getCharactersByClass(characterClass: string): ReadonlyArray<Character> {
    const store = getCharacterStore();
    const state = store.get();
    return state.characters.filter((c) => c.characterClass === characterClass);
}

/**
 * Get characters by level range
 */
export function getCharactersByLevel(minLevel: number, maxLevel: number): ReadonlyArray<Character> {
    const store = getCharacterStore();
    const state = store.get();
    return state.characters.filter((c) => c.level >= minLevel && c.level <= maxLevel);
}

/**
 * Subscribe to character state changes
 */
export function subscribeCharacterState(callback: (state: CharacterState) => void): () => void {
    const store = getCharacterStore();
    return store.subscribe(callback);
}

/**
 * Clear all characters (useful for testing/reset)
 */
export function clearAllCharacters(): CharacterState {
    logger.info("Clearing all characters");

    return updateCharacterState((draft) => {
        draft.characters = [];
    });
}

/**
 * Dispose of character store resources
 * Clears pending auto-save timeouts and optionally saves dirty data
 * Should be called during plugin unload
 */
export async function disposeCharacterStore(forceSave: boolean = true): Promise<void> {
    if (!characterStore) {
        logger.warn("Not initialized, nothing to dispose");
        return;
    }

    logger.info("Disposing...");
    await characterStore.dispose(forceSave);
    characterStore = null;
    appInstance = null;
    logger.info("Disposed");
}
