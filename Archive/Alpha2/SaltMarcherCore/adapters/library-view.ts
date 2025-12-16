/**
 * Library View
 *
 * Obsidian ItemView for the Library.
 * Handles all DOM manipulation and rendering.
 * Receives state from LibraryPresenter via render() callback.
 *
 * @module SaltMarcherCore/adapters/library-view
 */

import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { ILibraryStore, EntityType } from '../../Shared/schemas';
import type { StatblockData, TerrainData } from '../schemas';
import {
	LibraryPresenter,
	type LibraryState,
	type LibraryCallbacks,
} from '../orchestrators/library-presenter';

// ============================================================================
// Constants
// ============================================================================

export const LIBRARY_VIEW_TYPE = 'salt-marcher-library';

const TAB_LABELS: Record<EntityType, string> = {
	creature: 'Creatures',
	terrain: 'Terrains',
};

const BORDER_COLOR = 'var(--background-modifier-border)';
const TEXT_MUTED_COLOR = 'var(--text-muted)';

// ============================================================================
// Library View
// ============================================================================

export class LibraryView extends ItemView {
	private presenter: LibraryPresenter;
	private callbacks: LibraryCallbacks | null = null;

	// UI Elements
	private containerEl_: HTMLElement | null = null;
	private headerEl: HTMLElement | null = null;
	private contentEl_: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;
	private detailEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, libraryStore: ILibraryStore) {
		super(leaf);
		this.presenter = new LibraryPresenter(libraryStore);
	}

	// ========================================================================
	// Obsidian ItemView Implementation
	// ========================================================================

	getViewType(): string {
		return LIBRARY_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Library';
	}

	getIcon(): string {
		return 'book-open';
	}

	async onOpen(): Promise<void> {
		this.containerEl_ = this.containerEl.children[1] as HTMLElement;
		this.containerEl_.empty();
		this.containerEl_.addClass('library-container');
		this.containerEl_.style.display = 'flex';
		this.containerEl_.style.flexDirection = 'column';
		this.containerEl_.style.height = '100%';

		// Create layout
		this.createLayout();

		// Connect to presenter
		this.presenter.setOnRender((state) => this.render(state));
		this.callbacks = this.presenter.getCallbacks();

		// Initialize presenter (triggers first render with data loading)
		await this.presenter.initialize();
	}

	async onClose(): Promise<void> {
		this.presenter.destroy();
		this.containerEl_ = null;
		this.headerEl = null;
		this.contentEl_ = null;
		this.listEl = null;
		this.detailEl = null;
	}

	// ========================================================================
	// Layout
	// ========================================================================

	private createLayout(): void {
		if (!this.containerEl_) return;

		// Header with tabs and actions
		this.headerEl = this.containerEl_.createDiv({ cls: 'library-header' });
		this.styleTopBar(this.headerEl);

		// Content area (list + detail)
		this.contentEl_ = this.containerEl_.createDiv({ cls: 'library-content' });
		this.contentEl_.style.display = 'flex';
		this.contentEl_.style.flex = '1';
		this.contentEl_.style.overflow = 'hidden';

		// List panel (left side)
		this.listEl = this.contentEl_.createDiv({ cls: 'library-list' });
		this.listEl.style.width = '280px';
		this.listEl.style.minWidth = '200px';
		this.listEl.style.borderRight = `1px solid ${BORDER_COLOR}`;
		this.listEl.style.overflowY = 'auto';

		// Detail panel (right side)
		this.detailEl = this.contentEl_.createDiv({ cls: 'library-detail' });
		this.detailEl.style.flex = '1';
		this.detailEl.style.overflowY = 'auto';
		this.detailEl.style.padding = '16px';
	}

	private styleTopBar(el: HTMLElement): void {
		el.style.display = 'flex';
		el.style.justifyContent = 'space-between';
		el.style.alignItems = 'center';
		el.style.padding = '8px 16px';
		el.style.borderBottom = `1px solid ${BORDER_COLOR}`;
		el.style.flexShrink = '0';
	}

	// ========================================================================
	// Rendering (Driven by Presenter State)
	// ========================================================================

	private render(state: LibraryState): void {
		this.renderHeader(state);
		this.renderList(state);
		this.renderDetail(state);
	}

	private renderHeader(state: LibraryState): void {
		if (!this.headerEl || !this.callbacks) return;
		this.headerEl.empty();

		// Tab buttons (left side)
		const tabsEl = this.headerEl.createDiv({ cls: 'library-tabs' });
		tabsEl.style.display = 'flex';
		tabsEl.style.gap = '4px';

		for (const type of ['creature', 'terrain'] as EntityType[]) {
			const btn = tabsEl.createEl('button', { text: TAB_LABELS[type] });
			btn.style.padding = '4px 12px';
			btn.style.borderRadius = '4px';
			btn.style.border = 'none';
			btn.style.cursor = 'pointer';

			if (type === state.activeTab) {
				btn.style.backgroundColor = 'var(--interactive-accent)';
				btn.style.color = 'var(--text-on-accent)';
			} else {
				btn.style.backgroundColor = 'var(--background-modifier-hover)';
				btn.style.color = 'var(--text-normal)';
			}

			const typeCopy = type;
			btn.addEventListener('click', () => this.callbacks?.onTabChange(typeCopy));
		}

		// Actions (right side)
		const actionsEl = this.headerEl.createDiv({ cls: 'library-actions' });
		actionsEl.style.display = 'flex';
		actionsEl.style.alignItems = 'center';
		actionsEl.style.gap = '8px';

		// Search input
		const searchInput = actionsEl.createEl('input', {
			type: 'text',
			placeholder: 'Search...',
		});
		searchInput.style.width = '150px';
		searchInput.style.padding = '4px 8px';
		searchInput.style.borderRadius = '4px';
		searchInput.style.border = `1px solid ${BORDER_COLOR}`;
		searchInput.style.backgroundColor = 'var(--background-primary)';
		searchInput.value = state.searchQuery;
		searchInput.addEventListener('input', (e) => {
			this.callbacks?.onSearch((e.target as HTMLInputElement).value);
		});

		// New button
		const newBtn = actionsEl.createEl('button', { text: '+ New' });
		newBtn.style.padding = '4px 12px';
		newBtn.style.borderRadius = '4px';
		newBtn.style.border = 'none';
		newBtn.style.backgroundColor = 'var(--interactive-accent)';
		newBtn.style.color = 'var(--text-on-accent)';
		newBtn.style.cursor = 'pointer';
		newBtn.addEventListener('click', () => this.callbacks?.onCreate());
	}

	private renderList(state: LibraryState): void {
		if (!this.listEl || !this.callbacks) return;
		this.listEl.empty();

		// Loading state
		if (state.isLoading) {
			const loadingEl = this.listEl.createDiv({ cls: 'library-loading' });
			loadingEl.style.padding = '24px';
			loadingEl.style.textAlign = 'center';
			loadingEl.style.color = TEXT_MUTED_COLOR;
			loadingEl.textContent = 'Loading...';
			return;
		}

		// Empty state
		if (state.filteredEntries.length === 0) {
			const emptyEl = this.listEl.createDiv({ cls: 'library-empty' });
			emptyEl.style.padding = '24px';
			emptyEl.style.textAlign = 'center';
			emptyEl.style.color = TEXT_MUTED_COLOR;
			emptyEl.textContent = state.searchQuery
				? 'No results found'
				: `No ${TAB_LABELS[state.activeTab].toLowerCase()} yet`;
			return;
		}

		// Entry list
		for (const entry of state.filteredEntries) {
			const itemEl = this.listEl.createDiv({ cls: 'library-list-item' });
			itemEl.style.padding = '10px 12px';
			itemEl.style.cursor = 'pointer';
			itemEl.style.borderBottom = `1px solid ${BORDER_COLOR}`;
			itemEl.style.transition = 'background-color 0.1s';

			// Selected state
			if (entry.id === state.selectedId) {
				itemEl.style.backgroundColor = 'var(--background-modifier-active-hover)';
			}

			// Name row
			const nameRow = itemEl.createDiv({ cls: 'library-item-name-row' });
			nameRow.style.display = 'flex';
			nameRow.style.alignItems = 'center';
			nameRow.style.gap = '8px';

			const nameEl = nameRow.createSpan({ cls: 'library-item-name' });
			nameEl.style.fontWeight = '500';
			nameEl.textContent = entry.name;

			// Preset badge
			if (entry.isPreset) {
				const badge = nameRow.createSpan({ cls: 'library-preset-badge' });
				badge.style.fontSize = '0.7em';
				badge.style.padding = '2px 6px';
				badge.style.borderRadius = '4px';
				badge.style.backgroundColor = 'var(--background-modifier-message)';
				badge.style.color = TEXT_MUTED_COLOR;
				badge.textContent = 'Preset';
			}

			// Subtitle (CR/type for creatures, color for terrains)
			if (state.activeTab === 'creature' && (entry.cr || entry.type)) {
				const subtitleEl = itemEl.createDiv({ cls: 'library-item-subtitle' });
				subtitleEl.style.fontSize = '0.85em';
				subtitleEl.style.color = TEXT_MUTED_COLOR;
				subtitleEl.style.marginTop = '2px';

				const parts: string[] = [];
				if (entry.cr) parts.push(`CR ${entry.cr}`);
				if (entry.type) parts.push(entry.type);
				subtitleEl.textContent = parts.join(' • ');
			} else if (state.activeTab === 'terrain' && entry.color) {
				const subtitleEl = itemEl.createDiv({ cls: 'library-item-subtitle' });
				subtitleEl.style.display = 'flex';
				subtitleEl.style.alignItems = 'center';
				subtitleEl.style.gap = '6px';
				subtitleEl.style.marginTop = '4px';

				const swatch = subtitleEl.createSpan();
				swatch.style.display = 'inline-block';
				swatch.style.width = '14px';
				swatch.style.height = '14px';
				swatch.style.borderRadius = '3px';
				swatch.style.backgroundColor = entry.color;
				swatch.style.border = `1px solid ${BORDER_COLOR}`;
			}

			// Hover effects
			itemEl.addEventListener('mouseenter', () => {
				if (entry.id !== state.selectedId) {
					itemEl.style.backgroundColor = 'var(--background-modifier-hover)';
				}
			});
			itemEl.addEventListener('mouseleave', () => {
				if (entry.id !== state.selectedId) {
					itemEl.style.backgroundColor = '';
				}
			});

			// Click to select
			itemEl.addEventListener('click', () => this.callbacks?.onSelect(entry.id));
		}
	}

	private renderDetail(state: LibraryState): void {
		if (!this.detailEl || !this.callbacks) return;
		this.detailEl.empty();

		// Empty state
		if (!state.selectedData) {
			const emptyEl = this.detailEl.createDiv({ cls: 'library-detail-empty' });
			emptyEl.style.textAlign = 'center';
			emptyEl.style.color = TEXT_MUTED_COLOR;
			emptyEl.style.marginTop = '60px';
			emptyEl.textContent = `Select a ${state.activeTab} to view details`;
			return;
		}

		const data = state.selectedData;

		// Header with name and actions
		const headerEl = this.detailEl.createDiv({ cls: 'library-detail-header' });
		headerEl.style.display = 'flex';
		headerEl.style.justifyContent = 'space-between';
		headerEl.style.alignItems = 'flex-start';
		headerEl.style.marginBottom = '20px';

		const titleEl = headerEl.createEl('h2');
		titleEl.style.margin = '0';
		titleEl.textContent = data.name;

		// Actions (delete button, only if not read-only)
		if (!state.isReadOnly) {
			const actionsEl = headerEl.createDiv({ cls: 'library-detail-actions' });
			const deleteBtn = actionsEl.createEl('button', { text: 'Delete' });
			deleteBtn.style.padding = '4px 12px';
			deleteBtn.style.borderRadius = '4px';
			deleteBtn.style.border = 'none';
			deleteBtn.style.backgroundColor = 'var(--background-modifier-error)';
			deleteBtn.style.color = 'var(--text-on-accent)';
			deleteBtn.style.cursor = 'pointer';
			deleteBtn.addEventListener('click', () => this.callbacks?.onDelete());
		} else {
			// Read-only badge for presets
			const badgeEl = headerEl.createDiv({ cls: 'library-readonly-badge' });
			badgeEl.style.fontSize = '0.85em';
			badgeEl.style.padding = '4px 10px';
			badgeEl.style.borderRadius = '4px';
			badgeEl.style.backgroundColor = 'var(--background-modifier-message)';
			badgeEl.style.color = TEXT_MUTED_COLOR;
			badgeEl.textContent = 'Bundled Preset';
		}

		// Details grid
		if (state.activeTab === 'creature') {
			this.renderCreatureDetail(data as StatblockData);
		} else {
			this.renderTerrainDetail(data as TerrainData);
		}

		// Body content (notes/description)
		if (state.selectedBody) {
			const bodyEl = this.detailEl.createDiv({ cls: 'library-detail-body' });
			bodyEl.style.marginTop = '24px';
			bodyEl.style.paddingTop = '16px';
			bodyEl.style.borderTop = `1px solid ${BORDER_COLOR}`;

			// Simple markdown-like rendering
			const paragraphs = state.selectedBody.split('\n\n');
			for (const para of paragraphs) {
				if (para.startsWith('## ')) {
					const h = bodyEl.createEl('h3');
					h.style.marginTop = '16px';
					h.style.marginBottom = '8px';
					h.textContent = para.substring(3);
				} else if (para.startsWith('*') && para.endsWith('*')) {
					const em = bodyEl.createEl('p');
					em.style.fontStyle = 'italic';
					em.style.color = TEXT_MUTED_COLOR;
					em.textContent = para.slice(1, -1);
				} else if (para.trim()) {
					const p = bodyEl.createEl('p');
					p.style.margin = '8px 0';
					p.textContent = para;
				}
			}
		}
	}

	private renderCreatureDetail(data: StatblockData): void {
		if (!this.detailEl) return;

		const gridEl = this.detailEl.createDiv({ cls: 'library-detail-grid' });
		gridEl.style.display = 'grid';
		gridEl.style.gridTemplateColumns = 'repeat(2, 1fr)';
		gridEl.style.gap = '12px';

		this.createField(gridEl, 'Type', data.type);
		this.createField(gridEl, 'Size', data.size);
		this.createField(gridEl, 'CR', data.cr);
		this.createField(gridEl, 'XP', data.xp);
		this.createField(gridEl, 'HP', data.hp);
		this.createField(gridEl, 'AC', data.ac);
		this.createField(gridEl, 'Hit Dice', data.hitDice);
		this.createField(gridEl, 'Speed', data.speeds);

		// Abilities
		if (data.abilities && data.abilities.length > 0) {
			const abilitiesEl = this.detailEl.createDiv({ cls: 'library-detail-abilities' });
			abilitiesEl.style.marginTop = '16px';

			const labelEl = abilitiesEl.createDiv();
			labelEl.style.fontSize = '0.85em';
			labelEl.style.color = TEXT_MUTED_COLOR;
			labelEl.style.marginBottom = '8px';
			labelEl.textContent = 'Abilities';

			const abilitiesGrid = abilitiesEl.createDiv();
			abilitiesGrid.style.display = 'flex';
			abilitiesGrid.style.gap = '16px';

			for (const ability of data.abilities) {
				const abilityEl = abilitiesGrid.createDiv();
				abilityEl.style.textAlign = 'center';

				const keyEl = abilityEl.createDiv();
				keyEl.style.fontSize = '0.8em';
				keyEl.style.color = TEXT_MUTED_COLOR;
				keyEl.style.textTransform = 'uppercase';
				keyEl.textContent = ability.key;

				const valueEl = abilityEl.createDiv();
				valueEl.style.fontWeight = '500';
				const mod = ability.modifier >= 0 ? `+${ability.modifier}` : `${ability.modifier}`;
				valueEl.textContent = `${ability.value} (${mod})`;
			}
		}

		// Terrain preference
		if (data.terrainPreference && data.terrainPreference.length > 0) {
			const terrainEl = this.detailEl.createDiv();
			terrainEl.style.marginTop = '16px';
			this.createField(terrainEl, 'Terrain Preference', data.terrainPreference.join(', '));
		}
	}

	private renderTerrainDetail(data: TerrainData): void {
		if (!this.detailEl) return;

		const gridEl = this.detailEl.createDiv({ cls: 'library-detail-grid' });
		gridEl.style.display = 'grid';
		gridEl.style.gridTemplateColumns = 'repeat(2, 1fr)';
		gridEl.style.gap = '12px';

		// Color with swatch
		const colorEl = gridEl.createDiv();
		const colorLabelEl = colorEl.createDiv();
		colorLabelEl.style.fontSize = '0.85em';
		colorLabelEl.style.color = TEXT_MUTED_COLOR;
		colorLabelEl.textContent = 'Color';

		const colorValueEl = colorEl.createDiv();
		colorValueEl.style.display = 'flex';
		colorValueEl.style.alignItems = 'center';
		colorValueEl.style.gap = '8px';
		colorValueEl.style.marginTop = '4px';

		const swatch = colorValueEl.createSpan();
		swatch.style.display = 'inline-block';
		swatch.style.width = '20px';
		swatch.style.height = '20px';
		swatch.style.borderRadius = '4px';
		swatch.style.backgroundColor = data.color;
		swatch.style.border = `1px solid ${BORDER_COLOR}`;

		colorValueEl.createSpan({ text: data.color });

		if (data.travelSpeed !== undefined) {
			this.createField(gridEl, 'Travel Speed', `${data.travelSpeed}x`);
		}

		// Native creatures
		if (data.nativeCreatures && data.nativeCreatures.length > 0) {
			const creaturesEl = this.detailEl.createDiv();
			creaturesEl.style.marginTop = '16px';
			this.createField(creaturesEl, 'Native Creatures', data.nativeCreatures.join(', '));
		}
	}

	private createField(container: HTMLElement, label: string, value?: string): void {
		if (!value) return;

		const fieldEl = container.createDiv({ cls: 'library-field' });

		const labelEl = fieldEl.createDiv();
		labelEl.style.fontSize = '0.85em';
		labelEl.style.color = TEXT_MUTED_COLOR;
		labelEl.textContent = label;

		const valueEl = fieldEl.createDiv();
		valueEl.style.marginTop = '2px';
		valueEl.textContent = value;
	}
}
