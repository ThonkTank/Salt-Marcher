/**
 * Keyboard Shortcuts Help Modal for Cartographer
 *
 * Displays all available keyboard shortcuts in the Cartographer.
 * Triggered by pressing "?" key in Cartographer view.
 *
 * Part of Cartographer UI Revamp - Phase 6: Keyboard Shortcuts
 */

import type { App} from "obsidian";
import { Modal } from "obsidian";

/**
 * Modal displaying keyboard shortcuts for Cartographer
 */
export class CartographerKeyboardShortcutsHelpModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Cartographer Keyboard Shortcuts" });

        const sections = [
            {
                title: "Mode Switching",
                shortcuts: [
                    { key: "1", description: "Switch to Editor mode (Tile Brush tool)" },
                    { key: "2", description: "Switch to Editor mode (Terrain Brush tool)" },
                ],
            },
            {
                title: "Layer Controls",
                shortcuts: [
                    { key: "L", description: "Toggle Layer Panel" },
                    { key: "W", description: "Toggle Weather Layer" },
                    { key: "F", description: "Toggle Faction Layer" },
                ],
            },
            {
                title: "Layer Presets",
                shortcuts: [
                    { key: "Shift+1", description: "Apply Faction View preset" },
                    { key: "Shift+2", description: "Apply Weather View preset" },
                    { key: "Shift+3", description: "Apply Terrain View preset" },
                    { key: "Shift+4", description: "Apply All Layers preset" },
                ],
            },
            {
                title: "Editor Mode Tools",
                description: "These shortcuts only work when Editor mode is active:",
                shortcuts: [
                    { key: "B", description: "Toggle Terrain Brush paint/erase mode (when Terrain Brush tool is active)" },
                    { key: "R", description: "Focus Region dropdown" },
                    { key: "Shift+F", description: "Focus Faction dropdown" },
                ],
            },
            {
                title: "Global Actions",
                shortcuts: [
                    { key: "?", description: "Show this help" },
                ],
            },
            {
                title: "Navigation",
                description: "Use your mouse or trackpad to:",
                shortcuts: [
                    { key: "Click", description: "Select hex (Inspector mode) or paint/place marker (Editor mode)" },
                    { key: "Scroll", description: "Zoom in/out on map" },
                    { key: "Drag", description: "Pan map view" },
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
