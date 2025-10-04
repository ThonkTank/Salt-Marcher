// salt-marcher/tests/cartographer/editor/tool-manager.test.ts
// Testet den Tool-Manager auf Lifecycle-Events und Aktivierungslogik.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createToolManager } from "../../../src/apps/cartographer/editor/tools/tool-manager";
import type { ToolContext, ToolModule } from "../../../src/apps/cartographer/editor/tools/tools-api";
import type { RenderHandles } from "../../../src/core/hex-mapper/hex-render";

type ToolEvents = string[];

const createTool = (id: string, events: ToolEvents): ToolModule => ({
    id,
    label: id,
    mountPanel: vi.fn(() => {
        events.push(`${id}:mount`);
        return () => {
            events.push(`${id}:cleanup`);
        };
    }),
    onActivate: vi.fn(() => {
        events.push(`${id}:activate`);
    }),
    onDeactivate: vi.fn(() => {
        events.push(`${id}:deactivate`);
    }),
    onMapRendered: vi.fn(() => {
        events.push(`${id}:render`);
    }),
    onHexClick: vi.fn(async () => {
        events.push(`${id}:click`);
        return true;
    }),
});

const createHandles = (): RenderHandles => {
    const svgNS = "http://www.w3.org/2000/svg";
    return {
        svg: document.createElementNS(svgNS, "svg"),
        contentG: document.createElementNS(svgNS, "g"),
        overlay: document.createElementNS(svgNS, "rect"),
        polyByCoord: new Map(),
        setFill: vi.fn(),
        ensurePolys: vi.fn(),
        setInteractionDelegate: vi.fn(),
        destroy: vi.fn(),
    } as unknown as RenderHandles;
};

