// src/apps/library/view/spells.ts
// Rendert Zauber-Einträge mit konfigurierbaren Filtern für Schule und Grad.
import type { TFile } from "obsidian";
import type { ModeRenderer } from "./mode";
import { createSpellFile, listSpellFiles, watchSpellDir } from "../core/spell-files";
import { CreateSpellModal } from "../create";
import { FilterableLibraryRenderer, type FilterDefinition, type FilterableEntry, type SortDefinition } from "./filterable-mode";

interface SpellMetadata extends FilterableEntry {
    school?: string;
    level?: number;
}

async function getSpellMetadata(app: any, file: TFile): Promise<SpellMetadata> {
    const cache = app.metadataCache.getFileCache(file);
    let fm = cache?.frontmatter;

    if (!fm) {
        const content = await app.vault.read(file);
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
            const frontmatterText = frontmatterMatch[1];
            const schoolMatch = frontmatterText.match(/^school:\s*"?(.+?)"?\s*$/m);
            const levelMatch = frontmatterText.match(/^level:\s*"?(-?\d+)"?\s*$/m);
            fm = {
                school: schoolMatch ? schoolMatch[1] : undefined,
                level: levelMatch ? Number(levelMatch[1]) : undefined,
            };
        }
    }

    const rawLevel = fm?.level;
    const level = typeof rawLevel === "number"
        ? rawLevel
        : typeof rawLevel === "string"
            ? Number(rawLevel)
            : undefined;

    return {
        name: file.basename,
        file,
        school: typeof fm?.school === "string" ? fm.school : undefined,
        level: Number.isFinite(level) ? level : undefined,
    };
}

function formatLevelLabel(level?: number): string {
    if (level == null) return "Unknown";
    if (level === 0) return "Cantrip";
    return `Level ${level}`;
}

export class SpellsRenderer extends FilterableLibraryRenderer<SpellMetadata> implements ModeRenderer {
    readonly mode = "spells" as const;

    protected listSourceFiles(): Promise<TFile[]> {
        return listSpellFiles(this.app);
    }

    protected watchSourceFiles(onChange: () => void): () => void {
        return watchSpellDir(this.app, onChange);
    }

    protected loadEntry(file: TFile): Promise<SpellMetadata> {
        return getSpellMetadata(this.app, file);
    }

    protected getFilters(): FilterDefinition<SpellMetadata>[] {
        return [
            {
                id: "school",
                label: "School",
                getValues: entry => entry.school ? [entry.school] : [],
            },
            {
                id: "level",
                label: "Level",
                getValues: entry => entry.level != null ? [String(entry.level)] : [],
                sortComparator: (a, b) => Number(a) - Number(b),
                formatOption: value => formatLevelLabel(Number(value)),
            },
        ];
    }

    protected getSortOptions(): SortDefinition<SpellMetadata>[] {
        return [
            {
                id: "name",
                label: "Name",
                compare: (a, b) => a.name.localeCompare(b.name),
            },
            {
                id: "level",
                label: "Level",
                compare: (a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name),
            },
            {
                id: "school",
                label: "School",
                compare: (a, b) => (a.school || "").localeCompare(b.school || "") || a.name.localeCompare(b.name),
            },
        ];
    }

    protected getSearchCandidates(entry: SpellMetadata): string[] {
        const extras = [entry.school, entry.level != null ? formatLevelLabel(entry.level) : undefined]
            .filter((val): val is string => Boolean(val));
        return [entry.name, ...extras];
    }

    protected renderEntry(row: HTMLElement, entry: SpellMetadata): void {
        const nameContainer = row.createDiv({ cls: "sm-cc-item__name-container" });
        nameContainer.createDiv({ cls: "sm-cc-item__name", text: entry.name });

        const infoContainer = row.createDiv({ cls: "sm-cc-item__info" });
        if (entry.school) {
            infoContainer.createEl("span", { cls: "sm-cc-item__type", text: entry.school });
        }
        infoContainer.createEl("span", { cls: "sm-cc-item__cr", text: formatLevelLabel(entry.level) });

        const actions = row.createDiv({ cls: "sm-cc-item__actions" });
        const openBtn = actions.createEl("button", { text: "Open", cls: "sm-cc-item__action" });
        openBtn.onclick = async () => {
            await this.app.workspace.openLinkText(entry.file.path, entry.file.path, true);
        };
    }

    async handleCreate(name: string): Promise<void> {
        new CreateSpellModal(this.app, name, async (data) => {
            const file = await createSpellFile(this.app, data);
            await this.refreshEntries();
            if (!this.isDisposed()) {
                this.render();
                await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
            }
        }).open();
    }
}
