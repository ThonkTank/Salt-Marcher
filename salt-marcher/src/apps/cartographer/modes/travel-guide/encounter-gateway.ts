// src/apps/cartographer/modes/travel-guide/encounter-gateway.ts
// Öffnet Begegnungen aus dem Travel-Guide heraus.
import { Notice, type App, type WorkspaceLeaf } from "obsidian";
import { publishEncounterEvent } from "../../../encounter/session-store";
import {
    createEncounterEventFromTravel,
    type EncounterEventBuildOptions,
    type TravelEncounterContext,
} from "../../../encounter/event-builder";

interface EncounterModule {
    getRightLeaf(app: App): WorkspaceLeaf;
    VIEW_ENCOUNTER: string;
}

let encounterModule: Promise<EncounterModule | null> | null = null;

function loadEncounterModule(): Promise<EncounterModule | null> {
    return Promise.all([
        import("../../../../core/layout"),
        import("../../../encounter/view"),
    ])
        .then(([layout, encounter]) => ({
            getRightLeaf: layout.getRightLeaf,
            VIEW_ENCOUNTER: encounter.VIEW_ENCOUNTER,
        }))
        .catch((err) => {
            console.error("[travel-mode] failed to load encounter module", err);
            new Notice("Encounter-Modul konnte nicht geladen werden.");
            return null;
        });
}

function ensureEncounterModule(): Promise<EncounterModule | null> {
    if (!encounterModule) {
        encounterModule = loadEncounterModule();
    }
    return encounterModule;
}

export function preloadEncounterModule() {
    void ensureEncounterModule();
}

export async function openEncounter(app: App, context?: TravelEncounterContext): Promise<boolean> {
    const mod = await ensureEncounterModule();
    if (!mod) return false;
    if (context) {
        try {
            const event = await createEncounterEventFromTravel(app, context);
            if (event) {
                publishEncounterEvent(event);
            }
        } catch (err) {
            console.error("[travel-mode] failed to publish encounter payload", err);
        }
    }
    const leaf = mod.getRightLeaf(app);
    await leaf.setViewState({ type: mod.VIEW_ENCOUNTER, active: true });
    app.workspace.revealLeaf(leaf);
    return true;
}

export async function publishManualEncounter(
    app: App,
    context: TravelEncounterContext,
    options: EncounterEventBuildOptions = {},
) {
    try {
        const event = await createEncounterEventFromTravel(app, context, {
            source: "manual",
            idPrefix: options.idPrefix ?? "manual",
            coordOverride: options.coordOverride,
            triggeredAt: options.triggeredAt,
        });
        if (event) {
            publishEncounterEvent(event);
        }
    } catch (err) {
        console.error("[travel-mode] failed to publish manual encounter", err);
    }
}
