/**
 * Inspector Tool Component.
 *
 * Task #2534: Inspector Tool Component (Alle Map-Typen)
 * Spec: Cartographer.md#inspector-alle-map-typen
 *
 * Shows tile details for selected/hovered tiles:
 * - Coordinates (Hex or Grid)
 * - Terrain (type, movement cost)
 * - Elevation (height, slope)
 * - Climate (derived values)
 * - Features (list with add/remove)
 * - Locations (POI links)
 * - Factions (presence percentages)
 */

import type { EntityId } from '@core/types';
import type { HexCoordinate, GridCoordinate, OverworldTile, TerrainDefinition } from '@core/schemas';
import { isSome } from '@core/index';
import type { CartographerState, Coordinate } from '../types';
import type { MapFeaturePort } from '@/features/map';

// ============================================================================
// Types
// ============================================================================

/**
 * Tile data for display in the Inspector.
 */
export interface InspectorTileData {
  coord: Coordinate;
  terrain: {
    name: string;
    movementCost: number;
  } | null;
  elevation: number | null;
  pois: Array<{ id: EntityId<'poi'>; name: string }>;
  factions: Array<{ name: string; percentage: number }>;
  notes: string | null;
}

// ============================================================================
// Panel Interface
// ============================================================================

/**
 * Inspector Tool panel interface.
 * Follows panel pattern from session-runner/panels/ and cartographer/panels/.
 */
export interface InspectorToolPanel {
  /**
   * Update the panel with new state.
   * Called when CartographerState changes with 'selection' or 'full' hint.
   */
  update(state: Readonly<CartographerState>): void;

  /**
   * Dispose the panel and clean up event listeners.
   */
  dispose(): void;
}

/**
 * Callbacks for user interactions with the Inspector panel.
 * Most are placeholders for future tasks.
 */
export interface InspectorToolCallbacks {
  /** Change terrain type (#2503) */
  onChangeTerrain: () => void;
  /** Edit elevation value (#2504) */
  onEditElevation: () => void;
  /** Edit climate override (#2507) */
  onEditClimateOverride: () => void;
  /** Add a feature (#2508) */
  onAddFeature: () => void;
  /** Remove a feature */
  onRemoveFeature: (featureId: string) => void;
  /** Navigate to a location (opens POI in Library) */
  onNavigateToLocation: (locationId: EntityId<'poi'>) => void;
}

/**
 * Dependencies for the Inspector panel.
 */
export interface InspectorToolDeps {
  /** Map feature for tile data lookup */
  mapFeature: MapFeaturePort;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an Inspector Tool panel.
 *
 * @param container - Parent element to mount the panel in
 * @param callbacks - Callbacks for user interactions
 * @param deps - Dependencies (mapFeature for tile lookup)
 * @returns InspectorToolPanel instance
 */
export function createInspectorToolPanel(
  container: HTMLElement,
  callbacks: InspectorToolCallbacks,
  deps: InspectorToolDeps
): InspectorToolPanel {
  const { mapFeature } = deps;

  // Create main panel element
  const panelEl = document.createElement('div');
  panelEl.className = 'inspector-tool-panel';
  panelEl.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    overflow-y: auto;
  `;
  container.appendChild(panelEl);

  // Create header
  const headerEl = createHeader();
  panelEl.appendChild(headerEl);

  // Create content container (populated on update)
  const contentEl = document.createElement('div');
  contentEl.className = 'inspector-content';
  panelEl.appendChild(contentEl);

  // =========================================================================
  // Helpers
  // =========================================================================

  function createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'inspector-header';
    header.style.cssText = `
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      color: var(--text-muted);
      padding-bottom: 8px;
      border-bottom: 1px solid var(--background-modifier-border);
    `;
    header.textContent = 'INSPECTOR';
    return header;
  }

  function createSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'inspector-section';
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'section-title';
    sectionTitle.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;
    sectionTitle.textContent = title;

    const sectionContent = document.createElement('div');
    sectionContent.className = 'section-content';
    sectionContent.style.cssText = `
      font-size: 12px;
      color: var(--text-normal);
    `;

    section.appendChild(sectionTitle);
    section.appendChild(sectionContent);
    return section;
  }

  function createRow(label: string, value: string): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2px 0;
    `;

    const labelEl = document.createElement('span');
    labelEl.style.color = 'var(--text-muted)';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
  }

