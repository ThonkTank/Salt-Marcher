// src/apps/cartographer/editor/tools/tool-manager.ts
// Verwaltet aktiviertes Werkzeug im Karten-Editor.
import type { CleanupFn, ToolContext, ToolManager as ToolManagerContract, ToolModule } from "./tools-api";

const yieldMicrotask = () => Promise.resolve();

type ToolErrorStage =
    | "resolve"
    | "mount-panel"
    | "activate"
    | "render"
    | "deactivate"
    | "cleanup";

type ToolManagerOptions = {
    getContext(): ToolContext | null;
    getPanelHost(): HTMLElement | null;
    getLifecycleSignal(): AbortSignal | null;
    onToolChanged?(tool: ToolModule | null): void;
    onToolError?(options: { stage: ToolErrorStage; tool: ToolModule | null; error: unknown; toolId: string }): void;
    onToolFallback?(options: {
        stage: "resolve" | "mount-panel";
        requestedId: string;
        fallback: ToolModule | null;
        error: unknown;
    }): void;
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
                options.onToolError?.({
                    stage: "deactivate",
                    tool: active.module,
                    error: err,
                    toolId: active.module.id,
                });
            }
        }
        try {
            (active.cleanup ?? SAFE_CLEANUP)();
        } catch (err) {
            console.error("[tool-manager] cleanup failed", err);
            options.onToolError?.({
                stage: "cleanup",
                tool: active.module,
                error: err,
                toolId: active.module.id,
            });
        }
        active = null;
        options.onToolChanged?.(null);
    };

    const emitToolError = (
        stage: ToolErrorStage,
        error: unknown,
        tool: ToolModule | null,
        requestedId: string
    ) => {
        const toolId = tool?.id ?? requestedId;
        options.onToolError?.({ stage, tool, error, toolId });
    };

    const attemptSwitch = async (requestedId: string, attempted: Set<string>): Promise<void> => {
        const ctx = options.getContext();
        const host = options.getPanelHost();
        if (!ctx || !host || tools.length === 0) {
            const error = !ctx
                ? new Error("Tool context is unavailable")
                : !host
                ? new Error("Tool panel host is missing")
                : new Error("No tools have been registered");
            emitToolError("resolve", error, null, requestedId);
            return;
        }

        let id = requestedId;
        let next = tools.find((tool) => tool.id === id) ?? null;
        if (!next) {
            const fallback = tools[0] ?? null;
            const error = new Error(`Tool with id "${requestedId}" is not registered`);
            emitToolError("resolve", error, null, requestedId);
            options.onToolFallback?.({
                stage: "resolve",
                requestedId,
                fallback,
                error,
            });
            if (!fallback) {
                return;
            }
            id = fallback.id;
            next = fallback;
        }

        if (attempted.has(id)) {
            return;
        }
        attempted.add(id);

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
        let encounteredError = false;
        try {
            const result = next.mountPanel(host, ctx);
            cleanup = typeof result === "function" ? result : null;
        } catch (err) {
            console.error("[tool-manager] mountPanel failed", err);
            cleanup = null;
            encounteredError = true;
            emitToolError("mount-panel", err, next, id);
            const fallback = tools.find((tool) => tool !== next && !attempted.has(tool.id)) ?? null;
            options.onToolFallback?.({
                stage: "mount-panel",
                requestedId: id,
                fallback,
                error: err,
            });
            if (fallback) {
                controller.abort();
                switchController = null;
                await attemptSwitch(fallback.id, attempted);
                return;
            }
        }

        await yieldMicrotask();
        if (getLifecycleAborted(controller.signal)) {
            try {
                (cleanup ?? SAFE_CLEANUP)();
            } catch (err) {
                console.error("[tool-manager] cleanup failed", err);
                emitToolError("cleanup", err, next, id);
            }
            host.empty();
            switchController = null;
            return;
        }

        if (!encounteredError) {
            try {
                next.onActivate?.(ctx);
            } catch (err) {
                console.error("[tool-manager] onActivate failed", err);
                encounteredError = true;
                emitToolError("activate", err, next, id);
            }
        }

        if (encounteredError) {
            try {
                (cleanup ?? SAFE_CLEANUP)();
            } catch (err) {
                console.error("[tool-manager] cleanup failed", err);
                emitToolError("cleanup", err, next, id);
            }
            host.empty();
            switchController = null;
            options.onToolChanged?.(null);
            return;
        }

        active = { module: next, cleanup };
        options.onToolChanged?.(next);

        if (!getLifecycleAborted(controller.signal) && ctx.getHandles()) {
            try {
                next.onMapRendered?.(ctx);
            } catch (err) {
                console.error("[tool-manager] onMapRendered failed", err);
                emitToolError("render", err, next, id);
            }
        }

        if (switchController === controller) {
            switchController = null;
        }
    };

    const switchTo = async (id: string): Promise<void> => {
        await attemptSwitch(id, new Set());
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
            emitToolError("render", err, active.module, active.module.id);
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
