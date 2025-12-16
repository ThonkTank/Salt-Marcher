// src/ui/maps/components/confirm-delete-modal.ts
// Map deletion confirmation using the new dialog builder pattern

import type { App, TFile } from "obsidian";
import { Notice , setIcon } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('ui-confirm-delete-modal');
import { BasePluginModal } from "../../patterns/base-modal";

export interface ConfirmDeleteModalOptions {
    mapFile: TFile;
    onConfirm: () => Promise<void>;
}

/**
 * Confirmation modal for deleting a map.
 * Requires user to type the map name to confirm deletion.
 */
export class ConfirmDeleteModal extends BasePluginModal<ConfirmDeleteModalOptions> {
    private confirmButton: HTMLButtonElement | null = null;
    private isDeleting = false;

    constructor(app: App, options: ConfirmDeleteModalOptions) {
        super(app, options, {
            title: "Delete map?",
            className: "sm-confirm-delete-modal",
            width: "450px",
            focusSelector: "input[type='text']"
        });
    }

    protected renderContent(): HTMLElement {
        const container = document.createElement('div');
        const name = this.options.mapFile.basename;

        // Message
        const message = container.createEl('p', {
            text: `This will delete your map permanently. To continue, enter "${name}".`,
            cls: 'confirm-message'
        });

        // Confirmation input
        const input = container.createEl('input', {
            type: 'text',
            placeholder: name,
            cls: 'confirmation-input'
        }) as HTMLInputElement;
        input.style.width = '100%';

        // Button row
        const btnRow = container.createDiv({ cls: 'modal-button-row' });

        // Cancel button
        const cancelBtn = btnRow.createEl('button', {
            text: 'Cancel',
            cls: 'mod-plain'
        });
        cancelBtn.addEventListener('click', () => {
            this.close();
        });

        // Delete button (initially disabled)
        this.confirmButton = btnRow.createEl('button', {
            text: 'Delete',
            cls: 'mod-warning'
        });
        setIcon(this.confirmButton, 'trash');
        this.confirmButton.disabled = true;

        // Enable delete button only when input matches
        input.addEventListener('input', () => {
            if (this.confirmButton) {
                this.confirmButton.disabled = input.value.trim() !== name;
            }
        });

        // Delete button click handler
        this.confirmButton.addEventListener('click', async () => {
            if (this.isDeleting || input.value.trim() !== name) {
                return;
            }

            this.isDeleting = true;
            if (this.confirmButton) {
                this.confirmButton.disabled = true;
            }

            try {
                await this.options.onConfirm();
                new Notice('Map deleted successfully.');
                this.close();
            } catch (error) {
                logger.error('Map deletion failed', error);
                new Notice('Failed to delete map. Check console for details.');
                this.isDeleting = false;
                if (this.confirmButton) {
                    this.confirmButton.disabled = input.value.trim() !== name;
                }
            }
        });

        return container;
    }
}
