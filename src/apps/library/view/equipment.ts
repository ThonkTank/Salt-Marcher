// src/apps/library/view/equipment.ts
// Rendert Equipment mit einheitlicher View-Konfiguration.
import type { App } from "obsidian";
import type { ModeRenderer } from "./mode";
import { FilterableLibraryRenderer } from "./filterable-mode";
import type { LibrarySourceWatcherHub } from "./mode";

export class EquipmentRenderer extends FilterableLibraryRenderer<"equipment"> implements ModeRenderer {
    constructor(app: App, container: HTMLElement, watchers: LibrarySourceWatcherHub) {
        super(app, container, watchers, "equipment");
    }
}
