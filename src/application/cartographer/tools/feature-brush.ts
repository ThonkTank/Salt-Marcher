/**
 * Feature-Brush Tool Component.
 *
 * Task #2522: Feature-Brush Tool Component (Overland)
 * Spec: Cartographer.md#feature-brush-overland
 *
 * Allows placing terrain features on hex tiles:
 * - Natural: Forest, Rocks, Spring, Cave, Garden, Mushroom
 * - Ruins: Ruins, Statue, Shrine
 * - Roads: Paved, Dirt, Trail
 *
 * Note: Roads category places only icons/markers. For linear paths
 * with mechanical effects, see Path-Tool (Post-MVP).
 */

import type { CartographerState, FeatureCategory } from '../types';
import type { MapFeaturePort } from '@/features/map';

// ============================================================================
// Types
// ============================================================================

/**
 * Feature definition for display in the tool panel.
 */
interface FeatureDefinition {
  id: string;
  icon: string;
  label: string;
}

/**
 * Feature categories with their available features.
 * From Cartographer.md#feature-brush-overland
 */
const FEATURE_CATEGORIES: Record<FeatureCategory, FeatureDefinition[]> = {
  natural: [
    { id: 'forest', icon: '\u{1F332}\u{1F332}', label: 'Forest' },
    { id: 'rocks', icon: '\u{1FAA8}', label: 'Rocks' },
    { id: 'spring', icon: '\u{1F4A7}', label: 'Spring' },
    { id: 'cave', icon: '\u{1F573}\uFE0F', label: 'Cave' },
    { id: 'garden', icon: '\u{1F338}', label: 'Garden' },
    { id: 'mushroom', icon: '\u{1F344}', label: 'Shroom' },
  ],
  ruins: [
    { id: 'ruins', icon: '\u{1F3DA}\uFE0F', label: 'Ruins' },
    { id: 'statue', icon: '\u{1F5FF}', label: 'Statue' },
    { id: 'shrine', icon: '\u{26F1}\uFE0F', label: 'Shrine' },
  ],
  roads: [
    { id: 'paved', icon: '\u{2550}\u{2550}\u{2550}', label: 'Paved' },
    { id: 'dirt', icon: '\u{2500}\u{2500}\u{2500}', label: 'Dirt' },
    { id: 'trail', icon: '\u{00B7}\u{00B7}\u{00B7}', label: 'Trail' },
  ],
};

// ============================================================================
// Panel Interface
// ============================================================================

/**
 * Feature-Brush Tool panel interface.
 * Follows panel pattern from inspector.ts.
 */
export interface FeatureBrushToolPanel {
  /**
   * Update the panel with new state.
   * Called when CartographerState changes with 'tool' or 'full' hint.
   */
  update(state: Readonly<CartographerState>): void;

  /**
   * Dispose the panel and clean up event listeners.
   */
  dispose(): void;
}

/**
 * Callbacks for user interactions with the Feature-Brush panel.
 */
export interface FeatureBrushToolCallbacks {
  /** Change feature category (natural, ruins, roads) */
  onCategoryChange: (category: FeatureCategory) => void;
  /** Select a feature type */
  onFeatureSelect: (featureType: string) => void;
  /** Change density value (0.0 - 1.0) */
  onDensityChange: (density: number) => void;
}

/**
 * Dependencies for the Feature-Brush panel.
 */
