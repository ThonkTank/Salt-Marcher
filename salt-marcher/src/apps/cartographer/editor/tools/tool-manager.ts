// src/apps/cartographer/editor/tools/tool-manager.ts
// Verwaltet aktiviertes Werkzeug im Karten-Editor.
import type { CleanupFn, ToolContext, ToolManager as ToolManagerContract, ToolModule } from "./tools-api";

const yieldMicrotask = () => Promise.resolve();

type ToolManagerOptions = {
    getContext(): ToolContext | null;
    getPanelHost(): HTMLElement | null;
    getLifecycleSignal(): AbortSignal | null;
    onToolChanged?(tool: ToolModule | null): void;
};

type ActiveToolState = {
    module: ToolModule;
    cleanup: CleanupFn | null;
};

const SAFE_CLEANUP: CleanupFn = () => {};

export function createToolManager(
    tools: readonly ToolModule[],
    options: ToolManagerOptions
): ToolManagerContract {
    let active: ActiveToolState | null = null;
    let switchController: AbortController | null = null;
    let destroyed = false;

    const getLifecycleAborted = (localSignal?: AbortSignal | null) => {
        if (destroyed) return true;
        if (localSignal?.aborted) return true;
        const lifecycle = options.getLifecycleSignal();
        return lifecycle?.aborted ?? false;
    };

    const teardownActive = (ctx: ToolContext | null) => {
        if (!active) return;
        if (ctx) {
            try {
                active.module.onDeactivate?.(ctx);
            } catch (err) {
                console.error("[tool-manager] onDeactivate failed", err);
            }
        }
        try {
            (active.cleanup ?? SAFE_CLEANUP)();
        } catch (err) {
            console.error("[tool-manager] cleanup failed", err);
        }
        active = null;
        options.onToolChanged?.(null);
    };

    const switchTo = async (id: string): Promise<void> => {
        const ctx = options.getContext();
        const host = options.getPanelHost();
        if (!ctx || !host || tools.length === 0) {
            return;
        }

        const next = tools.find((tool) => tool.id === id) ?? tools[0];
        if (active?.module === next && !switchController) {
            return;
        }

        const controller = new AbortController();
        if (switchController) {
            switchController.abort();
        }
        switchController = controller;

        teardownActive(ctx);
        host.empty();

        await yieldMicrotask();
        if (getLifecycleAborted(controller.signal)) {
            switchController = null;
            return;
        }

        let cleanup: CleanupFn | null = null;
        try {
            const result = next.mountPanel(host, ctx);
            cleanup = typeof result === "function" ? result : null;
        } catch (err) {
            console.error("[tool-manager] mountPanel failed", err);
            cleanup = null;
        }

        await yieldMicrotask();
        if (getLifecycleAborted(controller.signal)) {
            try {
                (cleanup ?? SAFE_CLEANUP)();
            } catch (err) {
                console.error("[tool-manager] cleanup failed", err);
            }
            host.empty();
            switchController = null;
            return;
        }

        try {
            next.onActivate?.(ctx);
        } catch (err) {
            console.error("[tool-manager] onActivate failed", err);
        }

        active = { module: next, cleanup };
        options.onToolChanged?.(next);

        if (!getLifecycleAborted(controller.signal) && ctx.getHandles()) {
            try {
                next.onMapRendered?.(ctx);
            } catch (err) {
                console.error("[tool-manager] onMapRendered failed", err);
            }
        }

        if (switchController === controller) {
            switchController = null;
        }
    };

    const notifyMapRendered = () => {
        if (!active) return;
        const ctx = options.getContext();
        if (!ctx || getLifecycleAborted(null) || !ctx.getHandles()) {
            return;
        }
        try {
            active.module.onMapRendered?.(ctx);
        } catch (err) {
            console.error("[tool-manager] onMapRendered failed", err);
        }
    };

    const deactivate = () => {
        const ctx = options.getContext();
        switchController?.abort();
        switchController = null;
        teardownActive(ctx);
    };

    const destroy = () => {
        if (destroyed) return;
        destroyed = true;
        deactivate();
    };

    const getActive = () => active?.module ?? null;

    return {
        getActive,
        switchTo,
        notifyMapRendered,
        deactivate,
        destroy,
    };
}
