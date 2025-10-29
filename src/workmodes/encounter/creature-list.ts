// src/workmodes/encounter/creature-list.ts
// UI component for selecting creatures from the Library to add to encounters.

import type { App } from "obsidian";
import { LIBRARY_DATA_SOURCES } from "../library/storage/data-sources";
import { logger } from "../../app/plugin-logger";
import type { Difficulty } from "./generator";

export interface CreatureListItem {
    readonly name: string;
    readonly cr: number;
    readonly type?: string;
    readonly path: string;
}

export interface CreatureListCallbacks {
    onAddCreature: (creature: CreatureListItem) => void;
    onGenerateEncounter?: (difficulty: Difficulty) => void;
}

export class EncounterCreatureList {
    private readonly app: App;
    private readonly containerEl: HTMLElement;
    private readonly callbacks: CreatureListCallbacks;

    private creatures: CreatureListItem[] = [];
    private listEl!: HTMLDivElement;
    private searchInput!: HTMLInputElement;
    private filteredCreatures: CreatureListItem[] = [];
    private difficultySelect!: HTMLSelectElement;
    private generateButton!: HTMLButtonElement;
    private currentDifficulty: Difficulty = "medium";

    // Faction members
    private factionMembers: CreatureListItem[] = [];
    private factionMembersSection!: HTMLDivElement;
    private factionName: string | null = null;

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

        // Generate encounter controls
        if (this.callbacks.onGenerateEncounter) {
            const generateRow = this.containerEl.createDiv({ cls: "sm-encounter-generate-row" });

            const difficultyGroup = generateRow.createDiv({ cls: "sm-encounter-generate-difficulty" });
            difficultyGroup.createEl("label", { text: "Difficulty:", cls: "sm-encounter-label" });

            this.difficultySelect = difficultyGroup.createEl("select", {
                cls: "sm-encounter-select",
            }) as HTMLSelectElement;

            const difficulties: Array<{ value: Difficulty; label: string }> = [
                { value: "easy", label: "Easy" },
                { value: "medium", label: "Medium" },
                { value: "hard", label: "Hard" },
                { value: "deadly", label: "Deadly" }
            ];

            for (const diff of difficulties) {
                const option = this.difficultySelect.createEl("option", {
                    value: diff.value,
                    text: diff.label
                });
                if (diff.value === this.currentDifficulty) {
                    option.selected = true;
                }
            }

            this.difficultySelect.addEventListener("change", () => {
                this.currentDifficulty = this.difficultySelect.value as Difficulty;
            });

            this.generateButton = generateRow.createEl("button", {
                cls: "sm-encounter-button sm-encounter-button-primary",
                text: "🎲 Generate Random Encounter",
                attr: {
                    title: "Generate encounter based on current hex (Faction, Terrain, Region)"
                }
            }) as HTMLButtonElement;
            this.generateButton.type = "button";
            this.generateButton.addEventListener("click", () => this.handleGenerateClick());
        }

        // Faction Members Section (conditionally rendered)
        this.factionMembersSection = this.containerEl.createDiv({ cls: "sm-encounter-faction-members" });

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
        this.renderFactionMembers(); // Initial render (will be empty until setFactionName called)
    }

    private handleGenerateClick() {
        if (!this.callbacks.onGenerateEncounter) return;

        // Disable button during generation
        this.setGenerateButtonState(true);

        try {
            this.callbacks.onGenerateEncounter(this.currentDifficulty);
        } catch (err) {
            logger.error("[creature-list] Generate encounter failed", err);
            this.setGenerateButtonState(false);
        }
    }

    setGenerateButtonState(loading: boolean) {
        if (!this.generateButton) return;
        this.generateButton.disabled = loading;
        this.generateButton.setText(loading ? "Generating..." : "🎲 Generate Random Encounter");
    }

    setGenerateButtonEnabled(enabled: boolean) {
        if (!this.generateButton) return;
        this.generateButton.disabled = !enabled;
        if (!enabled) {
            this.generateButton.setAttribute("title", "No travel context available (travel required)");
        } else {
            this.generateButton.setAttribute("title", "Generate encounter based on current hex (Faction, Terrain, Region)");
        }
    }

    unmount() {
        this.containerEl.empty();
        this.creatures = [];
        this.filteredCreatures = [];
        this.factionMembers = [];
        this.factionName = null;
    }

    /**
     * Sets faction members to display in separate section.
     * Call this whenever the hex faction changes.
     */
    setFactionMembers(members: CreatureListItem[], factionName: string | null) {
        this.factionMembers = members;
        this.factionName = factionName;
        this.renderFactionMembers();
    }

    private renderFactionMembers() {
        this.factionMembersSection.empty();

        // Hide section if no members
        if (!this.factionMembers.length || !this.factionName) {
            this.factionMembersSection.style.display = "none";
            return;
        }

        this.factionMembersSection.style.display = "block";

        // Header
        const header = this.factionMembersSection.createDiv({ cls: "sm-encounter-faction-members-header" });
        header.createEl("h4", {
            text: `${this.factionName} Members (${this.factionMembers.length})`,
            cls: "sm-encounter-section-subtitle"
        });

        // Member list
        const membersList = this.factionMembersSection.createDiv({ cls: "sm-encounter-faction-members-list" });

        for (const member of this.factionMembers) {
            const row = membersList.createDiv({ cls: "sm-encounter-creature-item sm-encounter-faction-member-item" });

            const nameEl = row.createDiv({ cls: "sm-encounter-creature-name" });
            nameEl.setText(member.name);

            // Badge to distinguish faction members
            const badge = nameEl.createSpan({ cls: "sm-faction-member-badge", text: "Faction Member" });

            const metaEl = row.createDiv({ cls: "sm-encounter-creature-meta" });
            metaEl.createSpan({ cls: "sm-encounter-creature-cr", text: `CR ${formatCR(member.cr)}` });
            if (member.type) {
                metaEl.createSpan({ cls: "sm-encounter-creature-type", text: member.type });
            }

            const addButton = row.createEl("button", {
                cls: "sm-encounter-button sm-encounter-button-primary",
                text: "Add",
            });
            addButton.type = "button";
            addButton.addEventListener("click", () => {
                this.callbacks.onAddCreature(member);
            });
        }
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
