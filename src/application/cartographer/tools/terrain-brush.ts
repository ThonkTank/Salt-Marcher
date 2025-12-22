/**
 * Terrain Brush Tool Component.
 *
 * Task #2507: Terrain-Brush Tool Component (Overland)
 * Spec: Cartographer.md#terrain-brush-overland
 *
 * Paints terrain types on Hex-Tiles:
 * - Terrain selection grid (Forest, Mountain, Plains, etc.)
 * - Brush size (1-5)
 * - Brush shape (Circle, Line, Fill)
 * - Options (Auto-Elevation, Preview Mode)
 */

import type { EntityId } from '@core/types';
import type { TerrainDefinition } from '@core/schemas';
import type { CartographerState, BrushShape } from '../types';
import type { TerrainStoragePort } from '@/features/map';

// ============================================================================
// Types
// ============================================================================

/**
 * Terrain Brush panel interface.
 * Follows panel pattern from inspector.ts.
 */
export interface TerrainBrushPanel {
  /**
   * Update the panel with new state.
   * Called when CartographerState changes with 'tool' hint.
   */
  update(state: Readonly<CartographerState>): void;

  /**
   * Dispose the panel and clean up event listeners.
   */
  dispose(): void;
}

/**
 * Callbacks for user interactions with the Terrain Brush panel.
 */
export interface TerrainBrushCallbacks {
  /** Select a terrain type */
  onTerrainSelect: (terrainId: EntityId<'terrain'>) => void;
  /** Change brush size (1-5) */
  onBrushSizeChange: (size: number) => void;
  /** Change brush shape */
  onBrushShapeChange: (shape: BrushShape) => void;
  /** Toggle auto-elevation option */
  onAutoElevationToggle: (enabled: boolean) => void;
  /** Toggle preview mode */
  onPreviewModeToggle: (enabled: boolean) => void;
  /** Open custom terrain creator (placeholder) */
  onAddCustomTerrain: () => void;
}

/**
 * Dependencies for the Terrain Brush panel.
 */
export interface TerrainBrushDeps {
  /** Terrain storage for terrain definitions */
  terrainStorage: TerrainStoragePort;
}

// ============================================================================
// Constants
// ============================================================================

/** Terrain display info for rendering */
interface TerrainDisplayInfo {
  icon: string;
  color: string;
}

/** Default terrain display mapping */
const TERRAIN_DISPLAY: Record<string, TerrainDisplayInfo> = {
  forest: { icon: '🌲', color: '#228B22' },
  mountains: { icon: '🏔️', color: '#696969' },
  plains: { icon: '🌾', color: '#9ACD32' },
  desert: { icon: '🏜️', color: '#EDC9AF' },
  water: { icon: '🌊', color: '#4169E1' },
  swamp: { icon: '🌿', color: '#556B2F' },
  hills: { icon: '⛰️', color: '#8B7355' },
  road: { icon: '🛤️', color: '#A0522D' },
};

/** Brush sizes */
const BRUSH_SIZES = [1, 2, 3, 4, 5] as const;

/** Brush shapes with labels */
const BRUSH_SHAPES: Array<{ shape: BrushShape; label: string }> = [
  { shape: 'circle', label: 'Circle' },
  { shape: 'line', label: 'Line' },
  { shape: 'fill', label: 'Fill' },
];

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Terrain Brush Tool panel.
 *
 * @param container - Parent element to mount the panel in
 * @param callbacks - Callbacks for user interactions
 * @param deps - Dependencies (terrainStorage for terrain lookup)
 * @returns TerrainBrushPanel instance
 */
