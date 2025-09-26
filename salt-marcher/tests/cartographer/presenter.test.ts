import { describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import {
    CartographerPresenter,
    type CartographerMode,
    type CartographerModeContext,
    type CartographerModeLifecycleContext,
    type HexCoord,
} from "../../src/apps/cartographer/presenter";
import type {
    CartographerShellHandle,
    CartographerShellOptions,
    ModeSelectContext,
} from "../../src/apps/cartographer/view-shell";
import type { MapManagerHandle } from "../../src/ui/map-manager";
import type { HexOptions } from "../../src/core/options";
import type { RenderHandles } from "../../src/core/hex-mapper/hex-render";
import type { MapLayer } from "../../src/apps/cartographer/travel/ui/map-layer";
import type { MapHeaderSaveMode } from "../../src/ui/map-header";
import type {
    CartographerModeRegistryEntry,
    CartographerModeRegistryEvent,
} from "../../src/apps/cartographer/mode-registry";

const createRegistryEntry = (mode: CartographerMode): CartographerModeRegistryEntry => ({
    metadata: {
        id: mode.id,
        label: mode.label,
        summary: `${mode.label} summary`,
        source: "tests/presenter",
        capabilities: {
            mapInteraction: typeof mode.onHexClick === "function" ? "hex-click" : "none",
            persistence: typeof mode.onSave === "function" ? "manual-save" : "read-only",
            sidebar: "required",
        },
    },
    mode,
});

const createRegistryController = (initialEvents: CartographerModeRegistryEvent[] = []) => {
    let listener: ((event: CartographerModeRegistryEvent) => void) | null = null;
    const subscribe = vi.fn((handler: (event: CartographerModeRegistryEvent) => void) => {
        listener = handler;
        for (const event of initialEvents) {
            handler(event);
        }
        return () => {
            if (listener === handler) {
                listener = null;
            }
        };
    });
    const emit = (event: CartographerModeRegistryEvent) => {
        listener?.(event);
    };
    return { subscribe, emit };
};

function createShellStub() {
    const host = document.createElement("div");
    const mapHost = document.createElement("div");
    const sidebarHost = document.createElement("div");
    const setFileLabel = vi.fn();
    const setModeActive = vi.fn();
    const setModeLabel = vi.fn();
    const setModes = vi.fn();
    const registerMode = vi.fn();
    const deregisterMode = vi.fn();
    const setOverlay = vi.fn();
    const clearMap = vi.fn();
    const destroy = vi.fn();

    let capturedOptions: CartographerShellOptions | null = null;

    const handle: CartographerShellHandle = {
        host,
        mapHost,
        sidebarHost,
        setFileLabel,
        setModeActive,
        setModeLabel,
        setModes,
        registerMode,
        deregisterMode,
        setOverlay,
        clearMap,
        destroy,
    };

    const factory = (options: CartographerShellOptions): CartographerShellHandle => {
        capturedOptions = options;
        return handle;
    };

    const getCallbacks = () => {
        if (!capturedOptions) throw new Error("shell not initialised");
        return capturedOptions.callbacks;
    };

    const getModes = () => {
        if (!capturedOptions) throw new Error("shell not initialised");
        return capturedOptions.modes;
    };

    return {
        host,
        mapHost,
        sidebarHost,
        factory,
        handle,
        getCallbacks,
        getModes,
        setFileLabel,
        setModeActive,
        setModeLabel,
        setModes,
        registerMode,
        deregisterMode,
        setOverlay,
        clearMap,
        destroy,
    };
}

type MapManagerOptions = {
    initialFile?: TFile | null;
    onChange?: (file: TFile | null) => void | Promise<void>;
};

function createStubMapManager(options: MapManagerOptions = {}): MapManagerHandle {
    let current: TFile | null = options.initialFile ?? null;
    const apply = async (file: TFile | null) => {
        current = file;
        await options.onChange?.(file);
    };
    return {
        getFile: () => current,
        setFile: async (file) => {
            await apply(file ?? null);
        },
        open: vi.fn(),
        create: vi.fn(),
        deleteCurrent: () => {
            void apply(null);
        },
    };
}

const createMapManagerFactory = () =>
    (_app: App, opts?: MapManagerOptions): MapManagerHandle => createStubMapManager(opts ?? {});

const appStub = { workspace: {} } as unknown as App;

type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
};

