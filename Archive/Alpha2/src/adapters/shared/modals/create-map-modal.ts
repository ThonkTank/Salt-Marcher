/**
 * Create Map Modal
 *
 * Modal dialog for creating a new map with name and radius.
 *
 * @module adapters/shared/modals/create-map-modal
 */

import { Setting, type App } from 'obsidian';
import { BaseModal } from './base-modal';

export interface CreateMapConfig {
	name: string;
	radius: number;
}

/**
 * Map creation modal.
 */
export class CreateMapModal extends BaseModal<CreateMapConfig> {
	private name: string = '';
	private radius: number = 5;

	constructor(app: App, onSubmit: (config: CreateMapConfig | null) => void) {
		super(app, onSubmit);
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.createEl('h2', { text: 'Create New Map' });

		// Name input
		new Setting(contentEl).setName('Map Name').addText((text) => {
			text.setPlaceholder('My Map').onChange((value) => {
				this.name = value;
			});
			// Focus on open
			setTimeout(() => text.inputEl.focus(), 10);
			// Submit on Enter
			text.inputEl.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' && this.name.trim()) {
					this.trySubmit();
				}
			});
		});

		// Radius slider
		new Setting(contentEl)
			.setName('Radius')
			.setDesc(`${this.radius} hexes from center`)
			.addSlider((slider) => {
				slider
					.setLimits(1, 20, 1)
					.setValue(this.radius)
					.setDynamicTooltip()
					.onChange((value) => {
						this.radius = value;
						// Update description
						const desc = slider.sliderEl
							.closest('.setting-item')
							?.querySelector('.setting-item-description');
						if (desc) {
							desc.textContent = `${value} hexes from center`;
						}
					});
			});

		this.createStandardButtons('Create', 'mod-cta', () => this.trySubmit());
	}

	private trySubmit(): void {
		if (this.name.trim()) {
			this.submit({ name: this.name.trim(), radius: this.radius });
		}
	}
}
