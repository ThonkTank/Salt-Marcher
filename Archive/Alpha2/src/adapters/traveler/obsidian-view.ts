/**
 * Traveler Obsidian View
 *
 * Obsidian ItemView wrapper for the Traveler mode.
 * Allows traveling a token across the hex map.
 *
 * @module adapters/traveler-obsidian-view
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type {
	AxialCoord,
	CoordKey,
	TileData,
	MapData,
	CalendarState,
} from '../../schemas';
import type { MapContext } from '../../orchestrators/traveler';
import { TravelerView } from './traveler-view';
import { MapStore } from '../map';
import { CalendarStore } from '../calendar';
import { LibraryStore } from '../library';
import { MapSelectModal, initializeViewContainer, styleTopBar } from '../shared';
import { coordsInRadius, coordToKey } from '../../utils/hex';
import { DEFAULT_CAMERA_STATE } from '../../utils/render';

// ============================================================================
// Constants
// ============================================================================

export const TRAVELER_VIEW_TYPE = 'salt-marcher-traveler';

// ============================================================================
// Default Map Generation (for demo)
// ============================================================================

function generateDemoMap(radius: number): {
    tiles: Map<CoordKey, TileData>;
    coords: AxialCoord[];
} {
    const coords = coordsInRadius({ q: 0, r: 0 }, radius);
    const tiles = new Map<CoordKey, TileData>();

    for (const coord of coords) {
        const key = coordToKey(coord);
        tiles.set(key, {
            terrain: 'grassland',
            climate: {
                temperature: 6,
                precipitation: 6,
                clouds: 6,
                wind: 6,
            },
            elevation: 100,
        });
    }

    return { tiles, coords };
}

// ============================================================================
// TravelerObsidianView
// ============================================================================

export class TravelerObsidianView extends ItemView {
	private travelerView: TravelerView | null = null;
	private store: MapStore | null = null;
	private calendarStore: CalendarStore | null = null;
	private libraryStore: LibraryStore | null = null;
	private mapContext: MapContext | null = null;

	// TopBar elements
	private topBarEl: HTMLElement | null = null;
	private mapContentEl: HTMLElement | null = null;
	private currentMapName: string = 'No Map';

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return TRAVELER_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Traveler';
    }

    getIcon(): string {
        return 'footprints';
    }

    async onOpen(): Promise<void> {
        const container = initializeViewContainer(this, {
            className: 'salt-marcher-traveler',
        });

        // Create TopBar
        this.topBarEl = container.createDiv({ cls: 'traveler-topbar' });
        styleTopBar(this.topBarEl);
        this.topBarEl.style.flexShrink = '0';

        // Create content container
        this.mapContentEl = container.createDiv({ cls: 'traveler-content' });
        this.mapContentEl.style.cssText = 'flex: 1; overflow: hidden;';

// Create stores for loading maps, calendar, and library (creatures/terrains)
		this.store = new MapStore(this.app.vault, 'SaltMarcher/maps');
		this.calendarStore = new CalendarStore(this.app.vault);
		this.libraryStore = new LibraryStore(this.app.vault, 'SaltMarcher/library');

		// Load calendar state
		const calendarState = await this.calendarStore.load();

		// Try to load first available map, or create demo
        const maps = await this.store.list();
        let mapData: MapData | null = null;

        if (maps.length > 0) {
            mapData = await this.store.load(maps[0].id);
            this.currentMapName = maps[0].name;
        }

        let tiles: Map<CoordKey, TileData>;
        let coords: AxialCoord[];
        let center: AxialCoord = { q: 0, r: 0 };

        if (mapData) {
            // Use loaded map
            tiles = new Map(Object.entries(mapData.tiles) as [CoordKey, TileData][]);
            coords = Array.from(tiles.keys()).map(key => {
                const [q, r] = key.split(',').map(Number);
                return { q, r };
            });
            center = mapData.metadata.center ?? { q: 0, r: 0 };
        } else {
            // Generate demo map
            const demo = generateDemoMap(5);
            tiles = demo.tiles;
            coords = demo.coords;
            this.currentMapName = 'Demo Map';
        }

        // Create map context
        this.mapContext = {
            tiles,
            coords,
            hexSize: 30,
            padding: 50,
            center,
            camera: DEFAULT_CAMERA_STATE,
        };

        // Render TopBar
        this.renderTopBar();

// Initial position at center
		const initialPosition = center;

		// Create traveler view in content container with calendar state
		this.travelerView = new TravelerView(
			this.mapContentEl,
			this.mapContext,
			initialPosition,
			calendarState
		);

		// Set library store for dynamic creature lookup in encounters
		if (this.libraryStore) {
			this.travelerView.setLibraryStore(this.libraryStore);
		}
	}

    // ========================================================================
    // TopBar
    // ========================================================================

    private renderTopBar(): void {
        if (!this.topBarEl) return;
        this.topBarEl.empty();

        // Map name (left)
        const nameEl = this.topBarEl.createSpan();
        nameEl.style.fontWeight = '600';
        nameEl.textContent = this.currentMapName;

        // Actions (right)
        const actions = this.topBarEl.createDiv();
        actions.style.display = 'flex';
        actions.style.gap = '8px';

        const openBtn = actions.createEl('button', { text: 'Open Map' });
        openBtn.addEventListener('click', () => this.handleOpenClick());

        const resetBtn = actions.createEl('button', { text: 'Reset View' });
        resetBtn.addEventListener('click', () => this.handleResetCamera());
    }

    private async handleOpenClick(): Promise<void> {
        if (!this.store) return;
        const maps = await this.store.list();
        if (maps.length === 0) return;

        const modal = new MapSelectModal(this.app, maps, async (selected) => {
            if (selected) {
                await this.loadMap(selected.id, selected.name);
            }
        });
        modal.open();
    }

    private async loadMap(mapId: string, mapName: string): Promise<void> {
        if (!this.store || !this.mapContentEl) return;

        const mapData = await this.store.load(mapId);
        if (!mapData) return;

        // Destroy existing view
        this.travelerView?.destroy();

        // Create new context
        const tiles = new Map(Object.entries(mapData.tiles) as [CoordKey, TileData][]);
        const coords = Array.from(tiles.keys()).map(key => {
            const [q, r] = key.split(',').map(Number);
            return { q, r };
        });
        const center = mapData.metadata.center ?? { q: 0, r: 0 };

        this.mapContext = {
            tiles,
            coords,
            hexSize: 30,
            padding: 50,
            center,
            camera: DEFAULT_CAMERA_STATE,
        };

// Update map name and re-render TopBar
		this.currentMapName = mapName;
		this.renderTopBar();

		// Get current calendar state (preserve it across map changes)
		const calendarState = this.calendarStore
			? await this.calendarStore.load()
			: undefined;

		// Create new view with preserved calendar state
		this.travelerView = new TravelerView(
			this.mapContentEl,
			this.mapContext,
			center,
			calendarState
		);

		// Set library store for dynamic creature lookup in encounters
		if (this.libraryStore) {
			this.travelerView.setLibraryStore(this.libraryStore);
		}
	}

    private handleResetCamera(): void {
        if (this.travelerView && this.mapContext) {
            this.travelerView.updateMapContext({ camera: DEFAULT_CAMERA_STATE });
        }
    }

async onClose(): Promise<void> {
		// Save calendar state before closing
		if (this.calendarStore && this.travelerView) {
			const calendarState = this.travelerView.getCalendarState();
			await this.calendarStore.save(calendarState);
		}

		this.travelerView?.destroy();
		this.travelerView = null;
		this.store = null;
		this.calendarStore = null;
		this.libraryStore = null;
		this.mapContext = null;
	}
}
