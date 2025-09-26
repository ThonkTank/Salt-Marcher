import { defineCartographerModeProvider } from "../registry";

export const createTravelGuideModeProvider = () =>
    defineCartographerModeProvider({
        metadata: {
            id: "travel",
            label: "Travel",
            summary: "Präsentiert Kurzinformationen und Kartenabschnitte für Reisende.",
            keywords: ["travel", "guide", "summary"],
            order: 100,
            source: "core/cartographer/travel-guide",
            version: "1.0.0",
            capabilities: {
                mapInteraction: "hex-click",
                persistence: "manual-save",
                sidebar: "required",
            },
        },
        async load() {
            const { createTravelGuideMode } = await import("../../modes/travel-guide");
            return createTravelGuideMode();
        },
    });
