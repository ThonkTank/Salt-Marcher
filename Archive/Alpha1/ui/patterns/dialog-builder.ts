/**
 * Dialog Builder Pattern
 *
 * Provides utilities for creating common dialog types:
 * - Confirmation dialogs (yes/no)
 * - Destructive action confirmations (type-to-confirm)
 * - Alert dialogs (info/warning/error)
 *
 * Eliminates boilerplate for common modal patterns.
 *
 * Usage:
 * ```typescript
 * // Simple confirmation
 * if (await showConfirmation(app, {
 *     title: 'Delete Item?',
 *     message: 'Are you sure?'
 * })) {
 *     // User confirmed
 * }
 *
 * // Type-to-confirm for destructive actions
 * if (await showDestructiveConfirmation(app, {
 *     title: 'Delete Account?',
 *     message: 'This cannot be undone. Type "delete me" to confirm.',
 *     confirmText: 'delete me'
 * })) {
 *     // User confirmed by typing exact text
 * }
 * ```
 */

import type { App} from 'obsidian';
import { setIcon } from 'obsidian';
import { BasePluginModal } from './base-modal';

export interface ConfirmationOptions {
    title: string;
    message: string;
    okLabel?: string;
    cancelLabel?: string;
    isDangerous?: boolean; // Apply warning styling to OK button
}

export interface DestructiveConfirmationOptions extends ConfirmationOptions {
    confirmText: string; // User must type this exact text to confirm
}

export interface AlertOptions {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'error';
    okLabel?: string;
}

/**
 * Shows a simple yes/no confirmation dialog.
 *
 * @returns true if user clicked OK, false if cancelled
 */
export function showConfirmation(
    app: App,
    options: ConfirmationOptions
): Promise<boolean> {
    return new Promise((resolve) => {
        const modal = new ConfirmationModal(app, options, (confirmed) => {
            resolve(confirmed);
        });
        modal.open();
    });
}

/**
 * Shows a destructive action confirmation that requires typing a confirmation text.
 *
 * Used for dangerous operations like deleting files, clearing caches, etc.
 *
 * @returns true if user typed confirmation text and clicked OK, false otherwise
 */
export function showDestructiveConfirmation(
    app: App,
    options: DestructiveConfirmationOptions
): Promise<boolean> {
    return new Promise((resolve) => {
        const modal = new DestructiveConfirmationModal(app, options, (confirmed) => {
            resolve(confirmed);
        });
        modal.open();
    });
}

/**
 * Shows a simple alert dialog (info, warning, or error).
 *
 * @returns Promise that resolves when user clicks OK
 */
export function showAlert(
    app: App,
    options: AlertOptions
): Promise<void> {
    return new Promise((resolve) => {
        const modal = new AlertModal(app, options, () => {
            resolve();
        });
        modal.open();
    });
}

/**
 * Internal: Simple confirmation modal
 */
class ConfirmationModal extends BasePluginModal<ConfirmationOptions> {
    constructor(
        app: App,
        options: ConfirmationOptions,
        private onConfirm: (confirmed: boolean) => void
    ) {
        super(app, options, {
            title: options.title,
            className: 'sm-confirmation-modal',
            width: '400px'
        });
    }

    protected renderContent(): HTMLElement {
        const container = document.createElement('div');

        // Message
        const message = container.createEl('p', {
            text: this.options.message,
            cls: 'confirmation-message'
        });

        // Button row
        const buttonRow = container.createDiv({ cls: 'modal-button-row' });

        // Cancel button
        const cancelBtn = buttonRow.createEl('button', {
            text: this.options.cancelLabel ?? 'Cancel',
            cls: 'mod-plain'
        });
        cancelBtn.addEventListener('click', () => {
            this.onConfirm(false);
            this.close();
        });

        // OK button
        const okBtn = buttonRow.createEl('button', {
            text: this.options.okLabel ?? 'OK',
            cls: this.options.isDangerous ? 'mod-warning' : 'mod-cta'
        });
        okBtn.addEventListener('click', () => {
            this.onConfirm(true);
            this.close();
        });

        return container;
    }

