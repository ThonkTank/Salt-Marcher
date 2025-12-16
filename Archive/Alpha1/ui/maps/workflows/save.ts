// src/core/save.ts
import type { App, TFile } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('ui-map-save');

/** Platzhalter: echte Persistenz später implementieren. */
export async function saveMap(_app: App, file: TFile): Promise<void> {
    logger.warn("saveMap() not implemented. File:", file.path);
    // TODO: Inhalte aus Editor-state in die Map/Tiles schreiben
}

export async function saveMapAs(_app: App, file: TFile): Promise<void> {
    logger.warn("saveMapAs() not implemented. File:", file.path);
    // TODO: Dialog + neuen Pfad + speichern
}