  function createButton(
    label: string,
    onClick: () => void,
    style: 'default' | 'link' = 'default'
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText =
      style === 'link'
        ? `
            background: transparent;
            border: none;
            color: var(--text-accent);
            cursor: pointer;
            padding: 0;
            font-size: 12px;
            text-decoration: underline;
          `
        : `
            background: var(--interactive-normal);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 11px;
            color: var(--text-normal);
            cursor: pointer;
            transition: background 0.1s;
          `;

    btn.addEventListener('mouseenter', () => {
      if (style !== 'link') {
        btn.style.background = 'var(--interactive-hover)';
      }
    });
    btn.addEventListener('mouseleave', () => {
      if (style !== 'link') {
        btn.style.background = 'var(--interactive-normal)';
      }
    });
    btn.addEventListener('click', onClick);

    return btn;
  }

  function formatCoordinate(coord: Coordinate): string {
    if ('q' in coord) {
      // HexCoordinate
      return `Hex (${coord.q}, ${coord.r})`;
    } else {
      // GridCoordinate
      const gridCoord = coord as GridCoordinate;
      return `Grid (${gridCoord.x}, ${gridCoord.y}${gridCoord.z !== undefined ? `, ${gridCoord.z}` : ''})`;
    }
  }

  function getTileData(coord: Coordinate): InspectorTileData | null {
    // Only HexCoordinate is supported for now (MVP: Overworld only)
    if (!('q' in coord)) {
      return null;
    }

    const hexCoord = coord as HexCoordinate;
    const tileOpt = mapFeature.getTile(hexCoord);
    if (!isSome(tileOpt)) {
      return null;
    }

    const tile = tileOpt.value;
    const terrainOpt = mapFeature.getTerrainAt(hexCoord);

    let terrain: InspectorTileData['terrain'] = null;
    if (isSome(terrainOpt)) {
      terrain = {
        name: terrainOpt.value.name,
        movementCost: terrainOpt.value.movementCost,
      };
    }

    // Convert faction presence to display format
    const factions = tile.factionPresence.map((fp) => ({
      name: fp.factionId, // TODO: Lookup faction name from EntityRegistry
      percentage: Math.round(fp.strength * 100),
    }));

    // Convert POI IDs to display format (names would need EntityRegistry lookup)
    const pois = tile.pois.map((poiId) => ({
      id: poiId,
      name: poiId, // TODO: Lookup POI name from EntityRegistry
    }));

    return {
      coord,
      terrain,
      elevation: tile.elevation ?? null,
      pois,
      factions,
      notes: tile.notes ?? null,
    };
  }

  function renderNoSelection(): void {
    contentEl.innerHTML = '';

    const empty = document.createElement('div');
    empty.style.cssText = `
      color: var(--text-faint);
      font-style: italic;
      font-size: 12px;
      padding: 16px 0;
      text-align: center;
    `;
    empty.textContent = 'No tile selected';
    contentEl.appendChild(empty);

    const hint = document.createElement('div');
    hint.style.cssText = `
      color: var(--text-muted);
      font-size: 11px;
      text-align: center;
    `;
    hint.textContent = 'Click on a tile to inspect';
    contentEl.appendChild(hint);
  }

