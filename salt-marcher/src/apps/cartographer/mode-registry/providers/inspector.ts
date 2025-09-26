import type { CartographerModeProvider } from "../registry";

export const createInspectorModeProvider = (): CartographerModeProvider => ({
    metadata: {
        id: "inspector",
        label: "Inspector",
        summary: "Liest bestehende Karten und stellt Metadaten sowie Hex-Details dar.",
        keywords: ["inspect", "metadata", "analyze"],
        order: 300,
        source: "core/cartographer/inspector",
        version: "1.0.0",
    },
    async load() {
        const { createInspectorMode } = await import("../../modes/inspector");
        return createInspectorMode();
    },
});
