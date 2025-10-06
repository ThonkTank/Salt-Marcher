// src/apps/library/create/creature/modal.ts
// Organisiert den Kreaturen-Editor als Shell-Layout mit Abschnittsnavigation und koordiniert Mounting.
import { App, Modal, Notice, Setting } from "obsidian";
import type { StatblockData } from "../../core/creature-files";
import { listSpellFiles } from "../../core/spell-files";
import { mountCreatureClassificationSection, mountCreatureVitalSection } from "./section-basics";
import { mountCreatureStatsAndSkillsSection } from "./section-stats-and-skills";
import { mountCreatureSensesAndDefensesSection } from "./section-senses-and-defenses";
import { mountEntriesSection } from "./section-entries";
import { spellcastingDataToEntry } from "./entry-model";
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
    private sectionMountFunctions: Map<string, () => void> = new Map();
    private keydownHandler: ((evt: KeyboardEvent) => void) | null = null;
    private saveButton: HTMLButtonElement | null = null;
    private entriesSectionId = "sm-cc-section-entries";
    private navButtons: Array<{ id: string; button: HTMLButtonElement }> = [];
    private hasUnsavedChanges = false;

    constructor(app: App, presetName: string | undefined, onSubmit: (d: StatblockData) => void, preset?: StatblockData) {
        super(app);
        this.onSubmit = onSubmit;

        if (preset) {
            // Load from preset
            this.data = { ...preset };

            // Migration: Convert legacy spellcasting data to entry format
            if ((this.data as any).spellcasting && (!this.data.entries || this.data.entries.length === 0)) {
                const spellEntry = spellcastingDataToEntry((this.data as any).spellcasting);
                if (!this.data.entries) this.data.entries = [];
                // Type assertion needed until StatblockData.entries type is updated to include new entry fields
                this.data.entries.push(spellEntry as any);
                delete (this.data as any).spellcasting; // Clean up old data
                console.log('[CreateCreatureModal] Migrated legacy spellcasting data to entry format');
            }

            console.log('[CreateCreatureModal] Loaded preset data:', {
                name: this.data.name,
                type: this.data.type,
                size: this.data.size,
                cr: this.data.cr,
                hasEntries: !!this.data.entries,
                entriesCount: this.data.entries?.length,
                hasSpellcasting: !!(this.data as any).spellcasting,
                hasSpeeds: !!this.data.speeds,
                hasSaves: !!this.data.saveProf,
                hasSkills: !!this.data.skillsProf,
            });
        } else {
            // New creature
            this.data = { name: presetName?.trim() || "Neue Kreatur" };
        }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-cc-create-modal");
        this.applyModalLayout();
        this.validators = [];
        this.sectionObserver?.disconnect();
        this.sectionObserver = null;
        this.navButtons = [];

        this.lockBackgroundPointer();

        // Register keyboard shortcuts
        this.registerKeyboardShortcuts();

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

        const setActive = (sectionId: string | null) => {
            for (const entry of this.navButtons) {
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
            this.navButtons.push({ id: handles.card.id, button: navButton });
            navButton.addEventListener("click", () => {
                setActive(handles.card.id);
                handles.card.scrollIntoView({ behavior: "smooth", block: "start" });
            });
            observer.observe(handles.card);
            plan.mount(handles);
        };

        // Asynchron: verfügbare Zauber laden (best effort)
        void listSpellFiles(this.app)
            .then(files => files.map(f => f.basename).sort((a, b) => a.localeCompare(b)))
            .then(spells => {
                this.availableSpells.splice(0, this.availableSpells.length, ...spells);
            })
            .catch(() => {});

        const sectionPlans: SectionPlan[] = [
            {
                id: "sm-cc-section-classification",
                title: "Grunddaten",
                subtitle: "Name, Typ, Gesinnung und Tags",
                mount: handles => mountCreatureClassificationSection(handles.body, this.data, {
                    app: this.app,
                    onPresetSelected: (preset) => {
                        // Close current modal and open new one with preset
                        this.close();
                        new CreateCreatureModal(this.app, undefined, this.onSubmit, preset).open();
                    }
                }),
            },
            {
                id: "sm-cc-section-vitals",
                title: "Vitalwerte",
                subtitle: "AC, HP, Initiative und Bewegung",
                mount: handles => mountCreatureVitalSection(handles.body, this.data),
            },
            {
                id: "sm-cc-section-stats",
                title: "Attribute & Fertigkeiten",
                subtitle: "Attributswerte, Rettungswürfe und Fertigkeiten",
                mount: handles => mountCreatureStatsAndSkillsSection(handles.body, this.data, handles.registerValidation),
            },
            {
                id: "sm-cc-section-defenses",
                title: "Sinne & Verteidigungen",
                mount: handles => mountCreatureSensesAndDefensesSection(handles.body, this.data),
            },
            {
                id: this.entriesSectionId,
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
        const modifierKey = this.getModifierKeyName();
        new Setting(footer)
            .addButton(b => b
                .setButtonText("Abbrechen")
                .setTooltip("Modal schließen (Esc)")
                .onClick(() => this.close()))
            .addButton(b => {
                b.setCta()
                    .setButtonText("Erstellen")
                    .setTooltip(`Statblock erstellen (${modifierKey}+S)`)
                    .onClick(() => this.submit());
                this.saveButton = b.buttonEl;
                return b;
            });

        // Enter bestätigt NICHT automatisch (nur Button "Erstellen")

        // Track changes for unsaved changes warning
        this.trackChanges();
    }

    onClose() {
        this.unregisterKeyboardShortcuts();
        this.sectionObserver?.disconnect();
        this.sectionObserver = null;
        this.resetModalLayout();
        this.contentEl.empty();
        this.restoreBackgroundPointer();
        this.navButtons = [];
        this.saveButton = null;
    }

    onunload() {
        this.unregisterKeyboardShortcuts();
        this.sectionObserver?.disconnect();
        this.sectionObserver = null;
        this.resetModalLayout();
        this.restoreBackgroundPointer();
        this.navButtons = [];
        this.saveButton = null;
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

    private applyModalLayout() {
        this.modalEl.addClass("sm-cc-create-modal-host");
    }

    private resetModalLayout() {
        this.modalEl.removeClass("sm-cc-create-modal-host");
    }

    /**
     * Register keyboard shortcuts for the modal
     */
    private registerKeyboardShortcuts() {
        this.keydownHandler = (evt: KeyboardEvent) => {
            // Check if user is typing in an input field
            const target = evt.target as HTMLElement;
            const isTyping = target.tagName === 'INPUT' ||
                            target.tagName === 'TEXTAREA' ||
                            target.isContentEditable;

            // Cross-platform modifier key (Ctrl on Windows/Linux, Cmd on Mac)
            const modifier = evt.ctrlKey || evt.metaKey;

            // Ctrl/Cmd + N: Create new entry (focus on Einträge tab)
            if (modifier && evt.key === 'n' && !isTyping) {
                evt.preventDefault();
                this.handleNewEntry();
                return;
            }

            // Ctrl/Cmd + S: Save creature
            if (modifier && evt.key === 's') {
                evt.preventDefault();
                this.handleSave();
                return;
            }

            // Ctrl/Cmd + D: Duplicate current entry (if in entries section)
            if (modifier && evt.key === 'd' && !isTyping) {
                evt.preventDefault();
                this.handleDuplicateEntry();
                return;
            }

            // Escape: Close modal (with confirmation if needed)
            if (evt.key === 'Escape' && !modifier) {
                // Let Obsidian handle the default escape behavior
                // but we could add unsaved changes warning here if needed
                this.handleEscape();
                return;
            }
        };

        this.modalEl.addEventListener('keydown', this.keydownHandler);
    }

    /**
     * Unregister keyboard shortcuts
     */
    private unregisterKeyboardShortcuts() {
        if (this.keydownHandler) {
            this.modalEl.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
    }

    /**
     * Get the modifier key name for the current platform
     */
    private getModifierKeyName(): string {
        return navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Cmd' : 'Ctrl';
    }

    /**
     * Handle Ctrl/Cmd + N: Create new entry
     */
    private handleNewEntry() {
        // Navigate to entries section
        const entriesButton = this.navButtons.find(nav => nav.id === this.entriesSectionId);
        if (entriesButton) {
            entriesButton.button.click();

            // Wait for scroll to complete, then trigger the first add button
            setTimeout(() => {
                const entriesSection = this.contentEl.querySelector(`#${this.entriesSectionId}`) as HTMLElement;
                if (entriesSection) {
                    // Find the first add button (trait)
                    const addButton = entriesSection.querySelector('.sm-cc-entry-add-btn[data-category="trait"]') as HTMLButtonElement;
                    if (addButton) {
                        addButton.click();
                        this.showVisualFeedback(addButton);
                        new Notice("Neuer Eintrag erstellt");
                    }
                }
            }, 300);
        }
    }

    /**
     * Handle Ctrl/Cmd + S: Save creature
     */
    private handleSave() {
        if (this.saveButton) {
            this.showVisualFeedback(this.saveButton);
            this.submit();

            // Only show success notice if validation passed
            const issues = this.runValidators();
            if (issues.length === 0 && this.data.name?.trim()) {
                new Notice("Statblock wird erstellt...");
            } else if (issues.length > 0) {
                new Notice(`Validierung fehlgeschlagen: ${issues.length} Problem${issues.length > 1 ? 'e' : ''}`);
            }
        }
    }

    /**
     * Handle Ctrl/Cmd + D: Duplicate current entry
     */
    private handleDuplicateEntry() {
        // Check if we're in the entries section
        const entriesSection = this.contentEl.querySelector(`#${this.entriesSectionId}`) as HTMLElement;
        if (!entriesSection) return;

        // Find the first visible entry card
        const firstVisibleEntry = entriesSection.querySelector('.sm-cc-entry-card:not(.sm-cc-entry-hidden)') as HTMLElement;
        if (!firstVisibleEntry) {
            new Notice("Kein Eintrag zum Duplizieren gefunden");
            return;
        }

        // Find the duplicate button (if the entry card has one)
        const duplicateButton = firstVisibleEntry.querySelector('[aria-label*="Duplizieren"], button[title*="Duplizieren"]') as HTMLButtonElement;
        if (duplicateButton) {
            duplicateButton.click();
            this.showVisualFeedback(firstVisibleEntry);
            new Notice("Eintrag dupliziert");
        } else {
            // If no duplicate button exists, we could implement duplication logic here
            // For now, just show a message
            new Notice("Duplizieren für diesen Eintrag nicht verfügbar");
        }
    }

    /**
     * Handle Escape: Close modal with unsaved changes warning
     */
    private handleEscape() {
        // For now, just close - could add unsaved changes check here
        // The default Obsidian behavior will handle closing
    }

    /**
     * Show visual feedback when a shortcut is triggered
     */
    private showVisualFeedback(element: HTMLElement) {
        element.addClass('sm-cc-shortcut-flash');
        setTimeout(() => {
            element.removeClass('sm-cc-shortcut-flash');
        }, 300);
    }

    /**
     * Track changes to data for unsaved changes warning
     */
    private trackChanges() {
        // Simple change tracking - could be enhanced
        const originalData = JSON.stringify(this.data);

        // Check for changes periodically or on specific events
        // This is a basic implementation - could be improved with more granular tracking
        const checkChanges = () => {
            this.hasUnsavedChanges = JSON.stringify(this.data) !== originalData;
        };

        // Listen for input events on the modal
        this.contentEl.addEventListener('input', checkChanges);
        this.contentEl.addEventListener('change', checkChanges);
    }

    /**
     * Check if there are unsaved changes
     */
    private hasUnsavedChangesCheck(): boolean {
        return this.hasUnsavedChanges;
    }
}