    protected onAfterOpen(): void {
        // Focus OK button
        const okBtn = this.contentEl.querySelector('button.mod-cta, button.mod-warning');
        if (okBtn instanceof HTMLElement) {
            okBtn.focus();
        }
    }
}

/**
 * Internal: Destructive confirmation modal (requires typing confirmation text)
 */
class DestructiveConfirmationModal extends BasePluginModal<DestructiveConfirmationOptions> {
    private inputEl: HTMLInputElement | null = null;

    constructor(
        app: App,
        options: DestructiveConfirmationOptions,
        private onConfirm: (confirmed: boolean) => void
    ) {
        super(app, options, {
            title: options.title,
            className: 'sm-destructive-confirmation-modal',
            width: '450px'
        });
    }

    protected renderContent(): HTMLElement {
        const container = document.createElement('div');

        // Message
        container.createEl('p', {
            text: this.options.message,
            cls: 'confirmation-message'
        });

        // Confirmation input
        this.inputEl = container.createEl('input', {
            type: 'text',
            placeholder: this.options.confirmText,
            cls: 'confirmation-input'
        });

        // Button row
        const buttonRow = container.createDiv({ cls: 'modal-button-row' });

        // Cancel button
        const cancelBtn = buttonRow.createEl('button', {
            text: this.options.cancelLabel ?? 'Cancel',
            cls: 'mod-plain'
        });
        cancelBtn.addEventListener('click', () => {
            this.onConfirm(false);
            this.close();
        });

        // OK button (disabled by default)
        const okBtn = buttonRow.createEl('button', {
            text: this.options.okLabel ?? 'Confirm',
            cls: 'mod-warning'
        });
        okBtn.disabled = true;

        // Enable OK button only if input matches
        this.inputEl.addEventListener('input', () => {
            const matches = this.inputEl!.value === this.options.confirmText;
            okBtn.disabled = !matches;
        });

        okBtn.addEventListener('click', () => {
            if (this.inputEl!.value === this.options.confirmText) {
                this.onConfirm(true);
                this.close();
            }
        });

        return container;
    }

    protected onAfterOpen(): void {
        // Focus input field
        if (this.inputEl) {
            this.inputEl.focus();
        }
    }
}

/**
 * Internal: Alert modal (info/warning/error)
 */
class AlertModal extends BasePluginModal<AlertOptions> {
    constructor(
        app: App,
        options: AlertOptions,
        private onDismiss: () => void
    ) {
        super(app, options, {
            title: options.title,
            className: `sm-alert-modal sm-alert-${options.type ?? 'info'}`,
            width: '400px'
        });
    }

    protected renderContent(): HTMLElement {
        const container = document.createElement('div');

        // Icon
        const iconMap = {
            info: 'info',
            warning: 'alert-circle',
            error: 'alert-triangle'
        };
        const iconName = iconMap[this.options.type ?? 'info'];
        const iconEl = container.createDiv({ cls: 'alert-icon' });
        setIcon(iconEl, iconName);

        // Message
        container.createEl('p', {
            text: this.options.message,
            cls: 'alert-message'
        });

        // Button
        const buttonRow = container.createDiv({ cls: 'modal-button-row' });
        const okBtn = buttonRow.createEl('button', {
            text: this.options.okLabel ?? 'OK',
            cls: 'mod-cta'
        });
        okBtn.addEventListener('click', () => {
            this.onDismiss();
            this.close();
        });

        return container;
    }

    protected onAfterOpen(): void {
        // Focus OK button
        const okBtn = this.contentEl.querySelector('button.mod-cta');
        if (okBtn instanceof HTMLElement) {
            okBtn.focus();
        }
    }
}
