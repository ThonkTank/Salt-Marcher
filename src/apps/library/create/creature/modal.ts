// src/apps/library/create/creature/modal.ts
import { App, Modal, Setting } from "obsidian";
import type { StatblockData } from "../../core/creature-files";
import { listSpellFiles } from "../../core/spell-files";
import { mountCreatureBasicsSection } from "./section-basics";
import { mountCreatureStatsAndSkillsSection } from "./section-stats-and-skills";
import { mountCreatureSensesAndDefensesSection } from "./section-senses-and-defenses";
import { mountEntriesSection } from "./section-entries";
import { mountSpellsKnownSection } from "./section-spells-known";

export class CreateCreatureModal extends Modal {
    private data: StatblockData;
    private onSubmit: (d: StatblockData) => void;
    private availableSpells: string[] = [];
    private _bgEl?: HTMLElement; private _bgPrevPointer?: string;

    constructor(app: App, presetName: string | undefined, onSubmit: (d: StatblockData) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.data = { name: presetName?.trim() || "Neue Kreatur" };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-cc-create-modal");

        // Prevent closing on outside click by disabling background pointer events
        const bg = document.querySelector('.modal-bg') as HTMLElement | null;
        if (bg) { this._bgEl = bg; this._bgPrevPointer = bg.style.pointerEvents; bg.style.pointerEvents = 'none'; }

        // (Dropdown-Suche entfernt — stattdessen echte Typeahead an Stellen mit vielen Optionen)

        contentEl.createEl("h3", { text: "Neuen Statblock erstellen" });
        // Asynchron: verfügbare Zauber laden (best effort)
        let spellsSectionControls: ReturnType<typeof mountSpellsKnownSection> | null = null;
        void (async () => {
            try {
                const spells = (await listSpellFiles(this.app)).map(f => f.basename).sort((a,b)=>a.localeCompare(b));
                this.availableSpells.splice(0, this.availableSpells.length, ...spells);
                spellsSectionControls?.refreshSpellMatches();
            }
            catch {}
        })();

        // Grundlagen, Stats und Verteidigungen modular aufbauen
        mountCreatureBasicsSection(contentEl, this.data);
        mountCreatureStatsAndSkillsSection(contentEl, this.data);
        mountCreatureSensesAndDefensesSection(contentEl, this.data);

        // Structured entries (Traits, Aktionen, …)
        mountEntriesSection(contentEl, this.data);

        // Known spells section
        spellsSectionControls = mountSpellsKnownSection(contentEl, this.data, () => this.availableSpells);

        // Buttons
        new Setting(contentEl)
            .addButton(b => b.setButtonText("Abbrechen").onClick(() => this.close()))
            .addButton(b => b.setCta().setButtonText("Erstellen").onClick(() => this.submit()));

        // Enter bestätigt NICHT automatisch (nur Button "Erstellen")
    }

    onClose() { this.contentEl.empty(); if (this._bgEl) { this._bgEl.style.pointerEvents = this._bgPrevPointer ?? ''; this._bgEl = undefined; } }

    onunload() {
        if (this._bgEl) { this._bgEl.style.pointerEvents = this._bgPrevPointer ?? ''; this._bgEl = undefined; }
    }

    private submit() {
        if (!this.data.name || !this.data.name.trim()) return;
        this.close();
        this.onSubmit(this.data);
    }
}
