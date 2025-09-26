// src/app/layout-editor-bridge.ts
// Kapselt die optionale Integration mit dem Layout-Editor-Plugin. Falls verfügbar
// registrieren wir einen View-Binding-Eintrag, damit der neue View Container des
// Layout Editors die Cartographer-Karte als Feature anbieten kann.

import type { App, Plugin } from "obsidian";

type LayoutEditorViewBinding = {
    id: string;
    label: string;
    description?: string;
};

type LayoutEditorPluginApi = {
    registerViewBinding?(definition: LayoutEditorViewBinding): void;
    unregisterViewBinding?(id: string): void;
};

type PluginLifecycleEvent = "plugin-enabled" | "plugin-disabled";
type PluginEventRef = unknown;
type PluginLifecycleEmitter = {
    on?(event: PluginLifecycleEvent, callback: (id: string) => void): PluginEventRef;
    off?(event: PluginLifecycleEvent, ref: PluginEventRef): void;
};

const LAYOUT_EDITOR_PLUGIN_ID = "layout-editor";
const MAP_VIEW_BINDING_ID = "salt-marcher.cartographer-map";

function resolveLayoutEditorApi(app: App): LayoutEditorPluginApi | null {
    const layoutEditor: unknown = app.plugins.getPlugin(LAYOUT_EDITOR_PLUGIN_ID);
    if (!layoutEditor || typeof layoutEditor !== "object") return null;
    const api: unknown = (layoutEditor as { getApi?: () => unknown }).getApi?.();
    if (!api || typeof api !== "object") return null;
    return api as LayoutEditorPluginApi;
}

export function setupLayoutEditorBridge(plugin: Plugin): () => void {
    const { app } = plugin;
    let unregister: (() => void) | null = null;

    const tryRegister = () => {
        if (unregister) return; // bereits registriert
        const api = resolveLayoutEditorApi(app);
        if (!api?.registerViewBinding) return;
        try {
            api.registerViewBinding({
                id: MAP_VIEW_BINDING_ID,
                label: "Salt Marcher – Hex Map",
                description: "Cartographer-View mit renderHexMap & Token-Workflow.",
            });
            unregister = () => {
                try {
                    api.unregisterViewBinding?.(MAP_VIEW_BINDING_ID);
                } catch (err) {
                    console.error("[salt-marcher] failed to unregister layout binding", err);
                }
                unregister = null;
            };
        } catch (err) {
            console.error("[salt-marcher] failed to register layout binding", err);
        }
    };

    tryRegister();

    plugin.registerEvent(app.workspace.on("layout-ready", tryRegister));

    const manager = app.plugins as App["plugins"] & PluginLifecycleEmitter;
    const onLifecycle = typeof manager.on === "function" ? manager.on.bind(manager) : null;
    const offLifecycle = typeof manager.off === "function" ? manager.off.bind(manager) : null;

    let enabledRef: PluginEventRef | null = null;
    let disabledRef: PluginEventRef | null = null;

    if (onLifecycle) {
        enabledRef = onLifecycle("plugin-enabled", (id: string) => {
            if (id === LAYOUT_EDITOR_PLUGIN_ID) {
                tryRegister();
            }
        }) ?? null;
        disabledRef = onLifecycle("plugin-disabled", (id: string) => {
            if (id === LAYOUT_EDITOR_PLUGIN_ID) {
                unregister?.();
            }
        }) ?? null;
    }

    return () => {
        unregister?.();
        if (offLifecycle && enabledRef) {
            offLifecycle("plugin-enabled", enabledRef);
            enabledRef = null;
        }
        if (offLifecycle && disabledRef) {
            offLifecycle("plugin-disabled", disabledRef);
            disabledRef = null;
        }
    };
}
