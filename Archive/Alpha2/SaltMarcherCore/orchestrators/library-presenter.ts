/**
 * Library Presenter
 *
 * Manages state and event handling for library browsing and editing.
 * Handles creatures and terrains (extensible to other entity types).
 * UI rendering is delegated to LibraryView (Adapters layer).
 *
 * @module SaltMarcherCore/orchestrators/library-presenter
 */

import type {
	EntityType,
	IndexEntry,
	ILibraryStore,
} from '../../Shared/schemas';
import type { StatblockData, TerrainData } from '../schemas';
import {
	getCreaturePresets,
	getCreatureById,
	presetToStatblock,
} from '../utils';
import { BasePresenter } from '../../Shared/base-presenter';

// ============================================================================
// Types
// ============================================================================

export type LibraryCallbacks = {
	onTabChange: (tab: EntityType) => void;
	onSelect: (id: string) => void;
	onCreate: () => void;
	onDelete: () => void;
	onSearch: (query: string) => void;
};

export type LibraryState = {
	activeTab: EntityType;
	entries: IndexEntry[];
	filteredEntries: IndexEntry[];
	selectedId: string | null;
	selectedData: StatblockData | TerrainData | null;
	selectedBody: string;
	searchQuery: string;
	isLoading: boolean;
	isReadOnly: boolean; // True when viewing a bundled preset
};

export type RenderCallback = (state: LibraryState) => void;

// ============================================================================
// LibraryPresenter
// ============================================================================

export class LibraryPresenter extends BasePresenter<LibraryState, LibraryCallbacks> {
	private state: LibraryState;
	private store: ILibraryStore;

	constructor(store: ILibraryStore) {
		super();
		this.store = store;

		// Initialize state
		this.state = {
			activeTab: 'creature',
			entries: [],
			filteredEntries: [],
			selectedId: null,
			selectedData: null,
			selectedBody: '',
			searchQuery: '',
			isLoading: false,
			isReadOnly: false,
		};
	}

	// ========================================================================
	// View Connection
	// ========================================================================

	/**
	 * Get callbacks for View events
	 */
	getCallbacks(): LibraryCallbacks {
		return {
			onTabChange: (tab) => this.handleTabChange(tab),
			onSelect: (id) => this.handleSelect(id),
			onCreate: () => this.handleCreate(),
			onDelete: () => this.handleDelete(),
			onSearch: (query) => this.handleSearch(query),
		};
	}

	/**
	 * Initialize presenter (load initial data)
	 */
	async initialize(): Promise<void> {
		await this.loadEntries();
		this.updateView();
	}

	// ========================================================================
	// Event Handlers
	// ========================================================================

	async handleTabChange(tab: EntityType): Promise<void> {
		if (tab === this.state.activeTab) return;

		this.state.activeTab = tab;
		this.state.selectedId = null;
		this.state.selectedData = null;
		this.state.selectedBody = '';
		this.state.searchQuery = '';

		await this.loadEntries();
		this.updateView();
	}

	async handleSelect(id: string): Promise<void> {
		if (id === this.state.selectedId) return;

		this.state.selectedId = id;

		// Check if it's a bundled preset first (creatures only)
		if (this.state.activeTab === 'creature') {
			const preset = getCreatureById(id);
			if (preset) {
				this.state.selectedData = presetToStatblock(preset);
				this.state.selectedBody = this.generatePresetBody(preset);
				this.state.isReadOnly = true;
				this.updateView();
				return;
			}
		}

		// Load from user store
		const loaded = await this.store.load<StatblockData | TerrainData>(
			this.state.activeTab,
			id
		);

		if (loaded) {
			this.state.selectedData = loaded.data;
			this.state.selectedBody = loaded.body;
		} else {
			this.state.selectedData = null;
			this.state.selectedBody = '';
		}
		this.state.isReadOnly = false;

		this.updateView();
	}

