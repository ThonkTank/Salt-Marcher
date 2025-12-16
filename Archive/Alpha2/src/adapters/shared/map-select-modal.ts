/**
 * Map Selection Modal
 *
 * Shared fuzzy-search modal for selecting maps.
 * Used by Cartographer and Traveler views.
 *
 * @module adapters/shared/map-select-modal
 */

import { FuzzySuggestModal, type App } from 'obsidian';
import type { MapListEntry } from '../../schemas';

// ============================================================================
// MapSelectModal
// ============================================================================

export class MapSelectModal extends FuzzySuggestModal<MapListEntry> {
	constructor(
		app: App,
		private maps: MapListEntry[],
		private onSelect: (entry: MapListEntry | null) => void
	) {
		super(app);
		this.setPlaceholder('Search maps...');
	}

	getItems(): MapListEntry[] {
		return this.maps;
	}

	getItemText(item: MapListEntry): string {
		return item.name;
	}

	onChooseItem(item: MapListEntry): void {
		this.onSelect(item);
	}
}
