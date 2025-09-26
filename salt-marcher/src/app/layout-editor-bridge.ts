// src/app/layout-editor-bridge.ts
// Kapselt die optionale Integration mit dem Layout-Editor-Plugin. Falls verfügbar
// registrieren wir einen View-Binding-Eintrag, damit der neue View Container des
// Layout Editors die Cartographer-Karte als Feature anbieten kann.

import type { App, EventRef, Plugin } from "obsidian";
import {
    reportIntegrationIssue,
    type IntegrationIssuePayload,
} from "./integration-telemetry";

type LayoutEditorViewBinding = {
    id: string;
    label: string;
    description?: string;
};

type LayoutEditorPluginApi = {
    registerViewBinding(definition: LayoutEditorViewBinding): void;
    unregisterViewBinding?(id: string): void;
};

type LayoutEditorPlugin = {
    getApi?: () => unknown;
};

type PluginLifecycleEvent = "plugin-enabled" | "plugin-disabled";
type PluginEventRef = unknown;
type PluginLifecycleHandler = (id: string) => void;

type PluginLifecycleEmitter = {
    on(event: PluginLifecycleEvent, callback: PluginLifecycleHandler): PluginEventRef | void;
    off?(event: PluginLifecycleEvent, ref: PluginEventRef): void;
};

type BoundLifecycleEmitter = {
    on: PluginLifecycleEmitter["on"];
    off?: PluginLifecycleEmitter["off"];
};

const LAYOUT_EDITOR_PLUGIN_ID = "layout-editor";
const MAP_VIEW_BINDING_ID = "salt-marcher.cartographer-map";

const REGISTER_NOTICE =
    "Salt Marcher konnte die Layout-Editor-Bridge nicht aktivieren. Prüfe das Debug-Log.";
const UNREGISTER_NOTICE =
    "Salt Marcher konnte die Layout-Editor-Bridge nicht sauber deaktivieren. Prüfe das Debug-Log.";
const INVALID_API_NOTICE =
    "Salt Marcher fand eine inkompatible Layout-Editor-API. Bitte Plugin-Version prüfen.";

const VIEW_BINDING: LayoutEditorViewBinding = Object.freeze({
    id: MAP_VIEW_BINDING_ID,
    label: "Salt Marcher – Hex Map",
    description: "Cartographer-View mit renderHexMap & Token-Workflow.",
});

function emitIntegrationIssue(
    overrides: Pick<IntegrationIssuePayload, "operation" | "error" | "userMessage">
): void {
    reportIntegrationIssue({
        integrationId: LAYOUT_EDITOR_PLUGIN_ID,
        ...overrides,
    });
}

function bindLifecycleEmitter(manager: App["plugins"]): BoundLifecycleEmitter | null {
    const candidate = manager as Partial<PluginLifecycleEmitter>;
    if (typeof candidate.on !== "function") {
        return null;
    }
    return {
        on: candidate.on.bind(candidate) as PluginLifecycleEmitter["on"],
        off:
            typeof candidate.off === "function"
                ? (candidate.off.bind(candidate) as PluginLifecycleEmitter["off"])
                : undefined,
    };
}

function resolveLayoutEditorApi(app: App): LayoutEditorPluginApi | null {
    const plugin = app.plugins.getPlugin(LAYOUT_EDITOR_PLUGIN_ID) as LayoutEditorPlugin | null;
    if (!plugin) return null;

    if (typeof plugin.getApi !== "function") {
        emitIntegrationIssue({
            operation: "resolve-api",
            error: new Error("Missing getApi() on layout-editor plugin"),
            userMessage: INVALID_API_NOTICE,
        });
        return null;
    }

    let apiCandidate: unknown;
    try {
        apiCandidate = plugin.getApi();
    } catch (error) {
        emitIntegrationIssue({
            operation: "resolve-api",
            error,
            userMessage: INVALID_API_NOTICE,
        });
        return null;
    }

    if (!apiCandidate) {
        // Plugin noch nicht initialisiert; später erneut versuchen.
        return null;
    }

    if (!isLayoutEditorPluginApi(apiCandidate)) {
        emitIntegrationIssue({
            operation: "resolve-api",
            error: new Error("Incompatible layout-editor API"),
            userMessage: INVALID_API_NOTICE,
        });
        return null;
    }

    return apiCandidate;
}

function isLayoutEditorPluginApi(candidate: unknown): candidate is LayoutEditorPluginApi {
    if (!candidate || typeof candidate !== "object") return false;
    const api = candidate as LayoutEditorPluginApi;
    return typeof api.registerViewBinding === "function";
}

export function setupLayoutEditorBridge(plugin: Plugin): () => void {
    const { app } = plugin;
    let unregisterBinding: (() => void) | null = null;

    const tryRegister = () => {
        if (unregisterBinding) {
            return;
        }
        const api = resolveLayoutEditorApi(app);
        if (!api) {
            return;
        }

        try {
            api.registerViewBinding(VIEW_BINDING);
        } catch (error) {
            emitIntegrationIssue({
                operation: "register-view-binding",
                error,
                userMessage: REGISTER_NOTICE,
            });
            return;
        }

        unregisterBinding = () => {
            if (typeof api.unregisterViewBinding !== "function") {
                unregisterBinding = null;
                return;
            }
            try {
                api.unregisterViewBinding(MAP_VIEW_BINDING_ID);
            } catch (error) {
                emitIntegrationIssue({
                    operation: "unregister-view-binding",
                    error,
                    userMessage: UNREGISTER_NOTICE,
                });
            } finally {
                unregisterBinding = null;
            }
        };
    };

    tryRegister();

    const layoutReadyRef: EventRef = app.workspace.on("layout-ready", tryRegister);
    plugin.registerEvent(layoutReadyRef);

    const lifecycle = bindLifecycleEmitter(app.plugins);

    const enabledRef = lifecycle?.on("plugin-enabled", (id) => {
        if (id === LAYOUT_EDITOR_PLUGIN_ID) {
            tryRegister();
        }
    }) ?? null;

    const disabledRef = lifecycle?.on("plugin-disabled", (id) => {
        if (id === LAYOUT_EDITOR_PLUGIN_ID) {
            unregisterBinding?.();
        }
    }) ?? null;

    return () => {
        unregisterBinding?.();
        if (lifecycle?.off && enabledRef) {
            lifecycle.off("plugin-enabled", enabledRef);
        }
        if (lifecycle?.off && disabledRef) {
            lifecycle.off("plugin-disabled", disabledRef);
        }
    };
}
