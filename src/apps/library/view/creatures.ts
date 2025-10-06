// src/apps/library/view/creatures.ts
// Rendert Kreaturen und legt neue Dateien an.
import type { TFile } from "obsidian";
import type { ModeRenderer } from "./mode";
import { BaseModeRenderer, scoreName } from "./mode";
import { listCreatureFiles, watchCreatureDir, createCreatureFile, type StatblockData } from "../core/creature-files";
import { loadCreaturePreset } from "../core/creature-presets";
import { CreateCreatureModal } from "../create";

interface CreatureMetadata {
    name: string;
    file: TFile;
    type?: string;
    cr?: string;
}

async function getCreatureMetadata(app: any, file: TFile): Promise<CreatureMetadata> {
    const cache = app.metadataCache.getFileCache(file);
    let fm = cache?.frontmatter;

    // If no cache or frontmatter, try to read file directly
    if (!fm) {
        try {
            const content = await app.vault.read(file);
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (frontmatterMatch) {
                const frontmatterText = frontmatterMatch[1];
                // Parse simple YAML manually for type and cr
                const typeMatch = frontmatterText.match(/^type:\s*"?(.+?)"?\s*$/m);
                const crMatch = frontmatterText.match(/^cr:\s*"?(.+?)"?\s*$/m);

                fm = {
                    type: typeMatch ? typeMatch[1] : undefined,
                    cr: crMatch ? crMatch[1] : undefined
                };

                console.log(`Parsed frontmatter for ${file.basename}:`, fm);
            }
        } catch (e) {
            console.error(`Error reading file ${file.path}:`, e);
        }
    } else {
        console.log(`Using cached frontmatter for ${file.basename}:`, fm);
    }

    return {
        name: file.basename,
        file: file,
        type: fm?.type,
        cr: fm?.cr,
    };
}

// Helper function to parse CR for numerical comparison
function parseCR(cr: string): number {
    if (cr.includes('/')) {
        const [num, denom] = cr.split('/').map(Number);
        return num / denom;
    }
    return Number(cr) || 0;
}

// Helper function to apply sorting to items
function applySorting<T extends { name: string; type: string; cr: string; score: number }>(
    items: T[],
    sortBy: "name" | "type" | "cr",
    sortDirection: "asc" | "desc",
    query: string
): void {
    items.sort((a, b) => {
        // If there's a search query, prioritize score
        if (query && (a.score !== b.score)) {
            return b.score - a.score;
        }

        let comparison = 0;

        // Apply primary sort
        switch (sortBy) {
            case "name":
                comparison = a.name.localeCompare(b.name);
                break;
            case "type":
                comparison = a.type.localeCompare(b.type);
                // Secondary sort by name if types are equal
                if (comparison === 0) {
                    comparison = a.name.localeCompare(b.name);
                }
                break;
            case "cr":
                comparison = parseCR(a.cr) - parseCR(b.cr);
                // Secondary sort by name if CRs are equal
                if (comparison === 0) {
                    comparison = a.name.localeCompare(b.name);
                }
                break;
        }

        // Apply sort direction
        return sortDirection === "asc" ? comparison : -comparison;
    });
}

export class CreaturesRenderer extends BaseModeRenderer implements ModeRenderer {
    readonly mode = "creatures" as const;
    private files: TFile[] = [];
    private filterType: string = "";
    private filterCR: string = "";
    private sortBy: "name" | "type" | "cr" = "name";
    private sortDirection: "asc" | "desc" = "asc";

    async init(): Promise<void> {
        this.files = await listCreatureFiles(this.app);

        const stop = watchCreatureDir(this.app, async () => {
            this.files = await listCreatureFiles(this.app);
            if (!this.isDisposed()) this.render();
        });
        this.registerCleanup(stop);
    }

