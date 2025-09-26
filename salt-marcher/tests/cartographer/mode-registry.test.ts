import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CartographerMode, CartographerModeContext } from "../../src/apps/cartographer/presenter";
import {
    registerModeProvider,
    unregisterModeProvider,
    resetCartographerModeRegistry,
    createCartographerModesSnapshot,
    getCartographerModeMetadataSnapshot,
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
        }) satisfies CartographerMode);

        const provider: CartographerModeProvider = {
            metadata: {
                id: "test-mode",
                label: "Test",
                summary: "Test provider",
                keywords: ["test"],
                order: 10,
                source: "tests/mode",
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
});