export interface FeatureBrushToolDeps {
  /** Map feature for tile operations (future use) */
  mapFeature: MapFeaturePort;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Feature-Brush Tool panel.
 *
 * @param container - Parent element to mount the panel in
 * @param callbacks - Callbacks for user interactions
 * @param _deps - Dependencies (mapFeature for future use)
 * @returns FeatureBrushToolPanel instance
 */
export function createFeatureBrushToolPanel(
  container: HTMLElement,
  callbacks: FeatureBrushToolCallbacks,
  _deps: FeatureBrushToolDeps
): FeatureBrushToolPanel {
  // Current state
  let currentCategory: FeatureCategory = 'natural';
  let currentFeature: string | undefined;
  let currentDensity = 0.5;

  // Create main panel element
  const panelEl = document.createElement('div');
  panelEl.className = 'feature-brush-tool-panel';
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

  // Create category tabs
  const categoryTabsEl = createCategoryTabs();
  panelEl.appendChild(categoryTabsEl);

  // Create features grid container
  const featuresContainerEl = document.createElement('div');
  featuresContainerEl.className = 'features-container';
  panelEl.appendChild(featuresContainerEl);

  // Create density slider section
  const densitySectionEl = createDensitySection();
  panelEl.appendChild(densitySectionEl);

  // Initial render
  renderFeaturesGrid();
  updateCategoryTabs();

  // =========================================================================
  // Helpers
  // =========================================================================

  function createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'feature-brush-header';
    header.style.cssText = `
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      color: var(--text-muted);
      padding-bottom: 8px;
      border-bottom: 1px solid var(--background-modifier-border);
    `;
    header.textContent = 'TERRAIN FEATURES';
    return header;
  }

  function createCategoryTabs(): HTMLElement {
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'category-tabs';
    tabsContainer.style.cssText = `
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
    `;

    const categories: FeatureCategory[] = ['natural', 'ruins', 'roads'];
    for (const cat of categories) {
      const tab = document.createElement('button');
      tab.className = 'category-tab';
      tab.dataset.category = cat;
      tab.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      tab.style.cssText = `
        flex: 1;
        padding: 6px 8px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--interactive-normal);
        color: var(--text-normal);
        font-size: 11px;
        cursor: pointer;
        transition: background 0.1s, border-color 0.1s;
      `;

      tab.addEventListener('click', () => {
        currentCategory = cat;
        callbacks.onCategoryChange(cat);
        updateCategoryTabs();
        renderFeaturesGrid();
      });

      tab.addEventListener('mouseenter', () => {
        if (currentCategory !== cat) {
          tab.style.background = 'var(--interactive-hover)';
        }
      });

      tab.addEventListener('mouseleave', () => {
        if (currentCategory !== cat) {
          tab.style.background = 'var(--interactive-normal)';
        }
      });

      tabsContainer.appendChild(tab);
    }

    return tabsContainer;
  }

  function updateCategoryTabs(): void {
    const tabs = panelEl.querySelectorAll('.category-tab') as NodeListOf<HTMLElement>;
    for (const tab of tabs) {
      const isActive = tab.dataset.category === currentCategory;
      tab.style.background = isActive ? 'var(--interactive-accent)' : 'var(--interactive-normal)';
      tab.style.color = isActive ? 'var(--text-on-accent)' : 'var(--text-normal)';
      tab.style.borderColor = isActive ? 'var(--interactive-accent)' : 'var(--background-modifier-border)';
    }
  }

  function renderFeaturesGrid(): void {
    featuresContainerEl.innerHTML = '';

    const features = FEATURE_CATEGORIES[currentCategory];

    // Section title
    const sectionTitle = document.createElement('div');
    sectionTitle.style.cssText = `
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--background-modifier-border);
      padding-bottom: 4px;
    `;
    sectionTitle.textContent = currentCategory.toUpperCase();
    featuresContainerEl.appendChild(sectionTitle);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'features-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    `;

    for (const feature of features) {
      const featureBtn = createFeatureButton(feature);
      grid.appendChild(featureBtn);
    }

    featuresContainerEl.appendChild(grid);
  }

