/**
 * Controls Panel.
 *
 * Displays current position, terrain info, and last travel details.
 */

import { isSome } from '@core/index';
import type { TerrainStoragePort } from '@/features/map';
import type { RenderState, TravelInfo } from '../types';

// ============================================================================
// Controls Panel
// ============================================================================

export interface ControlsPanelDeps {
  terrainStorage: TerrainStoragePort;
}

/**
 * Create a controls panel.
 */
export function createControlsPanel(
  container: HTMLElement,
  deps: ControlsPanelDeps
): ControlsPanel {
  const { terrainStorage } = deps;

  // Create panel element
  const panel = document.createElement('div');
  panel.className = 'salt-marcher-controls-panel';
  panel.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    padding: 12px;
    border-radius: 6px;
    font-family: var(--font-monospace);
    font-size: 12px;
    min-width: 200px;
    z-index: 100;
  `;
  container.appendChild(panel);

  // Sections
  const positionSection = createSection('Position');
  const terrainSection = createSection('Terrain');
  const travelSection = createSection('Last Move');
  const helpSection = createSection('Controls');

  panel.appendChild(positionSection.element);
  panel.appendChild(terrainSection.element);
  panel.appendChild(travelSection.element);
  panel.appendChild(helpSection.element);

  // Help text
  helpSection.setContent(`
    <div style="opacity: 0.7;">
      Click adjacent hex to move<br>
      Drag to pan<br>
      Scroll to zoom
    </div>
  `);

  // =========================================================================
  // Helpers
  // =========================================================================

  function createSection(title: string) {
    const element = document.createElement('div');
    element.style.marginBottom = '10px';

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-weight: bold; margin-bottom: 4px; color: #aaa;';
    titleEl.textContent = title;
    element.appendChild(titleEl);

    const contentEl = document.createElement('div');
    element.appendChild(contentEl);

    return {
      element,
      setContent(html: string): void {
        contentEl.innerHTML = html;
      },
    };
  }

  function formatCoord(coord: { q: number; r: number }): string {
    return `(${coord.q}, ${coord.r})`;
  }

  function formatTime(hours: number): string {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    return `${hours.toFixed(1)} hrs`;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    update(state: RenderState, lastTravel: TravelInfo | null): void {
      // Position
      if (state.partyPosition) {
        positionSection.setContent(`
          <div>Hex: ${formatCoord(state.partyPosition)}</div>
          <div>Transport: ${state.activeTransport}</div>
        `);
      } else {
        positionSection.setContent('<div>No party loaded</div>');
      }

      // Terrain at current position
      if (state.partyPosition && state.map) {
        const tile = state.map.tiles.find(
          (t) =>
            t.coordinate.q === state.partyPosition!.q &&
            t.coordinate.r === state.partyPosition!.r
        );
        if (tile) {
          const terrain = terrainStorage.get(tile.terrain);
          if (isSome(terrain)) {
            terrainSection.setContent(`
              <div>${terrain.value.name}</div>
              <div style="opacity: 0.7;">Move cost: ${terrain.value.movementCost}</div>
            `);
          }
        }
      } else {
        terrainSection.setContent('<div>-</div>');
      }

      // Last travel
      if (lastTravel) {
        travelSection.setContent(`
          <div>${formatCoord(lastTravel.from)} → ${formatCoord(lastTravel.to)}</div>
          <div>Terrain: ${lastTravel.terrainName}</div>
          <div>Time: ${formatTime(lastTravel.timeCostHours)}</div>
        `);
      } else {
        travelSection.setContent('<div>No moves yet</div>');
      }
    },

    dispose(): void {
      panel.remove();
    },
  };
}

export interface ControlsPanel {
  update(state: RenderState, lastTravel: TravelInfo | null): void;
  dispose(): void;
}
