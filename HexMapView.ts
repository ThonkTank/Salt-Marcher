import { ItemView, WorkspaceLeaf } from "obsidian";

export const HEXMAP_VIEW_TYPE = "hexmap-view";

export interface HexTileData {
	x: number;
	y: number;
	feature?: string; // z.B. "forest", "river" etc.
}

export class HexMapView extends ItemView {
	// Map settings (prepare for future dynamic resizing!)
	mapWidth = 3;
	mapHeight = 3;

	// Tile data (expandable for features, travel time etc.)
	tiles: HexTileData[][] = [];
	selectedTile: HexTileData = { x: 0, y: 0 };

	detailsPanel: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.initializeTiles();
	}

	getViewType(): string {
		return HEXMAP_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Salt Marcher HexMap";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		const wrapper = container.createDiv({ cls: "hexmap-wrapper" });

		// Grid links
		const gridDiv = wrapper.createDiv({ cls: "hex-grid-container" });
		this.renderHexGrid(gridDiv);

		// Details Panel
		this.detailsPanel = wrapper.createDiv({ cls: "tile-details-panel" });
		this.updateDetailsPanel();

		console.debug("HexMapView: opened");
	}

	initializeTiles() {
		this.tiles = [];
		for (let y = 0; y < this.mapHeight; y++) {
			const row: HexTileData[] = [];
			for (let x = 0; x < this.mapWidth; x++) {
				row.push({ x, y });
			}
			this.tiles.push(row);
		}
		console.debug(`Initialized tiles for a ${this.mapWidth}x${this.mapHeight} grid`);
	}

	renderHexGrid(container: HTMLElement) {
		console.debug(`Rendering HexGrid (${this.mapWidth}x${this.mapHeight})`);
		for (let y = 0; y < this.mapHeight; y++) {
			for (let x = 0; x < this.mapWidth; x++) {
				const tileData = this.tiles[y][x];
				const tile = container.createDiv({ cls: "hex-tile" });
				tile.setAttr("data-x", x);
				tile.setAttr("data-y", y);
				tile.textContent = `(${x},${y})`;
				tile.onclick = () => this.tileClicked(tileData, tile, container);

				// Vorbereitung für Features:
				// if (tileData.feature) { tile.addClass(tileData.feature); }
			}
		}
	}

	tileClicked(tileData: HexTileData, clickedTile: HTMLElement, gridContainer: HTMLElement) {
		console.debug(`Tile clicked at (${tileData.x},${tileData.y})`);

		// Remove .selected from all tiles
		const tiles = gridContainer.querySelectorAll(".hex-tile");
		tiles.forEach(tile => tile.classList.remove("selected"));

		// Add .selected to the clicked tile
		clickedTile.classList.add("selected");

		// Update details panel
		this.selectedTile = tileData;
		this.updateDetailsPanel();
	}

	updateDetailsPanel() {
		if (!this.detailsPanel) return;
		this.detailsPanel.empty();
		this.detailsPanel.createEl("div", { text: "Selected Tile:" });
		this.detailsPanel.createEl("div", { text: `X: ${this.selectedTile.x}, Y: ${this.selectedTile.y}` });

		// Vorbereitung für Feature-Infos:
		if (this.selectedTile.feature) {
			this.detailsPanel.createEl("div", { text: `Feature: ${this.selectedTile.feature}` });
		}

		// Vorbereitung für Reisezeit:
		// this.detailsPanel.createEl("div", { text: `Travel Time: ...` });

		console.debug("Updated selection panel");
	}

	async onClose() {
		// Clean up if needed
	}
}