    async render(): Promise<void> {
        if (this.isDisposed()) return;
        const list = this.container;
        list.empty();
        const q = this.query;

        // Collect all creature metadata
        const allMetadata = await Promise.all(this.files.map(f => getCreatureMetadata(this.app, f)));

        // Collect unique types and CRs for filter dropdowns
        const allTypes = new Set<string>();
        const allCRs = new Set<string>();
        allMetadata.forEach(m => {
            if (m.type) allTypes.add(m.type);
            if (m.cr) allCRs.add(m.cr);
        });

        // Debug: Log collected types and CRs
        console.log("Collected types:", Array.from(allTypes));
        console.log("Collected CRs:", Array.from(allCRs));
        console.log("Total creatures:", allMetadata.length);

        // Controls Container for filters and sorting
        const controlsContainer = list.createDiv({ cls: "sm-cc-controls" });

        // Render filter UI
        const filterContainer = controlsContainer.createDiv({ cls: "sm-cc-filters" });
        filterContainer.createEl("h4", { text: "Filter", cls: "sm-cc-section-header" });

        const filterContent = filterContainer.createDiv({ cls: "sm-cc-filter-content" });

        // Type filter
        const typeFilterWrapper = filterContent.createDiv({ cls: "sm-cc-filter" });
        typeFilterWrapper.createEl("label", { text: "Type: " });
        const typeSelect = typeFilterWrapper.createEl("select");
        typeSelect.createEl("option", { text: "All", value: "" });
        Array.from(allTypes).sort().forEach(type => {
            typeSelect.createEl("option", { text: type, value: type });
        });
        typeSelect.value = this.filterType;
        typeSelect.onchange = () => {
            this.filterType = typeSelect.value;
            this.render();
        };

        // CR filter
        const crFilterWrapper = filterContent.createDiv({ cls: "sm-cc-filter" });
        crFilterWrapper.createEl("label", { text: "CR: " });
        const crSelect = crFilterWrapper.createEl("select");
        crSelect.createEl("option", { text: "All", value: "" });

        // Sort CRs numerically (handle fractions)
        const sortedCRs = Array.from(allCRs).sort((a, b) => {
            const parseRC = (cr: string): number => {
                if (cr.includes('/')) {
                    const [num, denom] = cr.split('/').map(Number);
                    return num / denom;
                }
                return Number(cr);
            };
            return parseRC(a) - parseRC(b);
        });

        sortedCRs.forEach(cr => {
            crSelect.createEl("option", { text: cr, value: cr });
        });
        crSelect.value = this.filterCR;
        crSelect.onchange = () => {
            this.filterCR = crSelect.value;
            this.render();
        };

        // Clear filters button
        if (this.filterType || this.filterCR) {
            const clearBtn = filterContent.createEl("button", { text: "Clear filters", cls: "sm-cc-clear-filters" });
            clearBtn.onclick = () => {
                this.filterType = "";
                this.filterCR = "";
                this.render();
            };
        }

        // Render sorting UI
        const sortContainer = controlsContainer.createDiv({ cls: "sm-cc-sorting" });
        sortContainer.createEl("h4", { text: "Sort", cls: "sm-cc-section-header" });

        const sortContent = sortContainer.createDiv({ cls: "sm-cc-sort-content" });

        // Sort by dropdown
        const sortByWrapper = sortContent.createDiv({ cls: "sm-cc-sort" });
        sortByWrapper.createEl("label", { text: "Sort by: " });
        const sortSelect = sortByWrapper.createEl("select");
        sortSelect.createEl("option", { text: "Name", value: "name" });
        sortSelect.createEl("option", { text: "Type", value: "type" });
        sortSelect.createEl("option", { text: "CR", value: "cr" });
        sortSelect.value = this.sortBy;
        sortSelect.onchange = () => {
            this.sortBy = sortSelect.value as "name" | "type" | "cr";
            this.render();
        };

        // Sort direction toggle button
        const directionBtn = sortContent.createEl("button", {
            cls: "sm-cc-sort-direction",
            attr: { "aria-label": this.sortDirection === "asc" ? "Sort ascending" : "Sort descending" }
        });
        directionBtn.innerHTML = this.sortDirection === "asc" ? "↑" : "↓";
        directionBtn.title = this.sortDirection === "asc" ? "Ascending" : "Descending";
        directionBtn.onclick = () => {
            this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
            this.render();
        };

        // Process all creatures
        const items = allMetadata
            .filter(m => !this.filterType || m.type === this.filterType)
            .filter(m => !this.filterCR || m.cr === this.filterCR)
            .map(m => ({
                name: m.name,
                file: m.file,
                type: m.type || "",
                cr: m.cr || "0",
                score: scoreName(m.name.toLowerCase(), q),
            }))
            .filter(x => q ? x.score > -Infinity : true);

        // Apply sorting to all items
        applySorting(items, this.sortBy, this.sortDirection, q);

        // Render all creatures
        for (const it of items) {
            const row = list.createDiv({ cls: "sm-cc-item" });

            // Add name
            const nameContainer = row.createDiv({ cls: "sm-cc-item__name-container" });
            nameContainer.createDiv({ cls: "sm-cc-item__name", text: it.name });

            // Add type and CR info
            const infoContainer = row.createDiv({ cls: "sm-cc-item__info" });
            if (it.type) {
                infoContainer.createEl("span", { cls: "sm-cc-item__type", text: it.type });
            }
            if (it.cr) {
                infoContainer.createEl("span", { cls: "sm-cc-item__cr", text: `CR ${it.cr}` });
            }

            // Add action buttons
            const actionsContainer = row.createDiv({ cls: "sm-cc-item__actions" });

            const openBtn = actionsContainer.createEl("button", { text: "Open", cls: "sm-cc-item__action" });
            openBtn.onclick = async () => {
                await this.app.workspace.openLinkText(it.file.path, it.file.path, true);
            };

            const editBtn = actionsContainer.createEl("button", { text: "Edit", cls: "sm-cc-item__action sm-cc-item__action--edit" });
            editBtn.onclick = async () => {
                try {
                    const creatureData = await this.loadCreatureData(it.file);
                    new CreateCreatureModal(this.app, creatureData.name, async (data) => {
                        const file = await createCreatureFile(this.app, data);
                        this.files = await listCreatureFiles(this.app);
                        if (!this.isDisposed()) {
                            this.render();
                            await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
                        }
                    }, creatureData).open();
                } catch (err) {
                    console.error('Failed to load creature for editing:', err);
                }
            };
        }
    }

    /**
     * Load creature data from a file for editing
     */
    async loadCreatureData(file: TFile): Promise<StatblockData> {
        // Use the existing loadCreaturePreset function which works for any creature file
        return await loadCreaturePreset(this.app, file);
    }

    async handleCreate(name: string): Promise<void> {
        new CreateCreatureModal(this.app, name, async (data) => {
            const file = await createCreatureFile(this.app, data);
            this.files = await listCreatureFiles(this.app);
            if (!this.isDisposed()) {
                this.render();
                await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
            }
        }, undefined).open();
    }
}
