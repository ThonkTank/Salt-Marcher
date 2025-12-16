/**
 * Library View
 *
 * Obsidian ItemView for the library panel.
 * Handles all DOM manipulation and rendering.
 * Receives state from LibraryPresenter via render() callback.
 *
 * @module adapters/library-view
 */

import type { WorkspaceLeaf } from 'obsidian';
import type { StatblockData, TerrainData, EntityType } from '../../schemas';
import {
	LibraryPresenter,
	type LibraryState,
	type LibraryCallbacks,
} from '../../orchestrators/library';
import { LibraryStore } from './library-store';
import {
	BaseItemView,
	styleTopBar,
	createFlexContainer,
	createSidePanel,
	createActionGroup,
	createStackedField,
	createSimpleButtonToggle,
	createGrid,
	createDetailHeader,
	createEmptyHint,
	type SelectOption,
} from '../shared';
import { BORDER_COLOR, TEXT_MUTED_COLOR } from '../../constants/ui-styles';

// ============================================================================
// Constants
// ============================================================================

export const LIBRARY_VIEW_TYPE = 'salt-marcher-library';

const TAB_LABELS: Record<EntityType, string> = {
	creature: 'Creatures',
	terrain: 'Terrains',
};

// ============================================================================
// LibraryView
// ============================================================================

export class LibraryView extends BaseItemView<LibraryState, LibraryCallbacks> {
	// UI Elements
	private headerEl: HTMLElement | null = null;
	private contentEl_: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;
	private detailEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	// ========================================================================
	// Obsidian ItemView Requirements
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

	// ========================================================================
	// BaseItemView Implementation
	// ========================================================================

	protected getContainerClass(): string {
		return 'library-container';
	}

	protected createLayout(container: HTMLElement): void {
		// Header with tabs and actions
		this.headerEl = container.createDiv({ cls: 'library-header' });
		styleTopBar(this.headerEl);

		// Content area (list + detail)
		this.contentEl_ = createFlexContainer(container, 'library-content');

		// List panel
		this.listEl = createSidePanel(this.contentEl_, 'library-list', 250, 'left');

		// Detail panel
		this.detailEl = this.contentEl_.createDiv({ cls: 'library-detail' });
		this.detailEl.style.flex = '1';
		this.detailEl.style.overflowY = 'auto';
		this.detailEl.style.padding = '16px';
	}

	protected createPresenter(): LibraryPresenter {
		const store = new LibraryStore(this.app.vault, 'SaltMarcher');
		return new LibraryPresenter(store);
	}

	protected cleanupDomRefs(): void {
		this.headerEl = null;
		this.contentEl_ = null;
		this.listEl = null;
		this.detailEl = null;
	}

	// ========================================================================
	// Rendering
	// ========================================================================

	protected render(state: LibraryState): void {
		this.renderHeader(state);
		this.renderList(state);
		this.renderDetail(state);
	}

	private renderHeader(state: LibraryState): void {
		if (!this.headerEl || !this.callbacks) return;
		this.headerEl.empty();

		// Tabs
		const tabOptions: SelectOption<EntityType>[] = [
			{ value: 'creature', label: TAB_LABELS.creature },
			{ value: 'terrain', label: TAB_LABELS.terrain },
		];
		createSimpleButtonToggle(this.headerEl, tabOptions, state.activeTab, (type) => {
			this.callbacks?.onTabChange(type);
		});

		// Actions
		const actionsEl = createActionGroup(this.headerEl, 'library-actions');

		// Search
		const searchInput = actionsEl.createEl('input', {
			type: 'text',
			placeholder: 'Search...',
		});
		searchInput.style.width = '150px';
		searchInput.value = state.searchQuery;
		searchInput.addEventListener('input', (e) => {
			this.callbacks?.onSearch((e.target as HTMLInputElement).value);
		});

		// New button
		const newBtn = actionsEl.createEl('button', { text: '+ New' });
		newBtn.addEventListener('click', () => this.callbacks?.onCreate());
	}

