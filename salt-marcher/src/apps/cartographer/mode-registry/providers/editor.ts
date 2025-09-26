import type { CartographerModeProvider } from "../registry";

export const createEditorModeProvider = (): CartographerModeProvider => ({
    metadata: {
        id: "editor",
        label: "Editor",
        summary: "Interaktiver Hex-Map Editor mit Werkzeugpalette und Live-Vorschau.",
        keywords: ["map", "edit", "hex"],
        order: 200,
        source: "core/cartographer/editor",
        version: "1.0.0",
    },
    async load() {
        const { createEditorMode } = await import("../../modes/editor");
        return createEditorMode();
    },
});
