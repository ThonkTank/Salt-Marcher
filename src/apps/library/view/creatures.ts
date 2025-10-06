// src/apps/library/view/creatures.ts
// Rendert Kreaturen und bietet die generische Filter-Logik für weitere Library-Ansichten.
import type { TFile } from "obsidian";
import type { ModeRenderer } from "./mode";
import { loadCreaturePreset } from "../core/creature-presets";
import { createCreatureFile, listCreatureFiles, watchCreatureDir, type StatblockData } from "../core/creature-files";
import { CreateCreatureModal } from "../create";
import { FilterableLibraryRenderer, type FilterDefinition, type FilterableEntry, type SortDefinition } from "./filterable-mode";

interface CreatureMetadata extends FilterableEntry {
    type?: string;
    cr?: string;
}

async function getCreatureMetadata(app: any, file: TFile): Promise<CreatureMetadata> {
    const cache = app.metadataCache.getFileCache(file);
    let fm = cache?.frontmatter;

    if (!fm) {
        const content = await app.vault.read(file);
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
            const frontmatterText = frontmatterMatch[1];
            const typeMatch = frontmatterText.match(/^type:\s*"?(.+?)"?\s*$/m);
            const crMatch = frontmatterText.match(/^cr:\s*"?(.+?)"?\s*$/m);
            fm = {
                type: typeMatch ? typeMatch[1] : undefined,
                cr: crMatch ? crMatch[1] : undefined,
            };
        }
    }

    return {
        name: file.basename,
        file,
        type: fm?.type,
        cr: fm?.cr,
    };
}

function parseCR(cr?: string): number {
    if (!cr) return 0;
    if (cr.includes('/')) {
        const [num, denom] = cr.split('/').map(Number);
        return (num || 0) / (denom || 1);
    }
    const parsed = Number(cr);
    return Number.isFinite(parsed) ? parsed : 0;
}

export class CreaturesRenderer extends FilterableLibraryRenderer<CreatureMetadata> implements ModeRenderer {
    readonly mode = "creatures" as const;

    protected listSourceFiles(): Promise<TFile[]> {
        return listCreatureFiles(this.app);
    }

    protected watchSourceFiles(onChange: () => void): () => void {
        return watchCreatureDir(this.app, onChange);
    }

    protected loadEntry(file: TFile): Promise<CreatureMetadata> {
        return getCreatureMetadata(this.app, file);
    }

    protected getFilters(): FilterDefinition<CreatureMetadata>[] {
        return [
            {
                id: "type",
                label: "Type",
                getValues: entry => entry.type ? [entry.type] : [],
            },
            {
                id: "cr",
                label: "CR",
                getValues: entry => entry.cr ? [entry.cr] : [],
                sortComparator: (a, b) => parseCR(a) - parseCR(b),
            },
        ];
    }

    protected getSortOptions(): SortDefinition<CreatureMetadata>[] {
        return [
            {
                id: "name",
                label: "Name",
                compare: (a, b) => a.name.localeCompare(b.name),
            },
            {
                id: "type",
                label: "Type",
                compare: (a, b) => (a.type || "").localeCompare(b.type || "") || a.name.localeCompare(b.name),
            },
            {
                id: "cr",
                label: "CR",
                compare: (a, b) => parseCR(a.cr) - parseCR(b.cr) || a.name.localeCompare(b.name),
            },
        ];
    }

    protected getSearchCandidates(entry: CreatureMetadata): string[] {
        const extras = [entry.type, entry.cr].filter((val): val is string => Boolean(val));
        return [entry.name, ...extras];
    }

    protected renderEntry(row: HTMLElement, entry: CreatureMetadata): void {
        const nameContainer = row.createDiv({ cls: "sm-cc-item__name-container" });
        nameContainer.createDiv({ cls: "sm-cc-item__name", text: entry.name });

        const infoContainer = row.createDiv({ cls: "sm-cc-item__info" });
        if (entry.type) {
            infoContainer.createEl("span", { cls: "sm-cc-item__type", text: entry.type });
        }
        if (entry.cr) {
            infoContainer.createEl("span", { cls: "sm-cc-item__cr", text: `CR ${entry.cr}` });
        }

        const actions = row.createDiv({ cls: "sm-cc-item__actions" });
        const openBtn = actions.createEl("button", { text: "Open", cls: "sm-cc-item__action" });
        openBtn.onclick = async () => {
            await this.app.workspace.openLinkText(entry.file.path, entry.file.path, true);
        };

        const editBtn = actions.createEl("button", { text: "Edit", cls: "sm-cc-item__action sm-cc-item__action--edit" });
        editBtn.onclick = async () => {
            try {
                const creatureData = await this.loadCreatureData(entry.file);
                new CreateCreatureModal(this.app, creatureData.name, async (data) => {
                    const file = await createCreatureFile(this.app, data);
                    await this.refreshEntries();
                    if (!this.isDisposed()) {
                        this.render();
                        await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
                    }
                }, creatureData).open();
            } catch (err) {
                console.error("Failed to load creature for editing", err);
            }
        };
    }

    async handleCreate(name: string): Promise<void> {
        new CreateCreatureModal(this.app, name, async (data) => {
            const file = await createCreatureFile(this.app, data);
            await this.refreshEntries();
            if (!this.isDisposed()) {
                this.render();
                await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
            }
        }, undefined).open();
    }

    private async loadCreatureData(file: TFile): Promise<StatblockData> {
        return await loadCreaturePreset(this.app, file);
    }
}
