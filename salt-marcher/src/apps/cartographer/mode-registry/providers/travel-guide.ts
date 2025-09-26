import type { CartographerModeProvider } from "../registry";

export const createTravelGuideModeProvider = (): CartographerModeProvider => ({
    metadata: {
        id: "travel-guide",
        label: "Travel Guide",
        summary: "Präsentiert Kurzinformationen und Kartenabschnitte für Reisende.",
        keywords: ["travel", "guide", "summary"],
        order: 100,
        source: "core/cartographer/travel-guide",
        version: "1.0.0",
    },
    async load() {
        const { createTravelGuideMode } = await import("../../modes/travel-guide");
        return createTravelGuideMode();
    },
});