  function renderTileData(data: InspectorTileData): void {
    contentEl.innerHTML = '';

    // === Selected Coordinates ===
    const coordSection = createSection('Selected');
    const coordContent = coordSection.querySelector('.section-content') as HTMLElement;
    coordContent.textContent = formatCoordinate(data.coord);
    contentEl.appendChild(coordSection);

    // === Terrain ===
    const terrainSection = createSection('Terrain');
    const terrainContent = terrainSection.querySelector('.section-content') as HTMLElement;

    if (data.terrain) {
      terrainContent.appendChild(createRow('Type:', data.terrain.name));
      terrainContent.appendChild(createRow('Movement Cost:', `${data.terrain.movementCost}`));

      const changeBtn = createButton('[Change Terrain...]', callbacks.onChangeTerrain, 'link');
      changeBtn.style.marginTop = '4px';
      terrainContent.appendChild(changeBtn);
    } else {
      terrainContent.textContent = 'Unknown terrain';
    }
    contentEl.appendChild(terrainSection);

    // === Elevation ===
    const elevSection = createSection('Elevation');
    const elevContent = elevSection.querySelector('.section-content') as HTMLElement;

    if (data.elevation !== null) {
      elevContent.appendChild(createRow('Height:', `${data.elevation}m`));
      // TODO: Calculate slope from neighboring tiles
      elevContent.appendChild(createRow('Slope:', 'N/A'));

      const editBtn = createButton('[Edit Elevation...]', callbacks.onEditElevation, 'link');
      editBtn.style.marginTop = '4px';
      elevContent.appendChild(editBtn);
    } else {
      elevContent.textContent = 'Not set';
    }
    contentEl.appendChild(elevSection);

    // === Climate (Derived) ===
    const climateSection = createSection('Climate (Derived)');
    const climateContent = climateSection.querySelector('.section-content') as HTMLElement;

    // Climate is computed by Environment feature - placeholder for MVP
    climateContent.appendChild(createRow('Base Temp:', 'N/A'));
    climateContent.appendChild(createRow('Override:', 'None'));
    climateContent.appendChild(createRow('Precipitation:', 'Normal'));

    const overrideBtn = createButton('[Edit Override...]', callbacks.onEditClimateOverride, 'link');
    overrideBtn.style.marginTop = '4px';
    climateContent.appendChild(overrideBtn);
    contentEl.appendChild(climateSection);

    // === Features ===
    const featuresSection = createSection('Features');
    const featuresContent = featuresSection.querySelector('.section-content') as HTMLElement;

    // Features come from terrain definition - placeholder for MVP
    featuresContent.innerHTML = `
      <div style="color: var(--text-faint); font-style: italic;">
        No features
      </div>
    `;

    const addFeatureBtn = createButton('[+ Add Feature]', callbacks.onAddFeature, 'link');
    addFeatureBtn.style.marginTop = '4px';
    featuresContent.appendChild(addFeatureBtn);
    contentEl.appendChild(featuresSection);

    // === Locations ===
    if (data.pois.length > 0) {
      const locationsSection = createSection('Locations');
      const locationsContent = locationsSection.querySelector('.section-content') as HTMLElement;

      for (const poi of data.pois) {
        const poiRow = document.createElement('div');
        poiRow.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2px 0;
        `;

        const nameEl = document.createElement('span');
        nameEl.textContent = `• ${poi.name}`;

        const navBtn = createButton('[→]', () => callbacks.onNavigateToLocation(poi.id), 'link');

        poiRow.appendChild(nameEl);
        poiRow.appendChild(navBtn);
        locationsContent.appendChild(poiRow);
      }

      contentEl.appendChild(locationsSection);
    }

    // === Factions ===
    if (data.factions.length > 0) {
      const factionsSection = createSection('Factions');
      const factionsContent = factionsSection.querySelector('.section-content') as HTMLElement;

      for (const faction of data.factions) {
        factionsContent.appendChild(createRow(`• ${faction.name}`, `${faction.percentage}%`));
      }

      contentEl.appendChild(factionsSection);
    }

    // === Notes ===
    if (data.notes) {
      const notesSection = createSection('Notes');
      const notesContent = notesSection.querySelector('.section-content') as HTMLElement;
      notesContent.style.cssText += `
        font-style: italic;
        color: var(--text-muted);
      `;
      notesContent.textContent = data.notes;
      contentEl.appendChild(notesSection);
    }
  }

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    update(state: Readonly<CartographerState>): void {
      // Prefer selected tiles, fall back to hovered tile
      const targetTile =
        state.selectedTiles.length > 0
          ? state.selectedTiles[0]
          : state.hoveredTile;

      if (!targetTile) {
        renderNoSelection();
        return;
      }

      const tileData = getTileData(targetTile);
      if (!tileData) {
        renderNoSelection();
        return;
      }

      renderTileData(tileData);
    },

    dispose(): void {
      panelEl.remove();
    },
  };
}