	private renderList(state: LibraryState): void {
		if (!this.listEl || !this.callbacks) return;
		this.listEl.empty();

		if (state.isLoading) {
			this.listEl.createDiv({ text: 'Loading...', cls: 'library-loading' });
			return;
		}

		if (state.filteredEntries.length === 0) {
			const emptyEl = this.listEl.createDiv({ cls: 'library-empty' });
			emptyEl.style.padding = '16px';
			emptyEl.style.color = TEXT_MUTED_COLOR;
			emptyEl.textContent = state.searchQuery
				? 'No results found'
				: `No ${TAB_LABELS[state.activeTab].toLowerCase()} yet`;
			return;
		}

		for (const entry of state.filteredEntries) {
			const itemEl = this.listEl.createDiv({ cls: 'library-list-item' });
			itemEl.style.padding = '8px 12px';
			itemEl.style.cursor = 'pointer';
			itemEl.style.borderBottom = `1px solid ${BORDER_COLOR}`;

			if (entry.id === state.selectedId) {
				itemEl.style.backgroundColor = 'var(--background-modifier-active-hover)';
			}

			// Name
			const nameEl = itemEl.createDiv({ cls: 'library-item-name' });
			nameEl.style.fontWeight = '500';
			nameEl.textContent = entry.name;

			// Subtitle (CR for creatures, color for terrains)
			if (state.activeTab === 'creature' && entry.cr) {
				const subtitleEl = itemEl.createDiv({ cls: 'library-item-subtitle' });
				subtitleEl.style.fontSize = '0.85em';
				subtitleEl.style.color = TEXT_MUTED_COLOR;
				subtitleEl.textContent = `CR ${entry.cr}${entry.type ? ` • ${entry.type}` : ''}`;
			} else if (state.activeTab === 'terrain' && entry.color) {
				const subtitleEl = itemEl.createDiv({ cls: 'library-item-subtitle' });
				subtitleEl.style.display = 'flex';
				subtitleEl.style.alignItems = 'center';
				subtitleEl.style.gap = '4px';

				const colorSwatch = subtitleEl.createSpan();
				colorSwatch.style.display = 'inline-block';
				colorSwatch.style.width = '12px';
				colorSwatch.style.height = '12px';
				colorSwatch.style.borderRadius = '2px';
				colorSwatch.style.backgroundColor = entry.color;
			}

			itemEl.addEventListener('click', () => this.callbacks?.onSelect(entry.id));
		}
	}

	private renderDetail(state: LibraryState): void {
		if (!this.detailEl || !this.callbacks) return;
		this.detailEl.empty();

		if (!state.selectedData) {
			const hint = createEmptyHint(this.detailEl, `Select a ${state.activeTab} to view details`, 'library-detail-empty');
			hint.style.marginTop = '40px';
			return;
		}

		const data = state.selectedData;

		// Header with name and actions
		const { actions } = createDetailHeader(this.detailEl, data.name, 'library-detail-header');

		const deleteBtn = actions.createEl('button', { text: 'Delete' });
		deleteBtn.classList.add('mod-warning');
		deleteBtn.addEventListener('click', () => this.callbacks?.onDelete());

		// Details
		if (state.activeTab === 'creature') {
			this.renderCreatureDetail(data as StatblockData);
		} else {
			this.renderTerrainDetail(data as TerrainData);
		}

		// Body content
		if (state.selectedBody) {
			const bodyEl = this.detailEl.createDiv({ cls: 'library-detail-body' });
			bodyEl.style.marginTop = '24px';
			bodyEl.style.paddingTop = '16px';
			bodyEl.style.borderTop = `1px solid ${BORDER_COLOR}`;

			// Simple markdown rendering (just paragraphs for now)
			const paragraphs = state.selectedBody.split('\n\n');
			for (const para of paragraphs) {
				if (para.startsWith('## ')) {
					const h = bodyEl.createEl('h3');
					h.textContent = para.substring(3);
				} else if (para.trim()) {
					const p = bodyEl.createEl('p');
					p.textContent = para;
				}
			}
		}
	}

	private renderCreatureDetail(data: StatblockData): void {
		if (!this.detailEl) return;

		const gridEl = createGrid(this.detailEl, 2, '12px', 'library-detail-grid');

		createStackedField(gridEl, 'Type', data.type, { skipIfEmpty: true });
		createStackedField(gridEl, 'Size', data.size, { skipIfEmpty: true });
		createStackedField(gridEl, 'CR', data.cr, { skipIfEmpty: true });
		createStackedField(gridEl, 'HP', data.hp, { skipIfEmpty: true });
		createStackedField(gridEl, 'AC', data.ac, { skipIfEmpty: true });
		createStackedField(gridEl, 'Hit Dice', data.hitDice, { skipIfEmpty: true });

		if (data.terrainPreference && data.terrainPreference.length > 0) {
			createStackedField(gridEl, 'Terrain', data.terrainPreference.join(', '));
		}
	}

	private renderTerrainDetail(data: TerrainData): void {
		if (!this.detailEl) return;

		const gridEl = createGrid(this.detailEl, 2, '12px', 'library-detail-grid');

		// Color with swatch (custom rendering for color preview)
		const colorEl = gridEl.createDiv();
		const labelEl = colorEl.createDiv({ text: 'Color' });
		labelEl.style.fontSize = '0.85em';
		labelEl.style.color = TEXT_MUTED_COLOR;

		const valueEl = colorEl.createDiv();
		valueEl.style.display = 'flex';
		valueEl.style.alignItems = 'center';
		valueEl.style.gap = '8px';

		const swatch = valueEl.createSpan();
		swatch.style.display = 'inline-block';
		swatch.style.width = '20px';
		swatch.style.height = '20px';
		swatch.style.borderRadius = '4px';
		swatch.style.backgroundColor = data.color;

		valueEl.createSpan({ text: data.color });

		if (data.travelSpeed !== undefined) {
			createStackedField(gridEl, 'Travel Speed', `${data.travelSpeed}x`);
		}

		if (data.nativeCreatures && data.nativeCreatures.length > 0) {
			const creaturesEl = this.detailEl!.createDiv();
			creaturesEl.style.marginTop = '16px';
			createStackedField(creaturesEl, 'Native Creatures', data.nativeCreatures.join(', '));
		}
	}
}
