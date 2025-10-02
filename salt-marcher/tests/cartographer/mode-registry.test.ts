// salt-marcher/tests/cartographer/mode-registry.test.ts
// Prüft Registrierung, Snapshot und Events der Cartographer-Mode-Registry.
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CartographerMode, CartographerModeContext } from "../../src/apps/cartographer/presenter";
import {
    registerModeProvider,
    unregisterModeProvider,
    resetCartographerModeRegistry,
    createCartographerModesSnapshot,
    getCartographerModeMetadataSnapshot,
    subscribeToModeRegistry,
    type CartographerModeRegistryEvent,
    type CartographerModeProvider,
} from "../../src/apps/cartographer/mode-registry";

const createStubContext = (): CartographerModeContext => ({
    app: {} as any,
    host: {} as HTMLElement,
    mapHost: {} as HTMLElement,
    sidebarHost: {} as HTMLElement,
    getFile: () => null,
    getMapLayer: () => null,
    getRenderHandles: () => null,
    getOptions: () => null,
});

describe("cartographer mode registry", () => {
    beforeEach(() => {
        resetCartographerModeRegistry({ registerCoreProviders: false });
    });

    it("loads registered providers lazily", async () => {
        const load = vi.fn(async () => ({
            id: "test-mode",
            label: "Test",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
            onHexClick: vi.fn(),
        }) satisfies CartographerMode);

        const provider: CartographerModeProvider = {
            metadata: {
                id: "test-mode",
                label: "Test",
                summary: "Test provider",
                keywords: ["test"],
                order: 10,
                source: "tests/mode",
                capabilities: {
                    mapInteraction: "hex-click",
                    persistence: "read-only",
                    sidebar: "required",
                },
            },
            load,
        };

        registerModeProvider(provider);

        const snapshot = createCartographerModesSnapshot();
        expect(snapshot).toHaveLength(1);
        const mode = snapshot[0];
        expect(mode.id).toBe("test-mode");
        expect(load).not.toHaveBeenCalled();

        const ctx = createStubContext();
        await mode.onEnter(ctx);
        expect(load).toHaveBeenCalledTimes(1);
        await mode.onFileChange(null, null, ctx);
        await mode.onExit();
    });

    it("rejects duplicate registrations", () => {
        const provider: CartographerModeProvider = {
            metadata: {
                id: "dup",
                label: "Dup",
                summary: "first",
                source: "tests/dup",
                capabilities: {
                    mapInteraction: "none",
                    persistence: "read-only",
                    sidebar: "required",
                },
            },
            async load() {
                return {
                    id: "dup",
                    label: "Dup",
                    onEnter: vi.fn(),
                    onExit: vi.fn(),
                    onFileChange: vi.fn(),
                } satisfies CartographerMode;
            },
        };

        registerModeProvider(provider);

        expect(() => registerModeProvider(provider)).toThrow(/already registered/i);
    });

    it("reflects registry updates in metadata and mode snapshots", () => {
        const providerA: CartographerModeProvider = {
            metadata: {
                id: "a",
                label: "A",
                summary: "first",
                order: 2,
                source: "tests/a",
                capabilities: {
                    mapInteraction: "hex-click",
                    persistence: "read-only",
                    sidebar: "required",
                },
            },
            async load() {
                return {
                    id: "a",
                    label: "A",
                    onEnter: vi.fn(),
                    onExit: vi.fn(),
                    onFileChange: vi.fn(),
                } satisfies CartographerMode;
            },
        };

        const providerB: CartographerModeProvider = {
            metadata: {
                id: "b",
                label: "B",
                summary: "second",
                order: 1,
                source: "tests/b",
                capabilities: {
                    mapInteraction: "hex-click",
                    persistence: "read-only",
                    sidebar: "required",
                },
            },
            async load() {
                return {
                    id: "b",
                    label: "B",
                    onEnter: vi.fn(),
                    onExit: vi.fn(),
                    onFileChange: vi.fn(),
                } satisfies CartographerMode;
            },
        };

        const disposeA = registerModeProvider(providerA);
        registerModeProvider(providerB);

        let metadata = getCartographerModeMetadataSnapshot();
        expect(metadata.map((m) => m.id)).toEqual(["b", "a"]);

        disposeA();
        unregisterModeProvider("b");

        metadata = getCartographerModeMetadataSnapshot();
        expect(metadata).toHaveLength(0);

        const snapshot = createCartographerModesSnapshot();
        expect(snapshot).toHaveLength(0);
    });

    it("notifies subscribers about registration lifecycle", async () => {
        const events: CartographerModeRegistryEvent[] = [];
        const unsubscribe = subscribeToModeRegistry((event) => {
            events.push(event);
        });

        expect(events[0]?.type).toBe("initial");
        expect(events[0]?.entries.map((entry) => entry.metadata.id)).toEqual([
            "travel",
            "editor",
            "inspector",
        ]);

        const provider: CartographerModeProvider = {
            metadata: {
                id: "dynamic",
                label: "Dynamic",
                summary: "dynamic provider",
                source: "tests/dynamic",
                capabilities: {
                    mapInteraction: "hex-click",
                    persistence: "read-only",
                    sidebar: "required",
                },
            },
            async load() {
                return {
                    id: "dynamic",
                    label: "Dynamic",
                    onEnter: vi.fn(),
                    onExit: vi.fn(),
                    onFileChange: vi.fn(),
                } satisfies CartographerMode;
            },
        };

        const dispose = registerModeProvider(provider);

        const registeredEvent = events.find((event) => event.type === "registered");
        expect(registeredEvent?.entry.metadata.id).toBe("dynamic");
        expect(registeredEvent?.entries.some((entry) => entry.metadata.id === "dynamic")).toBe(true);

        dispose();

        const deregisteredEvent = events.find((event) => event.type === "deregistered");
        expect(deregisteredEvent?.id).toBe("dynamic");
        expect(deregisteredEvent?.entries.map((entry) => entry.metadata.id)).toEqual([
            "travel",
            "editor",
            "inspector",
        ]);

        unsubscribe();
    });

    it("validates capability contracts when loading modes", async () => {
        const provider: CartographerModeProvider = {
            metadata: {
                id: "broken",
                label: "Broken",
                summary: "missing save handler",
                source: "tests/broken",
                capabilities: {
                    mapInteraction: "none",
                    persistence: "manual-save",
                    sidebar: "required",
                },
            },
            async load() {
                return {
                    id: "broken",
                    label: "Broken",
                    onEnter: vi.fn(),
                    onExit: vi.fn(),
                    onFileChange: vi.fn(),
                } satisfies CartographerMode;
            },
        };

        registerModeProvider(provider);

        const [mode] = createCartographerModesSnapshot();
        expect(mode.id).toBe("broken");

        await expect(mode.onEnter(createStubContext())).rejects.toThrow(/manual-save/i);
    });
});
