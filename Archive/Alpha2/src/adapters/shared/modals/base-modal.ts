/**
 * Base Modal
 *
 * Abstract base class for modals with common patterns.
 * Handles submitted state tracking and button container styling.
 *
 * @module adapters/shared/modals/base-modal
 */

import { Modal, type App } from 'obsidian';

/**
 * Button configuration for modal buttons.
 */
export interface ModalButton {
	text: string;
	cls?: string;
	onClick: () => void | Promise<void>;
}

/**
 * Abstract base class for modals with result tracking.
 *
 * @example
 * class MyModal extends BaseModal<string> {
 *     private value = '';
 *
 *     onOpen(): void {
 *         // Build UI...
 *         this.createStandardButtons('Save', 'mod-cta', () => {
 *             this.submit(this.value);
 *         });
 *     }
 * }
 */
export abstract class BaseModal<TResult> extends Modal {
	protected submitted = false;
	protected result: TResult | null = null;

	constructor(
		app: App,
		protected readonly onResult: (result: TResult | null) => void
	) {
		super(app);
	}

	/**
	 * Create styled button container.
	 *
	 * @param container - Parent element
	 * @param buttons - Button configurations
	 * @returns The button container element
	 */
	protected createButtonContainer(
		container: HTMLElement,
		buttons: ModalButton[]
	): HTMLElement {
		const buttonContainer = container.createDiv({ cls: 'modal-button-container' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '8px';
		buttonContainer.style.marginTop = '16px';

		for (const btn of buttons) {
			const button = buttonContainer.createEl('button', {
				text: btn.text,
				cls: btn.cls,
			});
			button.addEventListener('click', () => void btn.onClick());
		}

		return buttonContainer;
	}

	/**
	 * Create standard cancel + action button pair.
	 *
	 * @param confirmText - Text for the confirm button
	 * @param confirmCls - CSS class for confirm button (e.g., 'mod-cta', 'mod-warning')
	 * @param onConfirm - Handler for confirm action
	 */
	protected createStandardButtons(
		confirmText: string,
		confirmCls: string,
		onConfirm: () => void | Promise<void>
	): void {
		this.createButtonContainer(this.contentEl, [
			{ text: 'Cancel', onClick: () => this.close() },
			{ text: confirmText, cls: confirmCls, onClick: onConfirm },
		]);
	}

	/**
	 * Submit the modal with a result.
	 * Marks as submitted, stores result, and closes.
	 *
	 * @param result - The result value
	 */
	protected submit(result: TResult): void {
		this.submitted = true;
		this.result = result;
		this.onResult(result);
		this.close();
	}

	/**
	 * Handle modal close.
	 * Calls onResult with null if not submitted.
	 */
	onClose(): void {
		if (!this.submitted) {
			this.onResult(null);
		}
		this.contentEl.empty();
	}
}
