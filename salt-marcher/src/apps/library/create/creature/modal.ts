// src/apps/library/create/creature/modal.ts
// Erstellt den zweispaltigen Kreaturen-Editor und koordiniert Abschnitts-Mounting.
import { App, Modal, Setting } from "obsidian";
import type { StatblockData } from "../../core/creature-files";
import { listSpellFiles } from "../../core/spell-files";
import { mountCreatureClassificationSection, mountCreatureVitalSection } from "./section-basics";
import { mountCreatureStatsAndSkillsSection } from "./section-stats-and-skills";
import { mountCreatureSensesAndDefensesSection } from "./section-senses-and-defenses";
import { mountEntriesSection } from "./section-entries";
import { mountCreatureSpellcastingSection } from "./section-spellcasting";
import { createFormCard } from "../shared/layouts";

/**
 * Layoutplan des Editors:
 * - Kopfbereich mit Titel und kurzem Hinweis
 * - Zweispaltiges Grid: linke Spalte für Stammdaten & Vitalwerte,
 *   rechte Spalte für Sinne/Verteidigung sowie Spellcasting
 * - Attribute/Fertigkeiten und Einträge spannen über beide Spalten
 * - Abschlussbereich mit klar getrennten Aktionsbuttons
 */

export class CreateCreatureModal extends Modal {
    private data: StatblockData;
    private onSubmit: (d: StatblockData) => void;
    private availableSpells: string[] = [];
    private bgLock: { el: HTMLElement; pointer: string } | null = null;
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

        this.lockBackgroundPointer();

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

        const createCard = (column: HTMLElement, title: string, subtitle?: string) =>
            createFormCard(column, {
                title,
                subtitle,
                registerValidator: (runner) => this.addValidator(runner),
            });

        // Asynchron: verfügbare Zauber laden (best effort)
        let spellcastingControls: ReturnType<typeof mountCreatureSpellcastingSection> | null = null;
        void listSpellFiles(this.app)
            .then(files => files.map(f => f.basename).sort((a, b) => a.localeCompare(b)))
            .then(spells => {
                this.availableSpells.splice(0, this.availableSpells.length, ...spells);
                spellcastingControls?.setAvailableSpells(spells);
            })
            .catch(() => {});

        const classificationCard = createCard(mainColumn, "Grunddaten", "Name, Typ, Gesinnung und Tags");
        mountCreatureClassificationSection(classificationCard.body, this.data);

        const vitalsCard = createCard(mainColumn, "Vitalwerte", "AC, HP, Initiative und Bewegung");
        mountCreatureVitalSection(vitalsCard.body, this.data);

        const defensesCard = createCard(sideColumn, "Sinne & Verteidigungen");
        mountCreatureSensesAndDefensesSection(defensesCard.body, this.data);

        const spellcastingCard = createCard(sideColumn, "Spellcasting", "Zauberlisten, Nutzungen und Notizen");
        spellcastingControls = mountCreatureSpellcastingSection(spellcastingCard.body, this.data, {
            getAvailableSpells: () => this.availableSpells,
            registerValidation: spellcastingCard.registerValidation,
        });

        const statsCard = createCard(fullColumn, "Attribute & Fertigkeiten");
        mountCreatureStatsAndSkillsSection(statsCard.body, this.data, statsCard.registerValidation);

        const entriesCard = createCard(fullColumn, "Einträge", "Traits, Aktionen, Bonusaktionen, Reaktionen und Legendäres");
        mountEntriesSection(entriesCard.body, this.data, entriesCard.registerValidation);

        // Buttons
        const footer = contentEl.createDiv({ cls: "sm-cc-modal-footer" });
        new Setting(footer)
            .addButton(b => b.setButtonText("Abbrechen").onClick(() => this.close()))
            .addButton(b => b.setCta().setButtonText("Erstellen").onClick(() => this.submit()));

        // Enter bestätigt NICHT automatisch (nur Button "Erstellen")
    }

    onClose() { this.contentEl.empty(); this.restoreBackgroundPointer(); }

    onunload() { this.restoreBackgroundPointer(); }

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

    private lockBackgroundPointer() {
        const bg = document.querySelector('.modal-bg') as HTMLElement | null;
        if (!bg) return;
        this.bgLock = { el: bg, pointer: bg.style.pointerEvents };
        bg.style.pointerEvents = 'none';
    }

    private restoreBackgroundPointer() {
        if (!this.bgLock) return;
        this.bgLock.el.style.pointerEvents = this.bgLock.pointer || '';
        this.bgLock = null;
    }
}