export function createTerrainBrushPanel(
  container: HTMLElement,
  callbacks: TerrainBrushCallbacks,
  deps: TerrainBrushDeps
): TerrainBrushPanel {
  const { terrainStorage } = deps;

  // Create main panel element
  const panelEl = document.createElement('div');
  panelEl.className = 'terrain-brush-panel';
  panelEl.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    overflow-y: auto;
  `;
  container.appendChild(panelEl);

  // Track current state for updates
  let currentTerrainId: EntityId<'terrain'> | undefined;
  let currentBrushSize = 1;
  let currentBrushShape: BrushShape = 'circle';
  let autoElevationEnabled = false;
  let previewModeEnabled = false;

  // UI element references for updates
  let terrainButtonsContainer: HTMLElement;
  let brushSizeContainer: HTMLElement;
  let brushShapeContainer: HTMLElement;
  let autoElevationCheckbox: HTMLInputElement;
  let previewModeCheckbox: HTMLInputElement;

  // =========================================================================
  // Helpers
  // =========================================================================

  function createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'terrain-brush-header';
    header.style.cssText = `
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      color: var(--text-muted);
      padding-bottom: 8px;
      border-bottom: 1px solid var(--background-modifier-border);
    `;
    header.textContent = 'TERRAIN BRUSH';
    return header;
  }

  function createSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'terrain-brush-section';
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
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

    section.appendChild(sectionTitle);
    section.appendChild(sectionContent);
    return section;
  }

  function getTerrainDisplayInfo(terrain: TerrainDefinition): TerrainDisplayInfo {
    const key = String(terrain.id).toLowerCase();
    return TERRAIN_DISPLAY[key] ?? { icon: '🗺️', color: terrain.displayColor ?? '#808080' };
  }

  function createTerrainButton(terrain: TerrainDefinition, isSelected: boolean): HTMLButtonElement {
    const display = getTerrainDisplayInfo(terrain);
    const btn = document.createElement('button');
    btn.className = 'terrain-button';
    btn.dataset.terrainId = String(terrain.id);
    btn.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      padding: 8px 4px;
      min-width: 60px;
      background: ${isSelected ? 'var(--interactive-accent)' : 'var(--interactive-normal)'};
      border: 2px solid ${isSelected ? 'var(--interactive-accent-hover)' : 'var(--background-modifier-border)'};
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    `;

    const iconEl = document.createElement('span');
    iconEl.style.fontSize = '20px';
    iconEl.textContent = display.icon;

    const labelEl = document.createElement('span');
    labelEl.style.cssText = `
      font-size: 10px;
      color: ${isSelected ? 'var(--text-on-accent)' : 'var(--text-normal)'};
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      max-width: 56px;
    `;
    labelEl.textContent = terrain.name;

    btn.appendChild(iconEl);
    btn.appendChild(labelEl);

    btn.addEventListener('mouseenter', () => {
      if (!isSelected) {
        btn.style.background = 'var(--interactive-hover)';
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (!isSelected) {
        btn.style.background = 'var(--interactive-normal)';
      }
    });

    btn.addEventListener('click', () => {
      callbacks.onTerrainSelect(terrain.id);
    });

    return btn;
  }

  function createTerrainGrid(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'terrain-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    `;
    return grid;
  }

  function createCustomButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'custom-terrain-button';
    btn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 6px 12px;
      background: transparent;
      border: 1px dashed var(--background-modifier-border);
      border-radius: 4px;
      color: var(--text-muted);
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s ease;
      opacity: 0.7;
    `;
    btn.textContent = '+ Custom...';
    btn.title = 'Custom terrains coming soon';

    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = 'var(--text-muted)';
      btn.style.opacity = '1';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = 'var(--background-modifier-border)';
      btn.style.opacity = '0.7';
    });

    btn.addEventListener('click', () => {
      callbacks.onAddCustomTerrain();
    });

    return btn;
  }

  function createBrushSizeButtons(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      gap: 4px;
    `;

    for (const size of BRUSH_SIZES) {
      const btn = document.createElement('button');
      btn.className = 'brush-size-button';
      btn.dataset.size = String(size);
      const isSelected = size === currentBrushSize;
      btn.style.cssText = `
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${isSelected ? 'var(--interactive-accent)' : 'var(--interactive-normal)'};
        border: 1px solid ${isSelected ? 'var(--interactive-accent-hover)' : 'var(--background-modifier-border)'};
        border-radius: 4px;
        color: ${isSelected ? 'var(--text-on-accent)' : 'var(--text-normal)'};
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.1s ease;
      `;
      btn.textContent = String(size);

      btn.addEventListener('click', () => {
        callbacks.onBrushSizeChange(size);
      });

      container.appendChild(btn);
    }

    return container;
  }

  function createBrushShapeButtons(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      gap: 4px;
    `;

    for (const { shape, label } of BRUSH_SHAPES) {
      const btn = document.createElement('button');
      btn.className = 'brush-shape-button';
      btn.dataset.shape = shape;
      const isSelected = shape === currentBrushShape;
      btn.style.cssText = `
        flex: 1;
        padding: 6px 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${isSelected ? 'var(--interactive-accent)' : 'var(--interactive-normal)'};
        border: 1px solid ${isSelected ? 'var(--interactive-accent-hover)' : 'var(--background-modifier-border)'};
        border-radius: 4px;
        color: ${isSelected ? 'var(--text-on-accent)' : 'var(--text-normal)'};
        font-size: 11px;
        cursor: pointer;
        transition: all 0.1s ease;
      `;
      btn.textContent = label;

      btn.addEventListener('click', () => {
        callbacks.onBrushShapeChange(shape);
      });

      container.appendChild(btn);
    }

    return container;
  }

  function createCheckbox(
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void
  ): { container: HTMLElement; checkbox: HTMLInputElement } {
    const container = document.createElement('label');
    container.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 12px;
      color: var(--text-normal);
    `;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.style.cssText = `
      margin: 0;
      cursor: pointer;
    `;

    checkbox.addEventListener('change', () => {
      onChange(checkbox.checked);
    });

    const labelText = document.createElement('span');
    labelText.textContent = label;

    container.appendChild(checkbox);
    container.appendChild(labelText);

    return { container, checkbox };
  }

  // =========================================================================
  // Build UI
  // =========================================================================

  function buildUI(): void {
    // Clear panel
    panelEl.innerHTML = '';

    // Header
    panelEl.appendChild(createHeader());

    // Terrain Section
    const terrainSection = createSection('Terrain');
    const terrainContent = terrainSection.querySelector('.section-content') as HTMLElement;

    terrainButtonsContainer = createTerrainGrid();
    terrainContent.appendChild(terrainButtonsContainer);

    // Add custom button
    const customBtn = createCustomButton();
    customBtn.style.marginTop = '6px';
    terrainContent.appendChild(customBtn);

    panelEl.appendChild(terrainSection);

    // Brush Size Section
    const brushSizeSection = createSection('Brush Size');
    const brushSizeContent = brushSizeSection.querySelector('.section-content') as HTMLElement;
    brushSizeContainer = createBrushSizeButtons();
    brushSizeContent.appendChild(brushSizeContainer);
    panelEl.appendChild(brushSizeSection);

    // Brush Shape Section
    const brushShapeSection = createSection('Brush Shape');
    const brushShapeContent = brushShapeSection.querySelector('.section-content') as HTMLElement;
    brushShapeContainer = createBrushShapeButtons();
    brushShapeContent.appendChild(brushShapeContainer);
    panelEl.appendChild(brushShapeSection);

    // Options Section
    const optionsSection = createSection('Options');
    const optionsContent = optionsSection.querySelector('.section-content') as HTMLElement;
    optionsContent.style.cssText += `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    const autoElevation = createCheckbox('Auto-Elevation', autoElevationEnabled, (checked) => {
      callbacks.onAutoElevationToggle(checked);
    });
    autoElevationCheckbox = autoElevation.checkbox;
    optionsContent.appendChild(autoElevation.container);

    const previewMode = createCheckbox('Preview Mode', previewModeEnabled, (checked) => {
      callbacks.onPreviewModeToggle(checked);
    });
    previewModeCheckbox = previewMode.checkbox;
    optionsContent.appendChild(previewMode.container);

    panelEl.appendChild(optionsSection);
  }

  function updateTerrainGrid(): void {
    terrainButtonsContainer.innerHTML = '';

    const terrains = terrainStorage.getAll();
    for (const terrain of terrains) {
      const isSelected = currentTerrainId !== undefined && String(terrain.id) === String(currentTerrainId);
      const btn = createTerrainButton(terrain, isSelected);
      terrainButtonsContainer.appendChild(btn);
    }
  }

  function updateBrushSizeButtons(): void {
    const buttons = brushSizeContainer.querySelectorAll('.brush-size-button');
    buttons.forEach((el) => {
      const btn = el as HTMLButtonElement;
      const size = Number(btn.dataset.size);
      const isSelected = size === currentBrushSize;
      btn.style.background = isSelected ? 'var(--interactive-accent)' : 'var(--interactive-normal)';
      btn.style.borderColor = isSelected ? 'var(--interactive-accent-hover)' : 'var(--background-modifier-border)';
      btn.style.color = isSelected ? 'var(--text-on-accent)' : 'var(--text-normal)';
    });
  }

  function updateBrushShapeButtons(): void {
    const buttons = brushShapeContainer.querySelectorAll('.brush-shape-button');
    buttons.forEach((el) => {
      const btn = el as HTMLButtonElement;
      const shape = btn.dataset.shape as BrushShape;
      const isSelected = shape === currentBrushShape;
      btn.style.background = isSelected ? 'var(--interactive-accent)' : 'var(--interactive-normal)';
      btn.style.borderColor = isSelected ? 'var(--interactive-accent-hover)' : 'var(--background-modifier-border)';
      btn.style.color = isSelected ? 'var(--text-on-accent)' : 'var(--text-normal)';
    });
  }

  // Build initial UI
  buildUI();
  updateTerrainGrid();

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    update(state: Readonly<CartographerState>): void {
      const { toolOptions } = state;

      // Update terrain selection
      if (toolOptions.selectedTerrainId !== currentTerrainId) {
        currentTerrainId = toolOptions.selectedTerrainId;
        updateTerrainGrid();
      }

      // Update brush size
      if (toolOptions.brushSize !== currentBrushSize) {
        currentBrushSize = toolOptions.brushSize;
        updateBrushSizeButtons();
      }

      // Update brush shape
      if (toolOptions.brushShape !== currentBrushShape) {
        currentBrushShape = toolOptions.brushShape;
        updateBrushShapeButtons();
      }

      // Update options
      const newAutoElevation = toolOptions.autoElevation ?? false;
      if (newAutoElevation !== autoElevationEnabled) {
        autoElevationEnabled = newAutoElevation;
        autoElevationCheckbox.checked = autoElevationEnabled;
      }

      const newPreviewMode = toolOptions.previewMode;
      if (newPreviewMode !== previewModeEnabled) {
        previewModeEnabled = newPreviewMode;
        previewModeCheckbox.checked = previewModeEnabled;
      }
    },

    dispose(): void {
      panelEl.remove();
    },
  };
}
