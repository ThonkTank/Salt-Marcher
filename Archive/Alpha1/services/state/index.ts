// src/services/state/index.ts
// Central exports for state management system

export {
    // Interfaces
    type ReadableStore,
    type WritableStore,
    type PersistentStore,
    type VersionedStore,
    type Subscriber,
    type Unsubscriber,
    type Updater,
    type StoreOptions,
    type StoreFactory,
    type StoreManager,
    type StoreMetadata,
    type StoreEvent,
    type StoreEventPayload,
    StoreEvent,
} from "./store.interface";

export {
    // Writable store implementation
    writable,
    derived,
} from "./writable-store";

export {
    // Persistent store implementation
    persistent,
    versionedPersistent,
    type PersistentStoreOptions,
} from "./persistent-store";

export {
    // Adapters
    createJsonStorePersistentAdapter,
    type JsonStoreLike,
    type JsonStorePersistentAdapterOptions,
} from "./adapters/json-store-adapter";

export {
    // Party store (shared across workmodes)
    type PartyMember,
    type PartyState,
    initializePartyStore,
    getPartyStore,
    loadPartyData,
    savePartyData,
    addPartyMember,
    updatePartyMember,
    removePartyMember,
    replacePartyRoster,
    getPartyState,
    subscribePartyState,
    clearPartyRoster,
    getAveragePartyLevel,
    getPartySize,
    findPartyMember,
    findPartyMemberByName,
    getPartyMemberCharacter,
} from "./party-store";

export {
    // Character store (shared across workmodes)
    type CharacterState,
    initializeCharacterStore,
    getCharacterStore,
    loadCharacterData,
    saveCharacterData,
    addCharacter,
    updateCharacter,
    removeCharacter,
    getCharacterById,
    getAllCharacters,
    getCharactersByClass,
    getCharactersByLevel,
    subscribeCharacterState,
    clearAllCharacters,
} from "./character-store";