const createDeferred = <T>(): Deferred<T> => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

describe("CartographerPresenter", () => {
    it("switches modes and performs lifecycle hooks", async () => {
        const shell = createShellStub();
        const events: string[] = [];

        const modeA: CartographerMode = {
            id: "a",
            label: "Mode A",
            onEnter: (_ctx) => {
                events.push("A:enter");
            },
            onExit: (_ctx) => {
                events.push("A:exit");
            },
            onFileChange: (file) => {
                events.push(`A:file:${file ? file.path : "null"}`);
            },
        };

        const modeB: CartographerMode = {
            id: "b",
            label: "Mode B",
            onEnter: (_ctx) => {
                events.push("B:enter");
            },
            onExit: (_ctx) => {
                events.push("B:exit");
            },
            onFileChange: (file) => {
                events.push(`B:file:${file ? file.path : "null"}`);
            },
        };

        const registry = createRegistryController();

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: vi.fn(async () => {
                throw new Error("layer should not be created in this scenario");
            }),
            loadHexOptions: vi.fn(async () => null as HexOptions | null),
            provideModes: () => [createRegistryEntry(modeA), createRegistryEntry(modeB)],
            subscribeToModeRegistry: registry.subscribe,
        });

        registry.emit({ type: "initial", entries: [createRegistryEntry(modeA), createRegistryEntry(modeB)] });

        await presenter.onOpen(shell.host, null);
        events.length = 0;

        await presenter.setMode("b");

        expect(events).toEqual(["A:exit", "B:enter", "B:file:null"]);
        expect(shell.setModeActive).toHaveBeenLastCalledWith("b");
        expect(shell.setModeLabel).toHaveBeenLastCalledWith("Mode B");
    });

    it("continues switching when onExit fails", async () => {
        const shell = createShellStub();
        const exitError = new Error("boom");

        const modeA: CartographerMode = {
            id: "a",
            label: "Mode A",
            onEnter: vi.fn(),
            onExit: vi.fn((_ctx) => {
                throw exitError;
            }),
            onFileChange: vi.fn(),
        };

        const modeBEnter = vi.fn();
        const modeBFileChange = vi.fn();
        const modeB: CartographerMode = {
            id: "b",
            label: "Mode B",
            onEnter: modeBEnter,
            onExit: vi.fn(),
            onFileChange: modeBFileChange,
        };

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

        const registry = createRegistryController();

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: vi.fn(async () => {
                throw new Error("layer should not be created in this scenario");
            }),
            loadHexOptions: vi.fn(async () => null as HexOptions | null),
            provideModes: () => [createRegistryEntry(modeA), createRegistryEntry(modeB)],
            subscribeToModeRegistry: registry.subscribe,
        });

        registry.emit({ type: "initial", entries: [createRegistryEntry(modeA), createRegistryEntry(modeB)] });

        await presenter.onOpen(shell.host, null);
        consoleError.mockClear();

        await presenter.setMode("b");

        expect(modeBEnter).toHaveBeenCalledTimes(1);
        expect(modeBFileChange).toHaveBeenCalledTimes(1);
        expect(
            consoleError.mock.calls.some(
                ([message, err]) =>
                    message === "[cartographer] mode exit failed" && err === exitError,
            ),
        ).toBe(true);

        consoleError.mockRestore();
    });

    it("logs enter failures but still notifies file change", async () => {
        const shell = createShellStub();
        const enterError = new Error("enter failed");

        const modeA: CartographerMode = {
            id: "a",
            label: "Mode A",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
        };

        const modeBFileChange = vi.fn();
        const modeB: CartographerMode = {
            id: "b",
            label: "Mode B",
            onEnter: vi.fn((_ctx) => {
                throw enterError;
            }),
            onExit: vi.fn(),
            onFileChange: modeBFileChange,
        };

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

        const registry = createRegistryController();

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: vi.fn(async () => {
                throw new Error("layer should not be created in this scenario");
            }),
            loadHexOptions: vi.fn(async () => null as HexOptions | null),
            provideModes: () => [createRegistryEntry(modeA), createRegistryEntry(modeB)],
            subscribeToModeRegistry: registry.subscribe,
        });

        registry.emit({ type: "initial", entries: [createRegistryEntry(modeA), createRegistryEntry(modeB)] });

        await presenter.onOpen(shell.host, null);
        consoleError.mockClear();

        await presenter.setMode("b");

        expect(modeBFileChange).toHaveBeenCalledTimes(1);
        expect(
            consoleError.mock.calls.some(
                ([message, err]) =>
                    message === "[cartographer] mode enter failed" && err === enterError,
            ),
        ).toBe(true);

        consoleError.mockRestore();
    });

    it("skips lifecycle when switch is cancelled before execution", async () => {
        const shell = createShellStub();

        const modeA: CartographerMode = {
            id: "a",
            label: "Mode A",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
        };

        const modeB: CartographerMode = {
            id: "b",
            label: "Mode B",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
        };

        const registry = createRegistryController();

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: vi.fn(async () => {
                throw new Error("layer should not be created in this scenario");
            }),
            loadHexOptions: vi.fn(async () => null as HexOptions | null),
            provideModes: () => [createRegistryEntry(modeA), createRegistryEntry(modeB)],
            subscribeToModeRegistry: registry.subscribe,
        });

        registry.emit({ type: "initial", entries: [createRegistryEntry(modeA), createRegistryEntry(modeB)] });

        await presenter.onOpen(shell.host, null);

        const controller = new AbortController();
        controller.abort();
        const context: ModeSelectContext = { signal: controller.signal };

        await presenter.setMode("b", context);

        expect(modeA.onExit).not.toHaveBeenCalled();
        expect(modeB.onEnter).not.toHaveBeenCalled();
        expect(shell.setModeActive).not.toHaveBeenLastCalledWith("b");
        expect(shell.setModeLabel).not.toHaveBeenLastCalledWith("Mode B");
    });

    it("loads map data when file changes and notifies active mode", async () => {
        const shell = createShellStub();
        const file: TFile = { path: "Maps/alpha.md", basename: "alpha" } as TFile;
        const handles = { marker: "handles" } as unknown as RenderHandles;
        const mapLayer: MapLayer = {
            handles,
            polyToCoord: new WeakMap(),
            ensurePolys: vi.fn(),
            centerOf: vi.fn(),
            destroy: vi.fn(),
        };

        const mode: CartographerMode = {
            id: "main",
            label: "Main",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
        };

        const loadHexOptions = vi.fn(async () => ({ hexSize: 1 } as unknown as HexOptions));
        const createLayer = vi.fn(async () => mapLayer);

        const registry = createRegistryController();

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: createLayer,
            loadHexOptions,
            provideModes: () => [createRegistryEntry(mode)],
            subscribeToModeRegistry: registry.subscribe,
        });

        registry.emit({ type: "initial", entries: [createRegistryEntry(mode)] });

        await presenter.onOpen(shell.host, file);

        expect(loadHexOptions).toHaveBeenCalledWith(appStub, file);
        expect(createLayer).toHaveBeenCalled();

        const calls = (mode.onFileChange as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const [receivedFile, receivedHandles, ctx] = calls[calls.length - 1] as [
            TFile | null,
            RenderHandles | null,
            CartographerModeLifecycleContext,
        ];
        expect(receivedFile).toBe(file);
        expect(receivedHandles).toBe(handles);
        expect(typeof ctx.getOptions).toBe("function");
        expect(ctx.signal.aborted).toBe(false);
        expect(shell.setOverlay).toHaveBeenLastCalledWith(null);
    });

    it("skips mode save handler when persistence capability is read-only", async () => {
        const shell = createShellStub();

        const saveHandler = vi.fn(async () => true);
        const mode: CartographerMode = {
            id: "main",
            label: "Main",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
            onSave: saveHandler,
        };

        const entry = createRegistryEntry(mode);
        entry.metadata = {
            ...entry.metadata,
            capabilities: {
                ...entry.metadata.capabilities,
                persistence: "read-only",
            },
        };

        const registry = createRegistryController();

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: vi.fn(async () => {
                throw new Error("layer should not be created in this scenario");
            }),
            loadHexOptions: vi.fn(async () => null as HexOptions | null),
            provideModes: () => [entry],
            subscribeToModeRegistry: registry.subscribe,
        });

        registry.emit({ type: "initial", entries: [entry] });

        await presenter.onOpen(shell.host, null);

        const callbacks = shell.getCallbacks();
        const result = await callbacks.onSave("manual" as MapHeaderSaveMode, null);

        expect(result).toBe(false);
        expect(saveHandler).not.toHaveBeenCalled();
    });

    it("ignores hex click when capability disables map interaction", async () => {
        const shell = createShellStub();

        const hexClick = vi.fn();
        const mode: CartographerMode = {
            id: "main",
            label: "Main",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
            onHexClick: hexClick,
        };

        const entry = createRegistryEntry(mode);
        entry.metadata = {
            ...entry.metadata,
            capabilities: {
                ...entry.metadata.capabilities,
                mapInteraction: "none",
            },
        };

        const registry = createRegistryController();

        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: vi.fn(async () => {
                throw new Error("layer should not be created in this scenario");
            }),
            loadHexOptions: vi.fn(async () => null as HexOptions | null),
            provideModes: () => [entry],
            subscribeToModeRegistry: registry.subscribe,
        });

        registry.emit({ type: "initial", entries: [entry] });

        await presenter.onOpen(shell.host, null);

        const callbacks = shell.getCallbacks();
        const coord: HexCoord = { r: 2, c: 3 };
        const event = new CustomEvent("hex:click", { detail: coord, cancelable: true }) as CustomEvent<HexCoord>;
        await callbacks.onHexClick(coord, event);

        expect(hexClick).not.toHaveBeenCalled();

        warn.mockRestore();
    });

    it("destroys pending map layer when aborted switch completes", async () => {
        const shell = createShellStub();
        const file: TFile = { path: "Maps/beta.md", basename: "beta" } as TFile;
        const initialLayer: MapLayer = {
            handles: { initial: true } as unknown as RenderHandles,
            polyToCoord: new WeakMap(),
            ensurePolys: vi.fn(),
            centerOf: vi.fn(),
            destroy: vi.fn(),
        };
        const pendingLayer: MapLayer = {
            handles: { pending: true } as unknown as RenderHandles,
            polyToCoord: new WeakMap(),
            ensurePolys: vi.fn(),
            centerOf: vi.fn(),
            destroy: vi.fn(),
        };

        let deferredLayer: Deferred<MapLayer> | null = null;
        const createLayer = vi.fn(async () => {
            if (deferredLayer) {
                const { promise } = deferredLayer;
                deferredLayer = null;
                return await promise;
            }
            return initialLayer;
        });

        const loadHexOptions = vi.fn(async () => ({ hexSize: 1 } as unknown as HexOptions));

        const modeA: CartographerMode = {
            id: "a",
            label: "Mode A",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
        };

        const enterDeferred = createDeferred<void>();
        const modeBOnFileChange = vi.fn();

        const modeB: CartographerMode = {
            id: "b",
            label: "Mode B",
            onEnter: vi.fn((_ctx) => enterDeferred.promise),
            onExit: vi.fn(),
            onFileChange: modeBOnFileChange,
        };

        const registry = createRegistryController();

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: createLayer,
            loadHexOptions,
            provideModes: () => [createRegistryEntry(modeA), createRegistryEntry(modeB)],
            subscribeToModeRegistry: registry.subscribe,
        });

        registry.emit({ type: "initial", entries: [createRegistryEntry(modeA), createRegistryEntry(modeB)] });

        await presenter.onOpen(shell.host, null);

        await presenter.setFile(file);
        expect(createLayer).toHaveBeenCalledTimes(1);

        const controller = new AbortController();
        const switchPromise = presenter.setMode("b", { signal: controller.signal });

        // trigger a fresh render while the switch is in flight
        deferredLayer = createDeferred<MapLayer>();
        const secondRender = presenter.setFile(file);

        controller.abort();

        deferredLayer!.resolve(pendingLayer);
        enterDeferred.resolve();

        await switchPromise;
        await secondRender;

        expect(pendingLayer.destroy).toHaveBeenCalledTimes(1);
        expect(modeBOnFileChange).not.toHaveBeenCalled();
    });

    it("aborts slow mode transitions without mutating UI or map state", async () => {
        const shell = createShellStub();
        const file: TFile = { path: "Maps/gamma.md", basename: "gamma" } as TFile;
        const handles = { marker: "handles" } as unknown as RenderHandles;
        const mapLayer: MapLayer = {
            handles,
            polyToCoord: new WeakMap(),
            ensurePolys: vi.fn(),
            centerOf: vi.fn(),
            destroy: vi.fn(),
        };

        const slowEnter = createDeferred<void>();
        const slowFile = createDeferred<void>();
        const enterStarted = createDeferred<void>();
        const events: string[] = [];
        let enterCtx: CartographerModeLifecycleContext | null = null;
        let fileCtx: CartographerModeLifecycleContext | null = null;

        const modeA: CartographerMode = {
            id: "a",
            label: "Mode A",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
        };

        const modeB: CartographerMode = {
            id: "b",
            label: "Mode B",
            async onEnter(ctx) {
                enterCtx = ctx;
                events.push("enter:start");
                enterStarted.resolve();
                await slowEnter.promise;
                if (ctx.signal.aborted) {
                    events.push("enter:aborted");
                    return;
                }
                events.push("enter:complete");
            },
            async onExit(ctx) {
                events.push(`exit:${ctx.signal.aborted}`);
            },
            async onFileChange(_file, _handles, ctx) {
                fileCtx = ctx;
                events.push("file:start");
                await slowFile.promise;
                if (ctx.signal.aborted) {
                    events.push("file:aborted");
                    return;
                }
                events.push("file:complete");
            },
        };

        const loadHexOptions = vi.fn(async () => ({ hexSize: 1 } as unknown as HexOptions));
        const createLayer = vi.fn(async () => mapLayer);

        const registry = createRegistryController();

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: createLayer,
            loadHexOptions,
            provideModes: () => [createRegistryEntry(modeA), createRegistryEntry(modeB)],
            subscribeToModeRegistry: registry.subscribe,
        });

        registry.emit({ type: "initial", entries: [createRegistryEntry(modeA), createRegistryEntry(modeB)] });

        await presenter.onOpen(shell.host, file);
        events.length = 0;

        const controller = new AbortController();
        const transition = presenter.setMode("b", { signal: controller.signal });
        await enterStarted.promise;
        controller.abort();
        slowEnter.resolve();
        slowFile.resolve();

        await transition;

        expect(events).toEqual(["enter:start", "enter:aborted"]);
        expect(enterCtx?.signal.aborted).toBe(true);
        expect(fileCtx).toBeNull();
        expect(shell.setModeActive).toHaveBeenLastCalledWith("a");
        expect(shell.setModeLabel).toHaveBeenLastCalledWith("Mode A");
        expect(createLayer).toHaveBeenCalledTimes(1);
        expect(mapLayer.destroy).not.toHaveBeenCalled();
    });

    it("short-circuits immediately aborted mode switches", async () => {
        const shell = createShellStub();
        const registry = createRegistryController();

        let activeCtx: CartographerModeLifecycleContext | null = null;

        const modeA: CartographerMode = {
            id: "a",
            label: "Mode A",
            onEnter: vi.fn((ctx) => {
                activeCtx = ctx;
            }),
            onExit: vi.fn(),
            onFileChange: vi.fn((_file, _handles, ctx) => {
                activeCtx = ctx;
            }),
        };

        const modeB: CartographerMode = {
            id: "b",
            label: "Mode B",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
        };

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: vi.fn(async () => {
                throw new Error("no map layer expected");
            }),
            loadHexOptions: vi.fn(async () => null as HexOptions | null),
            provideModes: () => [modeA, modeB],
            subscribeToModeRegistry: registry.subscribe,
        });

        registry.emit({ type: "initial", entries: [createRegistryEntry(modeA), createRegistryEntry(modeB)] });

        await presenter.onOpen(shell.host, null);

        modeA.onEnter.mockClear();
        modeA.onExit.mockClear();
        modeA.onFileChange.mockClear();
        modeB.onEnter.mockClear();
        modeB.onExit.mockClear();
        modeB.onFileChange.mockClear();
        shell.setModeActive.mockClear();
        shell.setModeLabel.mockClear();

        const controller = new AbortController();
        controller.abort();

        await presenter.setMode("b", { signal: controller.signal });

        expect(modeA.onExit).not.toHaveBeenCalled();
        expect(modeB.onEnter).not.toHaveBeenCalled();
        expect(modeB.onFileChange).not.toHaveBeenCalled();
        expect(shell.setModeActive).not.toHaveBeenCalledWith("b");
        expect(shell.setModeLabel).not.toHaveBeenCalledWith("Mode B");
        expect(activeCtx?.signal.aborted).toBe(false);
    });

    it("updates shell controls when a provider registers after mount", async () => {
        const shell = createShellStub();
        const registry = createRegistryController();

        const modeA: CartographerMode = {
            id: "a",
            label: "Mode A",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
        };

        const modeB: CartographerMode = {
            id: "b",
            label: "Mode B",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
        };

        const modeC: CartographerMode = {
            id: "c",
            label: "Mode C",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
        };

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: vi.fn(async () => {
                throw new Error("layer should not be created in this scenario");
            }),
            loadHexOptions: vi.fn(async () => null as HexOptions | null),
            provideModes: () => [createRegistryEntry(modeA), createRegistryEntry(modeB)],
            subscribeToModeRegistry: registry.subscribe,
        });

        const entryA = createRegistryEntry(modeA);
        const entryB = createRegistryEntry(modeB);
        registry.emit({ type: "initial", entries: [entryA, entryB] });

        await presenter.onOpen(shell.host, null);

        shell.registerMode.mockClear();
        shell.setModes.mockClear();
        shell.setModeActive.mockClear();
        shell.setModeLabel.mockClear();

        const entryC = createRegistryEntry(modeC);
        registry.emit({ type: "registered", entry: entryC, index: 2, entries: [entryA, entryB, entryC] });

        expect(shell.registerMode).toHaveBeenCalledWith({ id: "c", label: "Mode C" });
        expect(shell.setModes).toHaveBeenCalledWith([
            { id: "a", label: "Mode A" },
            { id: "b", label: "Mode B" },
            { id: "c", label: "Mode C" },
        ]);
        expect(shell.setModeActive).toHaveBeenCalledWith("a");
        expect(shell.setModeLabel).toHaveBeenCalledWith("Mode A");
    });

    it("falls back to the next available mode when the active provider deregisters", async () => {
        const shell = createShellStub();
        const registry = createRegistryController();

        const modeA: CartographerMode = {
            id: "a",
            label: "Mode A",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
        };

        const modeB: CartographerMode = {
            id: "b",
            label: "Mode B",
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onFileChange: vi.fn(),
        };

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: vi.fn(async () => {
                throw new Error("layer should not be created in this scenario");
            }),
            loadHexOptions: vi.fn(async () => null as HexOptions | null),
            provideModes: () => [createRegistryEntry(modeA), createRegistryEntry(modeB)],
            subscribeToModeRegistry: registry.subscribe,
        });

        const entryA = createRegistryEntry(modeA);
        const entryB = createRegistryEntry(modeB);
        registry.emit({ type: "initial", entries: [entryA, entryB] });

        await presenter.onOpen(shell.host, null);
        await presenter.setMode("b");

        shell.deregisterMode.mockClear();
        shell.setModes.mockClear();
        shell.setModeActive.mockClear();
        shell.setModeLabel.mockClear();
        const modeAEnterMock = modeA.onEnter as ReturnType<typeof vi.fn>;
        modeAEnterMock.mockClear();

        registry.emit({ type: "deregistered", id: "b", entries: [entryA] });

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(shell.deregisterMode).toHaveBeenCalledWith("b");
        expect(shell.setModes).toHaveBeenCalledWith([{ id: "a", label: "Mode A" }]);
        expect(shell.setModeActive).toHaveBeenCalledWith("a");
        expect(shell.setModeLabel).toHaveBeenCalledWith("Mode A");
        expect(modeAEnterMock).toHaveBeenCalledTimes(1);
    });

    it("reuses lifecycle contexts per mode during travel/editor round-trips", async () => {
        const shell = createShellStub();

        const travelEnter: CartographerModeLifecycleContext[] = [];
        const travelFile: CartographerModeLifecycleContext[] = [];
        const travelExit: CartographerModeLifecycleContext[] = [];
        const travelCleanup = vi.fn();

        const editorEnter: CartographerModeLifecycleContext[] = [];
        const editorFile: CartographerModeLifecycleContext[] = [];
        const editorExit: CartographerModeLifecycleContext[] = [];
        const editorCleanup = vi.fn();

        const travelMode: CartographerMode = {
            id: "travel",
            label: "Travel Guide",
            onEnter: (ctx) => {
                travelEnter.push(ctx);
                expect(ctx.signal.aborted).toBe(false);
            },
            onExit: (ctx) => {
                travelExit.push(ctx);
                travelCleanup();
                expect(ctx.signal.aborted).toBe(true);
            },
            onFileChange: (_file, _handles, ctx) => {
                travelFile.push(ctx);
            },
        };

        const editorMode: CartographerMode = {
            id: "editor",
            label: "Editor",
            onEnter: (ctx) => {
                editorEnter.push(ctx);
                expect(ctx.signal.aborted).toBe(false);
            },
            onExit: (ctx) => {
                editorExit.push(ctx);
                editorCleanup();
                expect(ctx.signal.aborted).toBe(true);
            },
            onFileChange: (_file, _handles, ctx) => {
                editorFile.push(ctx);
            },
        };

        const registry = createRegistryController();

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: vi.fn(async () => ({
                handles: {} as RenderHandles,
                polyToCoord: new WeakMap(),
                ensurePolys: vi.fn(),
                centerOf: vi.fn(),
                destroy: vi.fn(),
            } as unknown as MapLayer)),
            loadHexOptions: vi.fn(async () => null as HexOptions | null),
            provideModes: () => [createRegistryEntry(travelMode), createRegistryEntry(editorMode)],
            subscribeToModeRegistry: registry.subscribe,
        });

        registry.emit({ type: "initial", entries: [createRegistryEntry(travelMode), createRegistryEntry(editorMode)] });

        await presenter.onOpen(shell.host, null);

        expect(travelEnter).toHaveLength(1);
        expect(travelFile[0]).toBe(travelEnter[0]);
        expect(travelCleanup).not.toHaveBeenCalled();

        await presenter.setMode("editor");

        expect(travelExit).toHaveLength(1);
        expect(travelExit[0]).toBe(travelEnter[0]);
        expect(travelCleanup).toHaveBeenCalledTimes(1);
        expect(editorEnter).toHaveLength(1);
        expect(editorFile[0]).toBe(editorEnter[0]);

        await presenter.setMode("travel");

        expect(editorExit).toHaveLength(1);
        expect(editorExit[0]).toBe(editorEnter[0]);
        expect(editorCleanup).toHaveBeenCalledTimes(1);
        expect(travelEnter).toHaveLength(2);
        expect(travelFile.length).toBeGreaterThanOrEqual(2);
        expect(travelFile[travelFile.length - 1]).toBe(travelEnter[1]);
        expect(travelEnter[1]).not.toBe(travelEnter[0]);
        expect(travelCleanup).toHaveBeenCalledTimes(1);

        await presenter.onClose();
    });
});
