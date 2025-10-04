// src/apps/library/create/creature/modal.ts
// Organisiert den Kreaturen-Editor als Shell-Layout mit Abschnittsnavigation und koordiniert Mounting.
import { App, Modal, Setting } from "obsidian";
import type { StatblockData } from "../../core/creature-files";
import { listSpellFiles } from "../../core/spell-files";
import { mountCreatureClassificationSection, mountCreatureVitalSection } from "./section-basics";
import { mountCreatureStatsAndSkillsSection } from "./section-stats-and-skills";
import { mountCreatureSensesAndDefensesSection } from "./section-senses-and-defenses";
import { mountEntriesSection } from "./section-entries";
import { mountCreatureSpellcastingSection } from "./section-spellcasting";
import { createFormCard } from "../shared/layouts";
import type { FormCardHandles } from "../shared/layouts";

/**
 * Layoutplan des Editors:
 * - Kopfbereich mit Titel und kurzem Hinweis
 * - Shell-Layout mit fixer Navigation links und Karten-Stack im Inhaltsbereich
 * - Abschnitte belegen standardmäßig die volle Inhaltsbreite; Navigation scrollt zu Kartenzielen
 * - Validierungspfade bleiben bei den Karten verankert und werden über die Navigation zugänglich
 * - Abschlussbereich mit klar getrennten Aktionsbuttons
 */

export class CreateCreatureModal extends Modal {
    private data: StatblockData;
    private onSubmit: (d: StatblockData) => void;
    private availableSpells: string[] = [];
    private bgLock: { el: HTMLElement; pointer: string } | null = null;
    private validators: Array<() => string[]> = [];
    private sectionObserver: IntersectionObserver | null = null;

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
        this.sectionObserver?.disconnect();
        this.sectionObserver = null;

        this.lockBackgroundPointer();

        // (Dropdown-Suche entfernt — stattdessen echte Typeahead an Stellen mit vielen Optionen)

        const header = contentEl.createDiv({ cls: "sm-cc-modal-header" });
        header.createEl("h2", { text: "Neuen Statblock erstellen" });
        header.createEl("p", {
            cls: "sm-cc-modal-subtitle",
            text: "Pflege zuerst Grundlagen und Attribute, anschließend Sinne, Verteidigungen und Aktionen.",
        });

        const shell = contentEl.createDiv({ cls: "sm-cc-shell" });
        const nav = shell.createEl("nav", { cls: "sm-cc-shell__nav", attr: { "aria-label": "Abschnitte" } });
        nav.createEl("p", { cls: "sm-cc-shell__nav-label", text: "Abschnitte" });
        const navList = nav.createDiv({ cls: "sm-cc-shell__nav-list" });
        const content = shell.createDiv({ cls: "sm-cc-shell__content" });

        const navEntries: Array<{ id: string; button: HTMLButtonElement }> = [];
        const setActive = (sectionId: string | null) => {
            for (const entry of navEntries) {
                const isActive = entry.id === sectionId;
                entry.button.classList.toggle("is-active", isActive);
                if (isActive) {
                    entry.button.setAttribute("aria-current", "true");
                } else {
                    entry.button.removeAttribute("aria-current");
                }
            }
        };

        const observer = new IntersectionObserver(entries => {
            const visible = entries.filter(entry => entry.isIntersecting);
            if (!visible.length) return;
            visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            const next = (visible[0].target as HTMLElement).id;
            if (next) setActive(next);
        }, { root: contentEl, rootMargin: "-45% 0px -45% 0px", threshold: 0 });
        this.sectionObserver = observer;

        type SectionPlan = {
            id: string;
            title: string;
            subtitle?: string;
            navLabel?: string;
            mount: (handles: FormCardHandles) => void;
        };

        const createSection = (plan: SectionPlan) => {
            const handles = createFormCard(content, {
                title: plan.title,
                subtitle: plan.subtitle,
                registerValidator: (runner) => this.addValidator(runner),
                id: plan.id,
            });
            const navButton = navList.createEl("button", {
                cls: "sm-cc-shell__nav-button",
                text: plan.navLabel ?? plan.title,
            }) as HTMLButtonElement;
            navButton.type = "button";
            navButton.setAttribute("aria-controls", handles.card.id);
            navEntries.push({ id: handles.card.id, button: navButton });
            navButton.addEventListener("click", () => {
                setActive(handles.card.id);
                handles.card.scrollIntoView({ behavior: "smooth", block: "start" });
            });
            observer.observe(handles.card);
            plan.mount(handles);
        };

        // Asynchron: verfügbare Zauber laden (best effort)
        let spellcastingControls: ReturnType<typeof mountCreatureSpellcastingSection> | null = null;
        void listSpellFiles(this.app)
            .then(files => files.map(f => f.basename).sort((a, b) => a.localeCompare(b)))
            .then(spells => {
                this.availableSpells.splice(0, this.availableSpells.length, ...spells);
                spellcastingControls?.setAvailableSpells(spells);
            })
            .catch(() => {});

        const sectionPlans: SectionPlan[] = [
            {
                id: "sm-cc-section-classification",
                title: "Grunddaten",
                subtitle: "Name, Typ, Gesinnung und Tags",
                mount: handles => mountCreatureClassificationSection(handles.body, this.data),
            },
            {
                id: "sm-cc-section-vitals",
                title: "Vitalwerte",
                subtitle: "AC, HP, Initiative und Bewegung",
                mount: handles => mountCreatureVitalSection(handles.body, this.data),
            },
            {
                id: "sm-cc-section-defenses",
                title: "Sinne & Verteidigungen",
                mount: handles => mountCreatureSensesAndDefensesSection(handles.body, this.data),
            },
            {
                id: "sm-cc-section-spellcasting",
                title: "Spellcasting",
                subtitle: "Zauberlisten, Nutzungen und Notizen",
                mount: handles => {
                    spellcastingControls = mountCreatureSpellcastingSection(handles.body, this.data, {
                        getAvailableSpells: () => this.availableSpells,
                        registerValidation: handles.registerValidation,
                    });
                },
            },
            {
                id: "sm-cc-section-stats",
                title: "Attribute & Fertigkeiten",
                mount: handles => mountCreatureStatsAndSkillsSection(handles.body, this.data, handles.registerValidation),
            },
            {
                id: "sm-cc-section-entries",
                title: "Einträge",
                subtitle: "Traits, Aktionen, Bonusaktionen, Reaktionen und Legendäres",
                mount: handles => mountEntriesSection(handles.body, this.data, handles.registerValidation),
            },
        ];

        for (const plan of sectionPlans) {
            createSection(plan);
        }
        if (sectionPlans.length) {
            setActive(sectionPlans[0].id);
        }

        // Buttons
        const footer = contentEl.createDiv({ cls: "sm-cc-modal-footer" });
        new Setting(footer)
            .addButton(b => b.setButtonText("Abbrechen").onClick(() => this.close()))
            .addButton(b => b.setCta().setButtonText("Erstellen").onClick(() => this.submit()));

        // Enter bestätigt NICHT automatisch (nur Button "Erstellen")
    }

    onClose() {
        this.sectionObserver?.disconnect();
        this.sectionObserver = null;
        this.contentEl.empty();
        this.restoreBackgroundPointer();
    }

    onunload() {
        this.sectionObserver?.disconnect();
        this.sectionObserver = null;
        this.restoreBackgroundPointer();
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
