import { describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import {
    CartographerPresenter,
    type CartographerMode,
    type CartographerModeContext,
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

function createShellStub() {
    const host = document.createElement("div");
    const mapHost = document.createElement("div");
    const sidebarHost = document.createElement("div");
    const setFileLabel = vi.fn();
    const setModeActive = vi.fn();
    const setModeLabel = vi.fn();
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
            onEnter: () => {
                events.push("A:enter");
            },
            onExit: () => {
                events.push("A:exit");
            },
            onFileChange: (file) => {
                events.push(`A:file:${file ? file.path : "null"}`);
            },
        };

        const modeB: CartographerMode = {
            id: "b",
            label: "Mode B",
            onEnter: () => {
                events.push("B:enter");
            },
            onExit: () => {
                events.push("B:exit");
            },
            onFileChange: (file) => {
                events.push(`B:file:${file ? file.path : "null"}`);
            },
        };

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: vi.fn(async () => {
                throw new Error("layer should not be created in this scenario");
            }),
            loadHexOptions: vi.fn(async () => null as HexOptions | null),
            provideModes: () => [modeA, modeB],
        });

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
            onExit: vi.fn(() => {
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

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: vi.fn(async () => {
                throw new Error("layer should not be created in this scenario");
            }),
            loadHexOptions: vi.fn(async () => null as HexOptions | null),
            provideModes: () => [modeA, modeB],
        });

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
            onEnter: vi.fn(() => {
                throw enterError;
            }),
            onExit: vi.fn(),
            onFileChange: modeBFileChange,
        };

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: vi.fn(async () => {
                throw new Error("layer should not be created in this scenario");
            }),
            loadHexOptions: vi.fn(async () => null as HexOptions | null),
            provideModes: () => [modeA, modeB],
        });

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

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: vi.fn(async () => {
                throw new Error("layer should not be created in this scenario");
            }),
            loadHexOptions: vi.fn(async () => null as HexOptions | null),
            provideModes: () => [modeA, modeB],
        });

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

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: createLayer,
            loadHexOptions,
            provideModes: () => [mode],
        });

        await presenter.onOpen(shell.host, file);

        expect(loadHexOptions).toHaveBeenCalledWith(appStub, file);
        expect(createLayer).toHaveBeenCalled();

        const calls = (mode.onFileChange as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const [receivedFile, receivedHandles, ctx] = calls[calls.length - 1];
        expect(receivedFile).toBe(file);
        expect(receivedHandles).toBe(handles);
        expect(typeof (ctx as CartographerModeContext).getOptions).toBe("function");
        expect(shell.setOverlay).toHaveBeenLastCalledWith(null);
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
            onEnter: vi.fn(() => enterDeferred.promise),
            onExit: vi.fn(),
            onFileChange: modeBOnFileChange,
        };

        const presenter = new CartographerPresenter(appStub, {
            createShell: shell.factory,
            createMapManager: createMapManagerFactory(),
            createMapLayer: createLayer,
            loadHexOptions,
            provideModes: () => [modeA, modeB],
        });

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
});
