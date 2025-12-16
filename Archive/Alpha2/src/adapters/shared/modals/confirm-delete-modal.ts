/**
 * Confirm Delete Modal
 *
 * Modal dialog for confirming deletion of an item.
 *
 * @module adapters/shared/modals/confirm-delete-modal
 */

import type { App } from 'obsidian';
import { BaseModal } from './base-modal';

/**
 * Delete confirmation modal.
 */
export class ConfirmDeleteModal extends BaseModal<boolean> {
	constructor(
		app: App,
		private itemName: string,
		onResult: (confirmed: boolean) => void
	) {
		// Convert null to false for backward compatibility
		super(app, (result) => onResult(result ?? false));
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.createEl('h2', { text: 'Delete Map?' });
		contentEl.createEl('p', {
			text: `Are you sure you want to delete "${this.itemName}"? This action cannot be undone.`,
		});

		this.createStandardButtons('Delete', 'mod-warning', () => {
			this.submit(true);
		});
	}
}
