// src/apps/cartographer/mode-registry/index.ts
// Stellt zentrale Mode-Registry-APIs bereit.
import {
    clearCartographerModeRegistry,
    createCartographerModeRegistrySnapshot,
    createCartographerModesSnapshot,
    getCartographerModeMetadataSnapshot,
    registerCartographerModeProvider,
    unregisterCartographerModeProvider,
    subscribeToCartographerModeRegistry,
    type CartographerModeRegistryEvent,
    type CartographerModeRegistryEntry,
    type CartographerModeMetadata,
    type CartographerModeProvider,
} from "./registry";
import { createEditorModeProvider } from "./providers/editor";
import { createInspectorModeProvider } from "./providers/inspector";
import { createTravelGuideModeProvider } from "./providers/travel-guide";
import type { CartographerMode } from "../presenter";

let coreProvidersRegistered = false;

const ensureCoreProviders = (): void => {
    if (coreProvidersRegistered) return;
    registerCartographerModeProvider(createTravelGuideModeProvider());
    registerCartographerModeProvider(createEditorModeProvider());
    registerCartographerModeProvider(createInspectorModeProvider());
    coreProvidersRegistered = true;
};

export const provideCartographerModes = (): CartographerMode[] => {
    ensureCoreProviders();
    return createCartographerModesSnapshot();
};

export const provideCartographerModeEntries = (): readonly CartographerModeRegistryEntry[] => {
    ensureCoreProviders();
    return createCartographerModeRegistrySnapshot();
};

export const listCartographerModeMetadata = (): readonly CartographerModeMetadata[] => {
    ensureCoreProviders();
    return getCartographerModeMetadataSnapshot();
};

export const registerModeProvider = (provider: CartographerModeProvider): (() => void) => {
    return registerCartographerModeProvider(provider);
};

export const unregisterModeProvider = (id: string): boolean => {
    return unregisterCartographerModeProvider(id);
};

export const subscribeToModeRegistry = (
    listener: (event: CartographerModeRegistryEvent) => void,
): (() => void) => {
    ensureCoreProviders();
    return subscribeToCartographerModeRegistry(listener);
};

export const resetCartographerModeRegistry = (options?: { registerCoreProviders?: boolean }): void => {
    clearCartographerModeRegistry();
    coreProvidersRegistered = false;
    if (options?.registerCoreProviders ?? true) {
        ensureCoreProviders();
    }
};

export {
    createCartographerModeRegistrySnapshot,
    createCartographerModesSnapshot,
    getCartographerModeMetadataSnapshot,
};

export type {
    CartographerModeMetadata,
    CartographerModeProvider,
    CartographerModeRegistryEvent,
    CartographerModeRegistryEntry,
} from "./registry";

export type {
    CartographerModeCapabilities,
    CartographerModeMapInteraction,
    CartographerModePersistence,
    CartographerModeSidebarUsage,
    CartographerModeWithCapabilities,
    NormalizedCartographerModeMetadata,
} from "./registry";

export { defineCartographerModeProvider } from "./registry";
