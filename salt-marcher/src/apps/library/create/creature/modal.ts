// src/apps/library/create/creature/modal.ts
// Erstellt den zweispaltigen Kreaturen-Editor und koordiniert Abschnitts-Mounting.
import { App, Modal, Setting } from "obsidian";
import type { StatblockData } from "../../core/creature-files";
import { listSpellFiles } from "../../core/spell-files";
import { mountCreatureBasicsSection } from "./section-basics";
import { mountCreatureStatsAndSkillsSection } from "./section-stats-and-skills";
import { mountCreatureSensesAndDefensesSection } from "./section-senses-and-defenses";
import { mountEntriesSection } from "./section-entries";
import { mountSpellsKnownSection } from "./section-spells-known";

/**
 * Layoutplan des Editors:
 * - Kopfbereich mit Titel und kurzem Hinweis
 * - Zweispaltiges Grid: linke Spalte für Stammdaten & Attribute,
 *   rechte Spalte für Sinne/Verteidigung sowie Zauberlisten
 * - Einträge (Traits, Aktionen, …) spannen über beide Spalten
 * - Abschlussbereich mit klar getrennten Aktionsbuttons
 */

export class CreateCreatureModal extends Modal {
    private data: StatblockData;
    private onSubmit: (d: StatblockData) => void;
    private availableSpells: string[] = [];
    private _bgEl?: HTMLElement; private _bgPrevPointer?: string;
    private validators: Array<() => string[]> = [];

    constructor(app: App, presetName: string | undefined, onSubmit: (d: StatblockData) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.data = { name: presetName?.trim() || "Neue Kreatur" };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-cc-create-modal");
        this.validators = [];

        // Prevent closing on outside click by disabling background pointer events
        const bg = document.querySelector('.modal-bg') as HTMLElement | null;
        if (bg) { this._bgEl = bg; this._bgPrevPointer = bg.style.pointerEvents; bg.style.pointerEvents = 'none'; }

        // (Dropdown-Suche entfernt — stattdessen echte Typeahead an Stellen mit vielen Optionen)

        const header = contentEl.createDiv({ cls: "sm-cc-modal-header" });
        header.createEl("h2", { text: "Neuen Statblock erstellen" });
        header.createEl("p", {
            cls: "sm-cc-modal-subtitle",
            text: "Pflege zuerst Grundlagen und Attribute, anschließend Sinne, Verteidigungen und Aktionen.",
        });

        const layout = contentEl.createDiv({ cls: "sm-cc-layout" });
        const mainColumn = layout.createDiv({ cls: "sm-cc-layout__col sm-cc-layout__col--main" });
        const sideColumn = layout.createDiv({ cls: "sm-cc-layout__col sm-cc-layout__col--side" });
        const fullColumn = layout.createDiv({ cls: "sm-cc-layout__col sm-cc-layout__col--full" });

        const createCard = (column: HTMLElement, title: string, subtitle?: string) => {
            const card = column.createDiv({ cls: "sm-cc-card" });
            const head = card.createDiv({ cls: "sm-cc-card__head" });
            head.createEl("h3", { text: title, cls: "sm-cc-card__title" });
            if (subtitle) head.createEl("p", { text: subtitle, cls: "sm-cc-card__subtitle" });
            const validation = card.createDiv({ cls: "sm-cc-card__validation", attr: { hidden: "" } });
            const validationList = validation.createEl("ul", { cls: "sm-cc-card__validation-list" });
            const applyValidation = (issues: string[]) => {
                const hasIssues = issues.length > 0;
                card.toggleClass("is-invalid", hasIssues);
                if (!hasIssues) {
                    validation.setAttribute("hidden", "");
                    validation.classList.remove("is-visible");
                    validationList.empty();
                    return;
                }
                validation.removeAttribute("hidden");
                validation.classList.add("is-visible");
                validationList.empty();
                for (const message of issues) {
                    validationList.createEl("li", { text: message });
                }
            };
            const registerValidation = (compute: () => string[]) =>
                this.addValidator(() => {
                    const issues = compute();
                    applyValidation(issues);
                    return issues;
                });
            const body = card.createDiv({ cls: "sm-cc-card__body" });
            return { body, registerValidation } as const;
        };

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

        const basicsCard = createCard(mainColumn, "Grunddaten", "Name, Typ, Gesinnung und Basiswerte");
        mountCreatureBasicsSection(basicsCard.body, this.data);

        const statsCard = createCard(mainColumn, "Attribute & Fertigkeiten");
        mountCreatureStatsAndSkillsSection(statsCard.body, this.data, statsCard.registerValidation);

        const defensesCard = createCard(sideColumn, "Sinne & Verteidigungen");
        mountCreatureSensesAndDefensesSection(defensesCard.body, this.data);

        const spellsCard = createCard(sideColumn, "Zauber & Fähigkeiten");
        spellsSectionControls = mountSpellsKnownSection(spellsCard.body, this.data, () => this.availableSpells);

        const entriesCard = createCard(fullColumn, "Einträge", "Traits, Aktionen, Bonusaktionen, Reaktionen und Legendäres");
        mountEntriesSection(entriesCard.body, this.data, entriesCard.registerValidation);

        // Buttons
        const footer = contentEl.createDiv({ cls: "sm-cc-modal-footer" });
        new Setting(footer)
            .addButton(b => b.setButtonText("Abbrechen").onClick(() => this.close()))
            .addButton(b => b.setCta().setButtonText("Erstellen").onClick(() => this.submit()));

        // Enter bestätigt NICHT automatisch (nur Button "Erstellen")
    }

    onClose() { this.contentEl.empty(); if (this._bgEl) { this._bgEl.style.pointerEvents = this._bgPrevPointer ?? ''; this._bgEl = undefined; } }

    onunload() {
        if (this._bgEl) { this._bgEl.style.pointerEvents = this._bgPrevPointer ?? ''; this._bgEl = undefined; }
    }

    private submit() {
        const issues = this.runValidators();
        if (issues.length) {
            const firstInvalid = this.contentEl.querySelector(".sm-cc-card.is-invalid") as HTMLElement | null;
            if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
        if (!this.data.name || !this.data.name.trim()) return;
        this.close();
        this.onSubmit(this.data);
    }

    private addValidator(run: () => string[]): () => string[] {
        this.validators.push(run);
        return run;
    }

    private runValidators(): string[] {
        const collected: string[] = [];
        for (const validator of this.validators) {
            collected.push(...validator());
        }
        return collected;
    }
}
