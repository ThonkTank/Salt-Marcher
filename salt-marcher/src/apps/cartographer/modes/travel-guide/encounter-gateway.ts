import { Notice, type App, type WorkspaceLeaf } from "obsidian";

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

export async function openEncounter(app: App): Promise<boolean> {
    const mod = await ensureEncounterModule();
    if (!mod) return false;
    const leaf = mod.getRightLeaf(app);
    await leaf.setViewState({ type: mod.VIEW_ENCOUNTER, active: true });
    app.workspace.revealLeaf(leaf);
    return true;
}
