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

    const manager: any = app.plugins;
    let enabledRef: any = null;
    let disabledRef: any = null;
    if (typeof manager?.on === "function") {
        enabledRef = manager.on("plugin-enabled", (id: string) => {
            if (id === LAYOUT_EDITOR_PLUGIN_ID) {
                tryRegister();
            }
        });
        disabledRef = manager.on("plugin-disabled", (id: string) => {
            if (id === LAYOUT_EDITOR_PLUGIN_ID) {
                unregister?.();
            }
        });
    }

    return () => {
        unregister?.();
        if (enabledRef && typeof manager?.off === "function") {
            manager.off("plugin-enabled", enabledRef);
        }
        if (disabledRef && typeof manager?.off === "function") {
            manager.off("plugin-disabled", disabledRef);
        }
    };
}
