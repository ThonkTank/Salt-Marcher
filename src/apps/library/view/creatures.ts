// src/apps/library/view/creatures.ts
// Rendert Kreaturen mit einheitlicher View-Konfiguration.
import type { App } from "obsidian";
import type { ModeRenderer } from "./mode";
import { FilterableLibraryRenderer } from "./filterable-mode";
import type { LibrarySourceWatcherHub } from "./mode";

export class CreaturesRenderer extends FilterableLibraryRenderer<"creatures"> implements ModeRenderer {
    constructor(app: App, container: HTMLElement, watchers: LibrarySourceWatcherHub) {
        super(app, container, watchers, "creatures");
    }
}
