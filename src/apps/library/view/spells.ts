// src/apps/library/view/spells.ts
// Rendert Zauber-Einträge mit einheitlicher View-Konfiguration.
import type { App } from "obsidian";
import type { ModeRenderer } from "./mode";
import { FilterableLibraryRenderer } from "./filterable-mode";
import type { LibrarySourceWatcherHub } from "./mode";

export class SpellsRenderer extends FilterableLibraryRenderer<"spells"> implements ModeRenderer {
    constructor(app: App, container: HTMLElement, watchers: LibrarySourceWatcherHub) {
        super(app, container, watchers, "spells");
    }
}
