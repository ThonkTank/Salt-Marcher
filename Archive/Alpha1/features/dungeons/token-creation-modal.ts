// src/features/dungeons/ui/token-creation-modal.ts
// Modal for creating new dungeon tokens

import type { App} from "obsidian";
import { Modal, Setting } from "obsidian";
import { getDefaultTokenColor } from "@services/domain";
import type { TokenType } from "@services/domain";

export interface TokenCreationData {
    type: TokenType;
    label: string;
    color?: string;
    size?: number;
}

/**
 * Modal for creating or editing a token
 */
export class TokenCreationModal extends Modal {
    private tokenType: TokenType = "player";
    private tokenLabel = "";
    private tokenColor = "";
    private tokenSize = 1.0;
    private isEditMode = false;

    constructor(
        app: App,
        private onSubmit: (data: TokenCreationData) => void,
        initialData?: TokenCreationData,
    ) {
        super(app);

        // Pre-fill form if editing
        if (initialData) {
            this.isEditMode = true;
            this.tokenType = initialData.type;
            this.tokenLabel = initialData.label;
            this.tokenColor = initialData.color || "";
            this.tokenSize = initialData.size || 1.0;
        }
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h3", { text: this.isEditMode ? "Edit Token" : "Create Token" });

        // Token type selector
        new Setting(contentEl)
            .setName("Token Type")
            .setDesc("Select the type of token to create")
            .addDropdown((dropdown) => {
                dropdown
                    .addOption("player", "🧙 Player")
                    .addOption("npc", "🙂 NPC")
                    .addOption("monster", "👹 Monster")
                    .addOption("object", "📦 Object")
                    .setValue(this.tokenType)
                    .onChange((value) => {
                        this.tokenType = value as TokenType;
                        // Update color preview with default color for type
                        this.tokenColor = getDefaultTokenColor(this.tokenType);
                        this.renderColorPreview();
                    });
            });

        // Token label input
        let labelInput: HTMLInputElement | undefined;
        new Setting(contentEl)
            .setName("Label")
            .setDesc("Display name for the token")
            .addText((text) => {
                text
                    .setPlaceholder("Gandalf")
                    .setValue(this.tokenLabel)
                    .onChange((value) => {
                        this.tokenLabel = value.trim();
                    });
                // @ts-ignore – Obsidian keeps the input element internally
                labelInput = (text as any).inputEl as HTMLInputElement;
            });

        // Token color input (optional)
        new Setting(contentEl)
            .setName("Color (Optional)")
            .setDesc("Custom color in hex format (e.g., #ff0000). Leave empty for default.")
            .addText((text) => {
                text
                    .setPlaceholder(getDefaultTokenColor(this.tokenType))
                    .setValue(this.tokenColor)
                    .onChange((value) => {
                        this.tokenColor = value.trim();
                        this.renderColorPreview();
                    });
            });

        // Color preview
        const colorPreviewContainer = contentEl.createDiv({ cls: "sm-token-color-preview-container" });
        colorPreviewContainer.style.marginTop = "8px";
        colorPreviewContainer.style.marginBottom = "16px";

        const colorPreviewLabel = colorPreviewContainer.createSpan({ text: "Preview: " });
        colorPreviewLabel.style.fontSize = "12px";
        colorPreviewLabel.style.color = "var(--text-muted)";

        const colorPreview = colorPreviewContainer.createEl("span", { cls: "sm-token-color-preview" });
        colorPreview.style.display = "inline-block";
        colorPreview.style.width = "24px";
        colorPreview.style.height = "24px";
        colorPreview.style.borderRadius = "50%";
        colorPreview.style.border = "2px solid var(--background-modifier-border)";
        colorPreview.style.marginLeft = "8px";
        colorPreview.style.verticalAlign = "middle";

        // Store reference for updates
        (contentEl as any)._colorPreview = colorPreview;

        // Initialize color preview
        this.tokenColor = getDefaultTokenColor(this.tokenType);
        this.renderColorPreview();

        // Token size slider (optional)
        new Setting(contentEl)
            .setName("Size")
            .setDesc("Token size multiplier (0.5 = small, 1.0 = normal, 2.0 = large)")
            .addSlider((slider) => {
                slider
                    .setLimits(0.5, 2.0, 0.1)
                    .setValue(this.tokenSize)
                    .setDynamicTooltip()
                    .onChange((value) => {
                        this.tokenSize = value;
                    });
            });

        // Buttons
        new Setting(contentEl)
            .addButton((button) => {
                button
                    .setButtonText("Cancel")
                    .onClick(() => {
                        this.close();
                    });
            })
            .addButton((button) => {
                button
                    .setButtonText(this.isEditMode ? "Update Token" : "Create Token")
                    .setCta()
                    .onClick(() => {
                        this.submit();
                    });
            });

        // Enter shortcut
        this.scope.register([], "Enter", () => this.submit());

        // Focus label input
        queueMicrotask(() => labelInput?.focus());
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private renderColorPreview(): void {
        const colorPreview = (this.contentEl as any)._colorPreview as HTMLElement;
        if (!colorPreview) return;

        const color = this.tokenColor || getDefaultTokenColor(this.tokenType);
        colorPreview.style.backgroundColor = color;
    }

    private submit(): void {
        if (!this.tokenLabel) {
            // Require label
            return;
        }

        const data: TokenCreationData = {
            type: this.tokenType,
            label: this.tokenLabel,
            color: this.tokenColor || undefined,
            size: this.tokenSize !== 1.0 ? this.tokenSize : undefined,
        };

        this.close();
        this.onSubmit(data);
    }
}
