/**
 * Loot Distribution Modal
 *
 * Interactive modal for distributing loot after encounters.
 * Shows gold and items with simple distribution options.
 */

import { Modal, App } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("session-loot-modal");
import type { LootBundle } from "@features/loot/loot-types";

export interface LootModalOptions {
	loot: LootBundle;
	onDistribute: (loot: LootBundle) => void;
	onDismiss: () => void;
}

/**
 * Modal for displaying and distributing loot
 */
export class LootModal extends Modal {
	private readonly loot: LootBundle;
	private readonly onDistribute: (loot: LootBundle) => void;
	private readonly onDismissCallback: () => void;

	constructor(app: App, options: LootModalOptions) {
		super(app);
		this.loot = options.loot;
		this.onDistribute = options.onDistribute;
		this.onDismissCallback = options.onDismiss;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("sm-loot-modal");

		// Header
		contentEl.createEl("h2", { text: "Loot gefunden!", cls: "sm-loot-modal__title" });

		// Summary section
		const summary = contentEl.createDiv({ cls: "sm-loot-modal__summary" });

		// Gold display
		if (this.loot.gold > 0) {
			const goldRow = summary.createDiv({ cls: "sm-loot-modal__summary-row" });
			goldRow.createSpan({ cls: "sm-loot-modal__summary-label", text: "Gold:" });
			goldRow.createSpan({
				cls: "sm-loot-modal__summary-value sm-loot-modal__gold-value",
				text: `${this.loot.gold} gp`
			});
		}

		// Total value display
		const valueRow = summary.createDiv({ cls: "sm-loot-modal__summary-row" });
		valueRow.createSpan({ cls: "sm-loot-modal__summary-label", text: "Gesamtwert:" });
		valueRow.createSpan({
			cls: "sm-loot-modal__summary-value",
			text: `${this.loot.totalValue} gp`
		});

		// Items section
		if (this.loot.items.length > 0) {
			contentEl.createEl("h3", { text: "Items", cls: "sm-loot-modal__section-title" });

			const itemsList = contentEl.createDiv({ cls: "sm-loot-modal__items-list" });

			for (const item of this.loot.items) {
				const itemRow = itemsList.createDiv({ cls: "sm-loot-modal__item-row" });

				// Item name
				const itemName = itemRow.createDiv({ cls: "sm-loot-modal__item-name" });

				// Quantity indicator if > 1
				if (item.quantity && item.quantity > 1) {
					itemName.createSpan({
						cls: "sm-loot-modal__item-quantity",
						text: `${item.quantity}× `
					});
				}

				itemName.createSpan({ text: item.name });

				// Item value
				if (item.value) {
					itemRow.createSpan({
						cls: "sm-loot-modal__item-value",
						text: `${item.value} gp`
					});
				}

				// Item rarity badge (if available)
				if (item.rarity) {
					const rarityBadge = itemRow.createSpan({
						cls: `sm-loot-modal__item-rarity sm-loot-modal__item-rarity--${item.rarity.toLowerCase()}`,
						text: item.rarity
					});
				}
			}
		} else {
			contentEl.createDiv({
				cls: "sm-loot-modal__empty-message",
				text: "Nur Gold gefunden, keine Items."
			});
		}

		// Action buttons
		const actions = contentEl.createDiv({ cls: "sm-loot-modal__actions" });

		// Add to inventory button
		const addButton = actions.createEl("button", {
			cls: "sm-loot-modal__button sm-loot-modal__button--primary",
			text: "Zum Party-Inventar hinzufügen",
		});
		addButton.type = "button";
		addButton.addEventListener("click", () => {
			logger.info("[LootModal] Adding loot to party inventory", {
				gold: this.loot.gold,
				itemCount: this.loot.items.length
			});
			this.onDistribute(this.loot);
			this.close();
		});

		// Dismiss button
		const dismissButton = actions.createEl("button", {
			cls: "sm-loot-modal__button sm-loot-modal__button--secondary",
			text: "Verwerfen",
		});
		dismissButton.type = "button";
		dismissButton.addEventListener("click", () => {
			logger.info("[LootModal] Loot dismissed");
			this.onDismissCallback();
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Helper function to open loot modal
 */
export function openLootModal(app: App, options: LootModalOptions): void {
	const modal = new LootModal(app, options);
	modal.open();
}