	/**
	 * Generate a display body for a bundled preset.
	 */
	private generatePresetBody(preset: { size?: string; type: string; traits?: string; actions?: string }): string {
		const lines: string[] = [];
		if (preset.size && preset.type) {
			lines.push(`*${preset.size} ${preset.type}*`);
		}
		if (preset.traits) {
			lines.push('', '## Traits', '', preset.traits);
		}
		if (preset.actions) {
			lines.push('', '## Actions', '', preset.actions);
		}
		return lines.join('\n');
	}

	async handleCreate(): Promise<void> {
		const id = this.generateId();
		const name = `New ${this.state.activeTab === 'creature' ? 'Creature' : 'Terrain'}`;

		let data: StatblockData | TerrainData;

		if (this.state.activeTab === 'creature') {
			data = {
				name,
				type: 'humanoid',
				size: 'Medium',
				cr: '1',
				hp: '10',
				ac: '10',
			} as StatblockData;
		} else {
			data = {
				id,
				name,
				color: '#808080',
				nativeCreatures: [],
			} as TerrainData;
		}

		// Ensure id is set
		(data as Record<string, unknown>).id = id;

		await this.store.save(this.state.activeTab, id, data as Record<string, unknown>);
		await this.loadEntries();

		// Select the new entity
		await this.handleSelect(id);
	}

	async handleDelete(): Promise<void> {
		if (!this.state.selectedId) return;

		// Prevent deletion of bundled presets
		if (this.state.isReadOnly) {
			console.warn('[Library] Cannot delete bundled presets');
			return;
		}

		// Simple confirmation
		const confirmed = confirm(
			`Delete "${this.state.selectedData?.name}"? This cannot be undone.`
		);
		if (!confirmed) return;

		await this.store.delete(this.state.activeTab, this.state.selectedId);

		this.state.selectedId = null;
		this.state.selectedData = null;
		this.state.selectedBody = '';

		await this.loadEntries();
		this.updateView();
	}

	handleSearch(query: string): void {
		this.state.searchQuery = query;
		this.filterEntries();
		this.updateView();
	}

	// ========================================================================
	// Data Loading
	// ========================================================================

	private async loadEntries(): Promise<void> {
		this.state.isLoading = true;
		this.updateView();

		try {
			if (this.state.activeTab === 'creature') {
				// Merge bundled presets with user creatures
				const presetEntries: IndexEntry[] = getCreaturePresets().map((p) => ({
					id: p.id,
					name: p.name,
					cr: p.cr,
					type: p.type,
					isPreset: true,
				}));

				const userEntries = await this.store.list('creature');

				// Combine: presets first, then user creatures
				this.state.entries = [...presetEntries, ...userEntries];
			} else {
				// Terrains only from user store
				this.state.entries = await this.store.list(this.state.activeTab);
			}
			this.filterEntries();
		} catch (e) {
			console.error('Failed to load entries:', e);
			this.state.entries = [];
			this.state.filteredEntries = [];
		}

		this.state.isLoading = false;
	}

	private filterEntries(): void {
		const query = this.state.searchQuery.toLowerCase();

		if (!query) {
			this.state.filteredEntries = [...this.state.entries];
			return;
		}

		this.state.filteredEntries = this.state.entries.filter((entry) => {
			if (entry.name.toLowerCase().includes(query)) return true;
			if (entry.type?.toLowerCase().includes(query)) return true;
			if (entry.cr?.toLowerCase().includes(query)) return true;
			return false;
		});
	}

	// ========================================================================
	// Helpers
	// ========================================================================

	private generateId(): string {
		return `${this.state.activeTab}-${Date.now().toString(36)}`;
	}

	protected updateView(): void {
		super.updateView(this.state);
	}

	// ========================================================================
	// Public API
	// ========================================================================

	getState(): Readonly<LibraryState> {
		return this.state;
	}

	destroy(): void {
		super.destroy();
	}
}
