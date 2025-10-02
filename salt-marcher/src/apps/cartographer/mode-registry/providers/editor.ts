// src/apps/cartographer/mode-registry/providers/editor.ts
// Provider-Beschreibung für den Editor-Modus.
import { defineCartographerModeProvider } from "../registry";

export const createEditorModeProvider = () =>
    defineCartographerModeProvider({
        metadata: {
            id: "editor",
            label: "Editor",
            summary: "Interaktiver Hex-Map Editor mit Werkzeugpalette und Live-Vorschau.",
            keywords: ["map", "edit", "hex"],
            order: 200,
            source: "core/cartographer/editor",
            version: "1.0.0",
            capabilities: {
                mapInteraction: "hex-click",
                persistence: "read-only",
                sidebar: "required",
            },
        },
        async load() {
            const { createEditorMode } = await import("../../modes/editor");
            return createEditorMode();
        },
    });