describe("createToolManager", () => {
    it("activates the requested tool and handles map rendered notifications", async () => {
        const events: ToolEvents = [];
        const toolA = createTool("a", events);
        const toolB = createTool("b", events);
        const host = document.createElement("div");
        const handles = createHandles();
        const abortController = new AbortController();

        const context: ToolContext = {
            app: { workspace: {} } as any,
            getFile: () => null,
            getHandles: () => handles,
            getOptions: () => null,
            getAbortSignal: () => abortController.signal,
            setStatus: () => {},
        };

        const manager = createToolManager([toolA, toolB], {
            getContext: () => context,
            getPanelHost: () => host,
            getLifecycleSignal: () => abortController.signal,
        });

        await manager.switchTo("a");
        expect(events).toEqual(["a:mount", "a:activate", "a:render"]);
        events.length = 0;

        manager.notifyMapRendered();
        expect(events).toEqual(["a:render"]);
        events.length = 0;

        await manager.switchTo("b");
        expect(events).toEqual([
            "a:deactivate",
            "a:cleanup",
            "b:mount",
            "b:activate",
            "b:render",
        ]);
        expect(manager.getActive()).toBe(toolB);

        manager.destroy();
        expect(events).toContain("b:deactivate");
        expect(events).toContain("b:cleanup");
    });

    it("aborts pending switches when the lifecycle signal is cancelled", async () => {
        const events: ToolEvents = [];
        const tool = createTool("only", events);
        const host = document.createElement("div");
        const handles = createHandles();
        const abortController = new AbortController();

        const context: ToolContext = {
            app: { workspace: {} } as any,
            getFile: () => null,
            getHandles: () => handles,
            getOptions: () => null,
            getAbortSignal: () => abortController.signal,
            setStatus: () => {},
        };

        const manager = createToolManager([tool], {
            getContext: () => context,
            getPanelHost: () => host,
            getLifecycleSignal: () => abortController.signal,
        });

        const switchPromise = manager.switchTo("only");
        abortController.abort();
        await switchPromise;

        expect(events).toEqual([]);
        expect(manager.getActive()).toBeNull();
    });

    it("emits onToolError and fallback metadata when a tool fails to mount", async () => {
        const events: ToolEvents = [];
        const tool = createTool("faulty", events);
        const failure = new Error("mount failed");
        tool.mountPanel.mockImplementationOnce(() => {
            throw failure;
        });

        const host = document.createElement("div");
        const handles = createHandles();
        const abortController = new AbortController();
        const context: ToolContext = {
            app: { workspace: {} } as any,
            getFile: () => null,
            getHandles: () => handles,
            getOptions: () => null,
            getAbortSignal: () => abortController.signal,
            setStatus: () => {},
        };

        const onToolError = vi.fn();
        const onToolFallback = vi.fn();

        const manager = createToolManager([tool], {
            getContext: () => context,
            getPanelHost: () => host,
            getLifecycleSignal: () => abortController.signal,
            onToolChanged: vi.fn(),
            onToolError,
            onToolFallback,
        });

        await manager.switchTo("faulty");

        expect(onToolError).toHaveBeenCalledTimes(1);
        expect(onToolError).toHaveBeenCalledWith({
            stage: "mount-panel",
            tool,
            error: failure,
            toolId: "faulty",
        });
        expect(onToolFallback).toHaveBeenCalledTimes(1);
        expect(onToolFallback).toHaveBeenCalledWith({
            stage: "mount-panel",
            requestedId: "faulty",
            fallback: null,
            error: failure,
        });
        expect(manager.getActive()).toBeNull();
        expect(events).toEqual([]);
    });

    it("falls back to the first tool when an unknown id is requested", async () => {
        const events: ToolEvents = [];
        const toolA = createTool("a", events);
        const toolB = createTool("b", events);
        const host = document.createElement("div");
        const handles = createHandles();
        const abortController = new AbortController();

        const context: ToolContext = {
            app: { workspace: {} } as any,
            getFile: () => null,
            getHandles: () => handles,
            getOptions: () => null,
            getAbortSignal: () => abortController.signal,
            setStatus: () => {},
        };

        const onToolError = vi.fn();
        const onToolFallback = vi.fn();

        const manager = createToolManager([toolA, toolB], {
            getContext: () => context,
            getPanelHost: () => host,
            getLifecycleSignal: () => abortController.signal,
            onToolError,
            onToolFallback,
        });

        await manager.switchTo("missing");

        expect(onToolError).toHaveBeenCalledWith({
            stage: "resolve",
            tool: null,
            error: expect.any(Error),
            toolId: "missing",
        });
        expect(onToolFallback).toHaveBeenCalledWith({
            stage: "resolve",
            requestedId: "missing",
            fallback: toolA,
            error: expect.any(Error),
        });
        expect(manager.getActive()).toBe(toolA);
        expect(events).toEqual(["a:mount", "a:activate", "a:render"]);
    });

    it("switches to an alternative tool when the requested one fails to mount", async () => {
        const events: ToolEvents = [];
        const failing = createTool("broken", events);
        const fallback = createTool("working", events);
        const failure = new Error("mount failed");
        failing.mountPanel.mockImplementationOnce(() => {
            throw failure;
        });

        const host = document.createElement("div");
        const handles = createHandles();
        const abortController = new AbortController();

        const context: ToolContext = {
            app: { workspace: {} } as any,
            getFile: () => null,
            getHandles: () => handles,
            getOptions: () => null,
            getAbortSignal: () => abortController.signal,
            setStatus: () => {},
        };

        const onToolFallback = vi.fn();

        const manager = createToolManager([failing, fallback], {
            getContext: () => context,
            getPanelHost: () => host,
            getLifecycleSignal: () => abortController.signal,
            onToolFallback,
        });

        await manager.switchTo("broken");

        expect(onToolFallback).toHaveBeenCalledWith({
            stage: "mount-panel",
            requestedId: "broken",
            fallback,
            error: failure,
        });
        expect(manager.getActive()).toBe(fallback);
        expect(events).toEqual([
            "working:mount",
            "working:activate",
            "working:render",
        ]);
    });
});
const ensureObsidianDomHelpers = () => {
    const proto = HTMLElement.prototype as any;
    if (!proto.createEl) {
        proto.createEl = function(tag: string, options?: { text?: string; cls?: string; attr?: Record<string, string> }) {
            const el = document.createElement(tag);
            if (options?.text) el.textContent = options.text;
            if (options?.cls) {
                for (const cls of options.cls.split(/\s+/).filter(Boolean)) {
                    el.classList.add(cls);
                }
            }
            if (options?.attr) {
                for (const [key, value] of Object.entries(options.attr)) {
                    el.setAttribute(key, value);
                }
            }
            this.appendChild(el);
            return el;
        };
    }
    if (!proto.createDiv) {
        proto.createDiv = function(options?: { text?: string; cls?: string; attr?: Record<string, string> }) {
            return this.createEl("div", options);
        };
    }
    if (!proto.empty) {
        proto.empty = function() {
            while (this.firstChild) {
                this.removeChild(this.firstChild);
            }
            return this;
        };
    }
};

beforeAll(() => {
    ensureObsidianDomHelpers();
});
