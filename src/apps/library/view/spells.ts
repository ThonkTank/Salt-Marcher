// src/apps/library/view/spells.ts
// Rendert Zauber-Einträge mit konfigurierbaren Filtern für Schule und Grad.
import type { App } from "obsidian";
import type { ModeRenderer } from "./mode";
import { createSpellFile, loadSpellFile, spellToMarkdown, type SpellData } from "../core/spell-files";
import { CreateSpellModal } from "../create";
import { FilterableLibraryRenderer } from "./filterable-mode";
import type { LibrarySourceWatcherHub } from "./mode";
import type { LibraryEntry } from "../core/data-sources";
import { formatSpellLevel } from "./filter-registry";

type SpellEntry = LibraryEntry<"spells">;

export class SpellsRenderer extends FilterableLibraryRenderer<"spells"> implements ModeRenderer {
    constructor(app: App, container: HTMLElement, watchers: LibrarySourceWatcherHub) {
        super(app, container, watchers, "spells");
    }

    protected renderEntry(row: HTMLElement, entry: SpellEntry): void {
        const table = row.createDiv({ cls: "sm-cc-spell" });
        const header = table.createDiv({ cls: "sm-cc-spell__header" });
        header.createDiv({ cls: "sm-cc-item__name", text: entry.name });

        const meta = table.createDiv({ cls: "sm-cc-spell__meta" });
        meta.createEl("span", { cls: "sm-cc-spell__level", text: formatSpellLevel(entry.level) });
        if (entry.school) {
            meta.createEl("span", { cls: "sm-cc-spell__school", text: entry.school });
        }
        if (entry.casting_time) {
            meta.createEl("span", { cls: "sm-cc-spell__casting", text: entry.casting_time });
        }
        if (entry.duration) {
            meta.createEl("span", { cls: "sm-cc-spell__duration", text: entry.duration });
        }
        const flags = meta.createDiv({ cls: "sm-cc-spell__flags" });
        if (entry.concentration) {
            flags.createEl("span", { cls: "sm-cc-spell__flag", text: "Concentration" });
        }
        if (entry.ritual) {
            flags.createEl("span", { cls: "sm-cc-spell__flag", text: "Ritual" });
        }

        const actions = table.createDiv({ cls: "sm-cc-item__actions" });
        const openBtn = actions.createEl("button", { text: "Open", cls: "sm-cc-item__action" });
        openBtn.onclick = async () => {
            await this.app.workspace.openLinkText(entry.file.path, entry.file.path, true);
        };

        const editBtn = actions.createEl("button", { text: "Edit", cls: "sm-cc-item__action sm-cc-item__action--edit" });
        editBtn.onclick = async () => {
            try {
                const spellData = await loadSpellFile(this.app, entry.file);
                new CreateSpellModal(this.app, spellData, async (data) => {
                    const content = spellToMarkdown(data);
                    await this.app.vault.modify(entry.file, content);
                    await this.reloadEntries();
                }).open();
            } catch (err) {
                console.error("Failed to load spell for editing", err);
            }
        };

        const copyBtn = actions.createEl("button", { text: "Copy", cls: "sm-cc-item__action" });
        copyBtn.onclick = async () => {
            try {
                const content = await this.app.vault.read(entry.file);
                if (navigator?.clipboard?.writeText) {
                    await navigator.clipboard.writeText(content);
                } else {
                    const textarea = document.createElement("textarea");
                    textarea.value = content;
                    textarea.setAttribute("readonly", "");
                    textarea.style.position = "absolute";
                    textarea.style.left = "-9999px";
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand("copy");
                    document.body.removeChild(textarea);
                }
            } catch (err) {
                console.error("Failed to copy spell", err);
            }
        };
    }

    async handleCreate(name: string): Promise<void> {
        const preset = this.buildSpellPreset(name);
        new CreateSpellModal(this.app, preset, async (data) => {
            const file = await createSpellFile(this.app, data);
            await this.reloadEntries();
            await this.app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
        }).open();
    }

    private buildSpellPreset(name: string): SpellData {
        const trimmed = name.trim();
        const preset: SpellData = { name: trimmed || "Neuer Zauber" };
        const levelFilter = this.getFilterSelection("level");
        if (levelFilter) {
            const parsed = Number(levelFilter);
            if (Number.isFinite(parsed)) preset.level = parsed;
        }
        const schoolFilter = this.getFilterSelection("school");
        if (schoolFilter) preset.school = schoolFilter;
        const ritualFilter = this.getFilterSelection("ritual");
        if (ritualFilter === "true") preset.ritual = true;
        if (ritualFilter === "false") preset.ritual = false;
        return preset;
    }
}
