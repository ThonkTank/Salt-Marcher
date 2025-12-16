/**
 * Keyboard Shortcuts Help Modal
 *
 * Displays all available keyboard shortcuts in the Almanac.
 * Triggered by pressing "?" key in Almanac view.
 *
 * Part of Almanac UI Phase 1 - Task 3B: Global Keyboard Shortcuts
 */

import type { App} from "obsidian";
import { Modal } from "obsidian";

/**
 * Modal displaying keyboard shortcuts for Almanac
 */
export class KeyboardShortcutsHelpModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Almanac Keyboard Shortcuts" });

        const sections = [
            {
                title: "View Switching",
                shortcuts: [
                    { key: "1", description: "Switch to List view" },
                    { key: "2", description: "Switch to Month view" },
                    { key: "3", description: "Switch to Week view" },
                    { key: "4", description: "Switch to Timeline view" },
                ],
            },
            {
                title: "Navigation",
                shortcuts: [
                    { key: "←", description: "Previous period (month/week)" },
                    { key: "→", description: "Next period (month/week)" },
                    { key: "T or Ctrl+T", description: "Jump to today" },
                    { key: "J or Ctrl+J", description: "Jump to specific date (coming soon)" },
                ],
            },
            {
                title: "Actions",
                shortcuts: [
                    { key: "N or Ctrl+N", description: "Create new event (quick-add)" },
                    { key: "/ or Ctrl+F", description: "Focus search bar" },
                    { key: "?", description: "Show this help" },
                ],
            },
            {
                title: "Event Actions",
                description: "These shortcuts work when an event is selected:",
                shortcuts: [
                    { key: "E", description: "Edit selected event" },
                    { key: "D", description: "Delete selected event (with confirmation)" },
                    { key: "Enter", description: "Open selected event in editor" },
                ],
            },
            {
                title: "Other",
                shortcuts: [
                    { key: "Escape", description: "Clear search / close modals / deselect event" },
                ],
            },
        ];

        sections.forEach((section) => {
            const sectionEl = contentEl.createDiv({ cls: "sm-keyboard-shortcuts-section" });

            sectionEl.createEl("h3", { text: section.title });

            if (section.description) {
                sectionEl.createEl("p", {
                    cls: "sm-keyboard-shortcuts-section-desc",
                    text: section.description,
                });
            }

            const table = sectionEl.createEl("table", {
                cls: "sm-keyboard-shortcuts-table",
            });

            section.shortcuts.forEach((shortcut) => {
                const row = table.createEl("tr");

                const keyCell = row.createEl("td", {
                    cls: "sm-keyboard-shortcuts-key",
                });
                keyCell.createEl("kbd", { text: shortcut.key });

                row.createEl("td", {
                    cls: "sm-keyboard-shortcuts-description",
                    text: shortcut.description,
                });
            });
        });

        // Close button
        const buttonContainer = contentEl.createDiv({
            cls: "sm-keyboard-shortcuts-actions",
        });

        const closeBtn = buttonContainer.createEl("button", {
            text: "Close",
            cls: "mod-cta",
        });
        closeBtn.addEventListener("click", () => this.close());

        // Tip
        const tipEl = contentEl.createDiv({ cls: "sm-keyboard-shortcuts-tip" });
        tipEl.createEl("strong", { text: "Tip: " });
        tipEl.appendText("Press ? anytime to see these shortcuts again.");
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