  function createFeatureButton(feature: FeatureDefinition): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'feature-btn';
    btn.dataset.featureId = feature.id;
    btn.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      padding: 8px 4px;
      border: 1px solid var(--background-modifier-border);
      border-radius: 4px;
      background: var(--interactive-normal);
      cursor: pointer;
      transition: background 0.1s, border-color 0.1s;
      min-height: 52px;
    `;

    const iconEl = document.createElement('span');
    iconEl.style.cssText = `
      font-size: 16px;
      line-height: 1;
    `;
    iconEl.textContent = feature.icon;

    const labelEl = document.createElement('span');
    labelEl.style.cssText = `
      font-size: 9px;
      color: var(--text-muted);
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    `;
    labelEl.textContent = feature.label;

    btn.appendChild(iconEl);
    btn.appendChild(labelEl);

    // Update selected state
    updateFeatureButtonState(btn, feature.id);

    btn.addEventListener('click', () => {
      currentFeature = feature.id;
      callbacks.onFeatureSelect(feature.id);
      updateAllFeatureButtons();
    });

    btn.addEventListener('mouseenter', () => {
      if (currentFeature !== feature.id) {
        btn.style.background = 'var(--interactive-hover)';
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (currentFeature !== feature.id) {
        btn.style.background = 'var(--interactive-normal)';
      }
    });

    return btn;
  }

  function updateFeatureButtonState(btn: HTMLElement, featureId: string): void {
    const isSelected = currentFeature === featureId;
    btn.style.background = isSelected ? 'var(--interactive-accent)' : 'var(--interactive-normal)';
    btn.style.borderColor = isSelected ? 'var(--interactive-accent)' : 'var(--background-modifier-border)';

    const label = btn.querySelector('span:last-child') as HTMLElement;
    if (label) {
      label.style.color = isSelected ? 'var(--text-on-accent)' : 'var(--text-muted)';
    }
  }

  function updateAllFeatureButtons(): void {
    const buttons = featuresContainerEl.querySelectorAll('.feature-btn') as NodeListOf<HTMLElement>;
    for (const btn of buttons) {
      const featureId = btn.dataset.featureId;
      if (featureId) {
        updateFeatureButtonState(btn, featureId);
      }
    }
  }

  function createDensitySection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'density-section';
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid var(--background-modifier-border);
    `;

    // Label
    const label = document.createElement('div');
    label.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    `;

    const labelText = document.createElement('span');
    labelText.style.color = 'var(--text-muted)';
    labelText.textContent = 'Density:';

    const valueText = document.createElement('span');
    valueText.className = 'density-value';
    valueText.style.color = 'var(--text-normal)';
    valueText.textContent = getDensityLabel(currentDensity);

    label.appendChild(labelText);
    label.appendChild(valueText);
    section.appendChild(label);

    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(currentDensity * 100);
    slider.style.cssText = `
      width: 100%;
      cursor: pointer;
    `;

    slider.addEventListener('input', () => {
      const value = parseInt(slider.value, 10) / 100;
      currentDensity = value;
      valueText.textContent = getDensityLabel(value);
      callbacks.onDensityChange(value);
    });

    section.appendChild(slider);

    return section;
  }

  function getDensityLabel(value: number): string {
    if (value < 0.25) return 'Sparse';
    if (value < 0.5) return 'Light';
    if (value < 0.75) return 'Medium';
    return 'Dense';
  }

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    update(state: Readonly<CartographerState>): void {
      // Sync with state if options differ from internal state
      const opts = state.toolOptions;

      if (opts.selectedFeatureCategory && opts.selectedFeatureCategory !== currentCategory) {
        currentCategory = opts.selectedFeatureCategory;
        updateCategoryTabs();
        renderFeaturesGrid();
      }

      if (opts.selectedFeatureType !== currentFeature) {
        currentFeature = opts.selectedFeatureType;
        updateAllFeatureButtons();
      }

      if (opts.featureDensity !== undefined && opts.featureDensity !== currentDensity) {
        currentDensity = opts.featureDensity;
        const valueEl = panelEl.querySelector('.density-value') as HTMLElement;
        if (valueEl) {
          valueEl.textContent = getDensityLabel(currentDensity);
        }
        const slider = panelEl.querySelector('input[type="range"]') as HTMLInputElement;
        if (slider) {
          slider.value = String(currentDensity * 100);
        }
      }
    },

    dispose(): void {
      panelEl.remove();
    },
  };
}
