/**
 * Header Panel.
 *
 * Displays time, weather, and quick controls in the top bar.
 */

import type { RenderState, HeaderState } from '../types';

// ============================================================================
// Header Panel Callbacks
// ============================================================================

export interface HeaderPanelCallbacks {
  /** Toggle sidebar visibility */
  onMenuClick: () => void;
  /** Advance time backward (-1h) */
  onTimePrev: () => void;
  /** Advance time forward (+1h) */
  onTimeNext: () => void;
  /** Open settings (placeholder) */
  onSettingsClick: () => void;
}

// ============================================================================
// Header Panel
// ============================================================================

export interface HeaderPanel {
  /** Update header with new state */
  update(state: RenderState): void;
  /** Clean up resources */
  dispose(): void;
}

/**
 * Create the header panel.
 */
export function createHeaderPanel(
  container: HTMLElement,
  callbacks: HeaderPanelCallbacks
): HeaderPanel {
  // Create header element
  const header = document.createElement('div');
  header.className = 'salt-marcher-header';
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    min-height: 40px;
    gap: 12px;
  `;
  container.appendChild(header);

  // === Left Section ===
  const leftSection = document.createElement('div');
  leftSection.className = 'header-left';
  leftSection.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  const menuBtn = createIconButton('☰', 'Toggle sidebar', callbacks.onMenuClick);
  const title = document.createElement('span');
  title.className = 'header-title';
  title.textContent = 'SessionRunner';
  title.style.cssText = `
    font-weight: 600;
    color: var(--text-normal);
  `;

  leftSection.appendChild(menuBtn);
  leftSection.appendChild(title);
  header.appendChild(leftSection);

  // === Center Section ===
  const centerSection = document.createElement('div');
  centerSection.className = 'header-center';
  centerSection.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  const dateTimeEl = document.createElement('span');
  dateTimeEl.className = 'header-datetime';
  dateTimeEl.style.cssText = `
    font-family: var(--font-monospace);
    font-size: 13px;
    color: var(--text-normal);
  `;

  const timeControls = document.createElement('div');
  timeControls.className = 'header-time-controls';
  timeControls.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
  `;

  const timePrevBtn = createIconButton('◀', '-1 hour', callbacks.onTimePrev);
  const timeNextBtn = createIconButton('▶', '+1 hour', callbacks.onTimeNext);
  timeControls.appendChild(timePrevBtn);
  timeControls.appendChild(timeNextBtn);

  centerSection.appendChild(dateTimeEl);
  centerSection.appendChild(timeControls);
  header.appendChild(centerSection);

  // === Right Section ===
  const rightSection = document.createElement('div');
  rightSection.className = 'header-right';
  rightSection.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  const weatherEl = document.createElement('span');
  weatherEl.className = 'header-weather';
  weatherEl.style.cssText = `
    font-size: 13px;
    color: var(--text-muted);
  `;

  const settingsBtn = createIconButton('⚙️', 'Settings', callbacks.onSettingsClick);

  rightSection.appendChild(weatherEl);
  rightSection.appendChild(settingsBtn);
  header.appendChild(rightSection);

  // =========================================================================
  // Helpers
  // =========================================================================

  function createIconButton(
    icon: string,
    tooltip: string,
    onClick: () => void
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = icon;
    btn.title = tooltip;
    btn.style.cssText = `
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
      color: var(--text-muted);
      transition: background 0.1s, color 0.1s;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'var(--background-modifier-hover)';
      btn.style.color = 'var(--text-normal)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--text-muted)';
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  function formatGameDateTime(
    time: { year: number; month: number; day: number; hour: number; minute: number }
  ): string {
    const h = time.hour.toString().padStart(2, '0');
    const m = time.minute.toString().padStart(2, '0');
    return `Year ${time.year}, Day ${time.day} • ${h}:${m}`;
  }

  function getWeatherIcon(label: string): string {
    const lower = label.toLowerCase();
    if (lower.includes('clear') || lower.includes('sunny')) return '☀️';
    if (lower.includes('cloud') || lower.includes('overcast')) return '☁️';
    if (lower.includes('rain')) return '🌧️';
    if (lower.includes('storm') || lower.includes('thunder')) return '⛈️';
    if (lower.includes('snow')) return '❄️';
    if (lower.includes('fog') || lower.includes('mist')) return '🌫️';
    return '🌤️';
  }

  function updateHeader(headerState: HeaderState): void {
    // Time
    if (headerState.currentTime) {
      dateTimeEl.textContent = formatGameDateTime(headerState.currentTime);
      if (headerState.timeSegment) {
        const segment = headerState.timeSegment.charAt(0).toUpperCase() +
          headerState.timeSegment.slice(1);
        dateTimeEl.textContent += ` (${segment})`;
      }
    } else {
      dateTimeEl.textContent = 'Time not loaded';
    }

    // Weather
    if (headerState.weatherSummary) {
      const { label, temperature } = headerState.weatherSummary;
      const icon = getWeatherIcon(label);
      weatherEl.textContent = `${icon} ${label} ${Math.round(temperature)}°C`;
    } else {
      weatherEl.textContent = '—';
    }
  }

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    update(state: RenderState): void {
      updateHeader(state.header);
    },

    dispose(): void {
      header.remove();
    },
  };
}
