/**
 * Tool Panel Component
 *
 * Right sidebar with tool settings: mode toggle, brush settings, undo/redo.
 * Uses form builders from core/utils/form for consistent controls.
 */

import { setIcon } from 'obsidian';
import type { TerrainConfig } from '@core/schemas/terrain';
import type {
  ToolMode,
  ToolType,
  BrushSettings,
} from '../types';
import { TOOLS } from '../types';
import {
  getFalloffTypes,
  getFalloffLabel,
  getBrushModes,
  getBrushModeLabel,
  type FalloffType,
  type BrushMode,
} from '../utils/brush-math';
import {
  createSelectControl,
  createSliderWithInput,
  createSimpleButtonToggle,
  createButtonToggle,
  createDivider,
  type SelectOption,
} from '@shared/form';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface ToolPanelCallbacks {
  onModeChange: (mode: ToolMode) => void;
  onToolChange: (tool: ToolType) => void;
  onBrushSettingsChange: (settings: Partial<BrushSettings>) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export interface ToolPanelState {
  toolMode: ToolMode;
  activeTool: ToolType;
  brushSettings: BrushSettings;
  canUndo: boolean;
  canRedo: boolean;
  terrains: TerrainConfig[];
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const MODE_OPTIONS: readonly SelectOption<ToolMode>[] = [
  { value: 'brush', label: 'Brush' },
  { value: 'inspector', label: 'Inspector' },
];

// ═══════════════════════════════════════════════════════════════
// Tool Panel
// ═══════════════════════════════════════════════════════════════

export class ToolPanel {
  private container: HTMLElement;
  private callbacks: ToolPanelCallbacks;

  // Undo section refs
  private undoBtn!: HTMLButtonElement;
  private redoBtn!: HTMLButtonElement;

  constructor(container: HTMLElement, callbacks: ToolPanelCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.initializeContainer();
  }

  // ─────────────────────────────────────────────────────────────
  // Initialize
  // ─────────────────────────────────────────────────────────────

  private initializeContainer(): void {
    this.container.addClass('cartographer-tool-panel');
    this.container.style.padding = '8px';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '8px';
  }

  // ─────────────────────────────────────────────────────────────
  // Update (full re-render)
  // ─────────────────────────────────────────────────────────────

  update(state: ToolPanelState): void {
    this.container.empty();

    // Mode toggle (Brush / Inspector)
    createSimpleButtonToggle(
      this.container,
      MODE_OPTIONS,
      state.toolMode,
      (mode) => this.callbacks.onModeChange(mode)
    );

    createDivider(this.container);

    // Mode-specific content
    if (state.toolMode === 'brush') {
      this.renderBrushPanel(state);
    } else {
      this.renderInspectorHint();
    }

    createDivider(this.container);

    // Undo/Redo section
    this.renderUndoSection(state);
  }

  // ─────────────────────────────────────────────────────────────
  // Brush Panel
  // ─────────────────────────────────────────────────────────────

  private renderBrushPanel(state: ToolPanelState): void {
    // Tool selection
    const toolOptions: SelectOption<ToolType>[] = TOOLS.map((t) => ({
      value: t.type,
      label: `${t.label} (${t.shortcut})`,
    }));
    createSelectControl(
      this.container,
      'Tool',
      toolOptions,
      state.activeTool,
      (tool) => this.callbacks.onToolChange(tool)
    );

    const isTerrain = state.activeTool === 'terrain';
    const isNumeric = ['elevation', 'temperature', 'precipitation', 'clouds', 'wind'].includes(
      state.activeTool
    );

    // Terrain dropdown (only for terrain tool)
    if (isTerrain) {
      const terrainOptions: SelectOption<string>[] = state.terrains.map((t) => ({
        value: t.id,
        label: t.name,
      }));
      createSelectControl(
        this.container,
        'Terrain',
        terrainOptions,
        state.brushSettings.terrain,
        (terrain) => this.callbacks.onBrushSettingsChange({ terrain })
      );
    }

    // Brush mode toggle (only for numeric tools)
    if (isNumeric) {
      const modeOptions: SelectOption<BrushMode>[] = getBrushModes().map((m) => ({
        value: m,
        label: getBrushModeLabel(m),
      }));
      createButtonToggle(
        this.container,
        'Mode',
        modeOptions,
        state.brushSettings.mode,
        (mode) => this.callbacks.onBrushSettingsChange({ mode })
      );
    }

    // Value slider (only for numeric tools, not smooth mode)
    if (isNumeric && state.brushSettings.mode !== 'smooth') {
      const valueConfig = this.getValueConfig(state.activeTool, state.brushSettings.mode);
      createSliderWithInput(
        this.container,
        this.getValueLabel(state.activeTool),
        { ...valueConfig, value: state.brushSettings.value },
        (value) => this.callbacks.onBrushSettingsChange({ value })
      );
    }

    // Radius slider (always shown)
    createSliderWithInput(
      this.container,
      'Radius',
      { min: 0, max: 10, step: 1, value: state.brushSettings.radius },
      (radius) => this.callbacks.onBrushSettingsChange({ radius })
    );

    // Strength and Falloff (only for numeric tools)
    if (isNumeric) {
      createSliderWithInput(
        this.container,
        'Strength',
        { min: 0, max: 100, step: 5, value: state.brushSettings.strength },
        (strength) => this.callbacks.onBrushSettingsChange({ strength })
      );

      const falloffOptions: SelectOption<FalloffType>[] = getFalloffTypes().map((f) => ({
        value: f,
        label: getFalloffLabel(f),
      }));
      createSelectControl(
        this.container,
        'Falloff',
        falloffOptions,
        state.brushSettings.falloff,
        (falloff) => this.callbacks.onBrushSettingsChange({ falloff })
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Inspector Hint
  // ─────────────────────────────────────────────────────────────

  private renderInspectorHint(): void {
    const hint = this.container.createDiv({ cls: 'inspector-hint' });
    hint.style.color = 'var(--text-muted)';
    hint.style.fontStyle = 'italic';
    hint.textContent = 'Click a tile to inspect';
  }

  // ─────────────────────────────────────────────────────────────
  // Undo Section
  // ─────────────────────────────────────────────────────────────

  private renderUndoSection(state: ToolPanelState): void {
    const buttonGroup = this.container.createDiv({ cls: 'button-group' });
    buttonGroup.style.display = 'flex';
    buttonGroup.style.gap = '8px';

    this.undoBtn = buttonGroup.createEl('button', {
      cls: 'mod-cta',
      attr: { 'aria-label': 'Undo' },
    });
    this.undoBtn.style.flex = '1';
    setIcon(this.undoBtn, 'undo');
    this.undoBtn.createSpan({ text: ' Undo' });
    this.undoBtn.disabled = !state.canUndo;
    this.undoBtn.toggleClass('is-disabled', !state.canUndo);
    this.undoBtn.addEventListener('click', () => this.callbacks.onUndo());

    this.redoBtn = buttonGroup.createEl('button', {
      cls: 'mod-cta',
      attr: { 'aria-label': 'Redo' },
    });
    this.redoBtn.style.flex = '1';
    setIcon(this.redoBtn, 'redo');
    this.redoBtn.createSpan({ text: ' Redo' });
    this.redoBtn.disabled = !state.canRedo;
    this.redoBtn.toggleClass('is-disabled', !state.canRedo);
    this.redoBtn.addEventListener('click', () => this.callbacks.onRedo());
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  private getValueLabel(tool: ToolType): string {
    const labels: Record<string, string> = {
      elevation: 'Elevation (m)',
      temperature: 'Temperature',
      precipitation: 'Precipitation',
      clouds: 'Cloud Cover',
      wind: 'Wind',
    };
    return labels[tool] || 'Value';
  }

  private getValueConfig(
    tool: ToolType,
    mode: BrushMode
  ): { min: number; max: number; step: number } {
    // Sculpt mode uses limited range for finer control
    if (mode === 'sculpt') {
      return { min: -500, max: 500, step: 10 };
    }

    // Tool-specific ranges
    if (tool === 'elevation') {
      return { min: -1000, max: 10000, step: 10 };
    }
    return { min: 1, max: 12, step: 1 };
  }

  // ─────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────

  dispose(): void {
    this.container.empty();
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

export function createToolPanel(
  container: HTMLElement,
  callbacks: ToolPanelCallbacks
): ToolPanel {
  return new ToolPanel(container, callbacks);
}
