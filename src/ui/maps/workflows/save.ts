// src/core/save.ts
import type { App, TFile } from "obsidian";

/** Platzhalter: echte Persistenz später implementieren. */
export async function saveMap(_app: App, file: TFile): Promise<void> {
    console.warn("[save] saveMap() not implemented. File:", file.path);
    // TODO: Inhalte aus Editor-state in die Map/Tiles schreiben
}

export async function saveMapAs(_app: App, file: TFile): Promise<void> {
    console.warn("[save] saveMapAs() not implemented. File:", file.path);
    // TODO: Dialog + neuen Pfad + speichern
}
