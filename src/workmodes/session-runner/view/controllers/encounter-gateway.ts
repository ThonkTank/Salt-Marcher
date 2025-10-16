// src/workmodes/session-runner/view/controllers/encounter-gateway.ts
// Öffnet Begegnungen aus dem Travel-Guide heraus.
import { Notice, type App, type WorkspaceLeaf } from "obsidian";
import { publishEncounterEvent } from "../../../encounter/session-store";
import {
    createEncounterEventFromTravel,
    type EncounterEventBuildOptions,
    type TravelEncounterContext,
} from "../../../encounter/event-builder";

interface EncounterModule {
    getCenterLeaf(app: App): WorkspaceLeaf;
    VIEW_ENCOUNTER: string;
}

let encounterModule: Promise<EncounterModule | null> | null = null;

function loadEncounterModule(): Promise<EncounterModule | null> {
    return Promise.all([
        import("../../../../ui/utils/layout"),
        import("../../../encounter/view"),
    ])
        .then(([layout, encounter]) => ({
            getCenterLeaf: layout.getCenterLeaf,
            VIEW_ENCOUNTER: encounter.VIEW_ENCOUNTER,
        }))
        .catch((err) => {
            console.error("[session-runner] failed to load encounter module", err);
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
    const issue = describeEncounterContextIssue(context);
    if (issue) {
        console.warn(`[session-runner] ${issue.log}`, context);
        new Notice(issue.message);
    } else if (context) {
        try {
            const event = await createEncounterEventFromTravel(app, context);
            if (event) {
                publishEncounterEvent(event);
            }
        } catch (err) {
            console.error("[session-runner] failed to publish encounter payload", err);
        }
    }
    const leaf = mod.getCenterLeaf(app);
    await leaf.setViewState({ type: mod.VIEW_ENCOUNTER, active: true });
    app.workspace.revealLeaf(leaf);
    return true;
}

interface EncounterContextIssue {
    message: string;
    log: string;
}

function describeEncounterContextIssue(
    context?: TravelEncounterContext,
): EncounterContextIssue | null {
    if (!context) {
        return {
            message: "Begegnung konnte nicht geöffnet werden: Es liegen keine Reisedaten vor.",
            log: "missing travel context for encounter",
        };
    }
    if (!context.mapFile) {
        return {
            message: "Begegnung enthält keine Kartendatei. Öffne die Karte erneut und versuche es nochmal.",
            log: "missing map file for encounter context",
        };
    }
    if (!context.state) {
        return {
            message: "Begegnung enthält keinen Reisezustand. Aktualisiere den Travel-Guide und versuche es erneut.",
            log: "missing travel state snapshot for encounter context",
        };
    }
    return null;
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
        console.error("[session-runner] failed to publish manual encounter", err);
    }
}
