import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App, EventRef, Plugin } from "obsidian";

vi.mock("../../src/app/integration-telemetry", () => ({
    reportIntegrationIssue: vi.fn(),
}));

import { setupLayoutEditorBridge } from "../../src/app/layout-editor-bridge";
import { reportIntegrationIssue } from "../../src/app/integration-telemetry";

type LayoutEditorPluginApi = {
    registerViewBinding: ReturnType<typeof vi.fn>;
    unregisterViewBinding?: ReturnType<typeof vi.fn>;
};

type LifecycleEvent = "plugin-enabled" | "plugin-disabled";
type LifecycleHandler = (id: string) => void;

type TestContext = {
    app: App;
    plugin: Plugin;
    pluginManager: {
        getPlugin: ReturnType<typeof vi.fn>;
        on: ReturnType<typeof vi.fn>;
        off: ReturnType<typeof vi.fn>;
    };
    layoutReadyHandlers: Array<() => void>;
    lifecycleHandlers: Partial<Record<LifecycleEvent, LifecycleHandler>>;
    lifecycleRefs: Partial<Record<LifecycleEvent, unknown>>;
    setLayoutEditorPlugin: (plugin: { getApi?: () => unknown } | null) => void;
};

const MOCKED_REPORT = vi.mocked(reportIntegrationIssue);

function createTestContext(): TestContext {
    const layoutReadyHandlers: Array<() => void> = [];
    const lifecycleHandlers: Partial<Record<LifecycleEvent, LifecycleHandler>> = {};
    const lifecycleRefs: Partial<Record<LifecycleEvent, unknown>> = {};

    let layoutEditorPlugin: { getApi?: () => unknown } | null = null;

    const getPlugin = vi.fn(() => layoutEditorPlugin);
    const on = vi.fn((event: LifecycleEvent, handler: LifecycleHandler) => {
        lifecycleHandlers[event] = handler;
        const ref = Symbol(event);
        lifecycleRefs[event] = ref;
        return ref;
    });
    const off = vi.fn();

    const workspaceOn = vi.fn((event: string, handler: () => void) => {
        if (event === "layout-ready") {
            layoutReadyHandlers.push(handler);
        }
        return { event } as unknown as EventRef;
    });

    const app = {
        plugins: { getPlugin, on, off },
        workspace: { on: workspaceOn },
    } as unknown as App;

    const plugin = {
        app,
        registerEvent: vi.fn((ref: EventRef) => ref),
    } as unknown as Plugin;

    return {
        app,
        plugin,
        pluginManager: { getPlugin, on, off },
        layoutReadyHandlers,
        lifecycleHandlers,
        lifecycleRefs,
        setLayoutEditorPlugin: (pluginRef) => {
            layoutEditorPlugin = pluginRef;
        },
    };
}

describe("setupLayoutEditorBridge", () => {
    beforeEach(() => {
        MOCKED_REPORT.mockReset();
    });

    it("registers the view binding and tears down listeners", () => {
        const ctx = createTestContext();
        const registerViewBinding = vi.fn();
        const unregisterViewBinding = vi.fn();
        ctx.setLayoutEditorPlugin({
            getApi: () => ({ registerViewBinding, unregisterViewBinding }),
        });

        const dispose = setupLayoutEditorBridge(ctx.plugin);

        expect(registerViewBinding).toHaveBeenCalledWith(
            expect.objectContaining({ id: "salt-marcher.cartographer-map" })
        );
        expect(MOCKED_REPORT).not.toHaveBeenCalled();

        dispose();

        expect(unregisterViewBinding).toHaveBeenCalledWith("salt-marcher.cartographer-map");
        expect(ctx.pluginManager.off).toHaveBeenCalledWith(
            "plugin-enabled",
            ctx.lifecycleRefs["plugin-enabled"]
        );
        expect(ctx.pluginManager.off).toHaveBeenCalledWith(
            "plugin-disabled",
            ctx.lifecycleRefs["plugin-disabled"]
        );
    });

    it("registers once the layout editor becomes available", () => {
        const ctx = createTestContext();
        const registerViewBinding = vi.fn();
        const api = { registerViewBinding } satisfies LayoutEditorPluginApi;
        ctx.setLayoutEditorPlugin(null);

        setupLayoutEditorBridge(ctx.plugin);

        expect(registerViewBinding).not.toHaveBeenCalled();

        ctx.setLayoutEditorPlugin({ getApi: () => api });
        ctx.layoutReadyHandlers.forEach((handler) => handler());

        expect(registerViewBinding).toHaveBeenCalledTimes(1);
    });

    it("unregisters when the layout editor plugin is disabled", () => {
        const ctx = createTestContext();
        const registerViewBinding = vi.fn();
        const unregisterViewBinding = vi.fn();
        ctx.setLayoutEditorPlugin({
            getApi: () => ({ registerViewBinding, unregisterViewBinding }),
        });

        setupLayoutEditorBridge(ctx.plugin);
        const disable = ctx.lifecycleHandlers["plugin-disabled"];
        expect(disable).toBeTypeOf("function");

        disable?.("layout-editor");

        expect(unregisterViewBinding).toHaveBeenCalledWith("salt-marcher.cartographer-map");
    });

    it("reports a registration failure", () => {
        const ctx = createTestContext();
        const registerViewBinding = vi.fn(() => {
            throw new Error("boom");
        });
        ctx.setLayoutEditorPlugin({ getApi: () => ({ registerViewBinding }) });

        setupLayoutEditorBridge(ctx.plugin);

        expect(MOCKED_REPORT).toHaveBeenCalledWith(
            expect.objectContaining({ operation: "register-view-binding" })
        );
    });

    it("reports an unregister failure", () => {
        const ctx = createTestContext();
        const unregisterViewBinding = vi.fn(() => {
            throw new Error("boom");
        });
        ctx.setLayoutEditorPlugin({
            getApi: () => ({
                registerViewBinding: vi.fn(),
                unregisterViewBinding,
            }),
        });

        const dispose = setupLayoutEditorBridge(ctx.plugin);
        MOCKED_REPORT.mockClear();

        dispose();

        expect(MOCKED_REPORT).toHaveBeenCalledWith(
            expect.objectContaining({ operation: "unregister-view-binding" })
        );
    });

    it("guards against incompatible APIs", () => {
        const ctx = createTestContext();
        ctx.setLayoutEditorPlugin({ getApi: () => ({}) });

        setupLayoutEditorBridge(ctx.plugin);

        expect(MOCKED_REPORT).toHaveBeenCalledWith(
            expect.objectContaining({ operation: "resolve-api" })
        );
    });
});
