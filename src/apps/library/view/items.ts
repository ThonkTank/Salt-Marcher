// src/apps/library/view/items.ts
// Rendert Items mit einheitlicher View-Konfiguration.
import type { App } from "obsidian";
import type { ModeRenderer } from "./mode";
import { FilterableLibraryRenderer } from "./filterable-mode";
import type { LibrarySourceWatcherHub } from "./mode";

export class ItemsRenderer extends FilterableLibraryRenderer<"items"> implements ModeRenderer {
    constructor(app: App, container: HTMLElement, watchers: LibrarySourceWatcherHub) {
        super(app, container, watchers, "items");
    }
}
