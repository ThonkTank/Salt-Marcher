// src/workmodes/encounter/creature-list.ts
// UI component for selecting creatures from the Library to add to encounters.

import type { App } from "obsidian";
import { LIBRARY_DATA_SOURCES } from "../library/storage/data-sources";
import { logger } from "../../app/plugin-logger";

export interface CreatureListItem {
    readonly name: string;
    readonly cr: number;
    readonly type?: string;
    readonly path: string;
}

export interface CreatureListCallbacks {
    onAddCreature: (creature: CreatureListItem) => void;
}

export class EncounterCreatureList {
    private readonly app: App;
    private readonly containerEl: HTMLElement;
    private readonly callbacks: CreatureListCallbacks;

    private creatures: CreatureListItem[] = [];
    private listEl!: HTMLDivElement;
    private searchInput!: HTMLInputElement;
    private filteredCreatures: CreatureListItem[] = [];

    constructor(app: App, containerEl: HTMLElement, callbacks: CreatureListCallbacks) {
        this.app = app;
        this.containerEl = containerEl;
        this.callbacks = callbacks;
    }

    async mount() {
        this.containerEl.empty();
        this.containerEl.addClass("sm-encounter-creature-list");

        const header = this.containerEl.createDiv({ cls: "sm-encounter-creature-list-header" });
        header.createEl("h3", { text: "Add Creatures", cls: "sm-encounter-section-title" });

        const searchRow = this.containerEl.createDiv({ cls: "sm-encounter-creature-search" });
        this.searchInput = searchRow.createEl("input", {
            cls: "sm-encounter-input",
            attr: {
                type: "text",
                placeholder: "Search creatures...",
            },
        }) as HTMLInputElement;
        this.searchInput.addEventListener("input", () => this.applyFilter());

        this.listEl = this.containerEl.createDiv({ cls: "sm-encounter-creature-list-items" });

        await this.loadCreatures();
    }

    unmount() {
        this.containerEl.empty();
        this.creatures = [];
        this.filteredCreatures = [];
    }

    private async loadCreatures() {
        try {
            const files = await LIBRARY_DATA_SOURCES.creatures.list(this.app);
            const loaded: CreatureListItem[] = [];

            for (const file of files) {
                try {
                    const entry = await LIBRARY_DATA_SOURCES.creatures.load(this.app, file);
                    const cr = parseCR(entry.cr);
                    loaded.push({
                        name: entry.name,
                        cr,
                        type: entry.type,
                        path: file.path,
                    });
                } catch (err) {
                    logger.warn(`[creature-list] failed to load ${file.path}`, err);
                }
            }

            // Sort by CR, then by name
            loaded.sort((a, b) => {
                if (a.cr !== b.cr) return a.cr - b.cr;
                return a.name.localeCompare(b.name);
            });

            this.creatures = loaded;
            this.applyFilter();
        } catch (err) {
            logger.error("[creature-list] failed to load creatures", err);
            this.listEl.setText("Failed to load creatures from library.");
        }
    }

    private applyFilter() {
        const query = this.searchInput.value.toLowerCase().trim();
        if (!query) {
            this.filteredCreatures = this.creatures;
        } else {
            this.filteredCreatures = this.creatures.filter((creature) => {
                return creature.name.toLowerCase().includes(query) ||
                    creature.type?.toLowerCase().includes(query);
            });
        }
        this.renderList();
    }

    private renderList() {
        this.listEl.empty();

        if (!this.filteredCreatures.length) {
            this.listEl.createDiv({
                cls: "sm-encounter-empty-row",
                text: this.creatures.length
                    ? "No creatures match your search."
                    : "No creatures found in library.",
            });
            return;
        }

        for (const creature of this.filteredCreatures) {
            const row = this.listEl.createDiv({ cls: "sm-encounter-creature-item" });

            const nameEl = row.createDiv({ cls: "sm-encounter-creature-name" });
            nameEl.setText(creature.name);

            const metaEl = row.createDiv({ cls: "sm-encounter-creature-meta" });
            metaEl.createSpan({ cls: "sm-encounter-creature-cr", text: `CR ${formatCR(creature.cr)}` });
            if (creature.type) {
                metaEl.createSpan({ cls: "sm-encounter-creature-type", text: creature.type });
            }

            const addButton = row.createEl("button", {
                cls: "sm-encounter-button sm-encounter-button-primary",
                text: "Add",
            });
            addButton.type = "button";
            addButton.addEventListener("click", () => {
                this.callbacks.onAddCreature(creature);
            });
        }
    }
}

function parseCR(crString: string | undefined): number {
    if (!crString) return 0;
    const str = crString.trim();
    if (str.includes("/")) {
        const [num, denom] = str.split("/").map((s) => Number(s.trim()));
        if (Number.isFinite(num) && Number.isFinite(denom) && denom !== 0) {
            return num / denom;
        }
    }
    const num = Number(str);
    return Number.isFinite(num) ? num : 0;
}

function formatCR(cr: number): string {
    if (cr === 0.125) return "1/8";
    if (cr === 0.25) return "1/4";
    if (cr === 0.5) return "1/2";
    return String(cr);
}
