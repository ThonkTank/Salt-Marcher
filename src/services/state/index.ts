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
