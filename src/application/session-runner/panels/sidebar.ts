/**
 * Sidebar Panel (Quick Controls).
 *
 * Displays Travel, Audio, Party, and Actions sections.
 */

import type { RenderState, SidebarState } from '../types';

// ============================================================================
// Sidebar Panel Callbacks
// ============================================================================

export interface SidebarPanelCallbacks {
  // Travel
  /** Plan a route (placeholder) */
  onPlanRoute: () => void;
  /** Start travel (placeholder) */
  onStartTravel: () => void;
  /** Pause travel (placeholder) */
  onPauseTravel: () => void;

  // Actions
  /** Generate a random encounter */
  onGenerateEncounter: () => void;
  /** Enter teleport mode (placeholder) */
  onTeleport: () => void;
}

// ============================================================================
// Sidebar Panel
// ============================================================================

export interface SidebarPanel {
  /** Update sidebar with new state */
  update(state: RenderState): void;
  /** Set collapsed state */
  setCollapsed(collapsed: boolean): void;
  /** Clean up resources */
  dispose(): void;
}

/**
 * Create the sidebar panel.
 */
export function createSidebarPanel(
  container: HTMLElement,
  callbacks: SidebarPanelCallbacks
): SidebarPanel {
  // Create sidebar element
  const sidebar = document.createElement('div');
  sidebar.className = 'salt-marcher-sidebar';
  sidebar.style.cssText = `
    display: flex;
    flex-direction: column;
    background: var(--background-secondary);
    border-right: 1px solid var(--background-modifier-border);
    width: 200px;
    overflow-y: auto;
    padding: 8px;
    gap: 8px;
  `;
  container.appendChild(sidebar);

  // === Travel Section ===
  const travelSection = createSection('🚶 TRAVEL');
  const travelContent = travelSection.querySelector('.section-content') as HTMLElement;

  const travelStatus = document.createElement('div');
  travelStatus.className = 'travel-status';
  travelStatus.style.cssText = `
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 4px;
  `;

  const travelSpeed = document.createElement('div');
  travelSpeed.className = 'travel-speed';
  travelSpeed.style.cssText = `
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 8px;
  `;

  const travelButtons = document.createElement('div');
  travelButtons.style.cssText = `
    display: flex;
    gap: 4px;
  `;

  const planBtn = createButton('Plan', callbacks.onPlanRoute, true);
  const startBtn = createButton('Start', callbacks.onStartTravel, true);

  travelButtons.appendChild(planBtn);
  travelButtons.appendChild(startBtn);

  travelContent.appendChild(travelStatus);
  travelContent.appendChild(travelSpeed);
  travelContent.appendChild(travelButtons);
  sidebar.appendChild(travelSection);

  // === Audio Section (Placeholder) ===
  const audioSection = createSection('🎵 AUDIO');
  const audioContent = audioSection.querySelector('.section-content') as HTMLElement;
  audioContent.innerHTML = `
    <div style="font-size: 12px; color: var(--text-faint); font-style: italic;">
      Coming soon...
    </div>
  `;
  sidebar.appendChild(audioSection);

  // === Party Section (Placeholder) ===
  const partySection = createSection('👥 PARTY');
  const partyContent = partySection.querySelector('.section-content') as HTMLElement;
  partyContent.innerHTML = `
    <div style="font-size: 12px; color: var(--text-faint); font-style: italic;">
      Coming soon...
    </div>
  `;
  sidebar.appendChild(partySection);

  // === Actions Section ===
  const actionsSection = createSection('⚔️ ACTIONS');
  const actionsContent = actionsSection.querySelector('.section-content') as HTMLElement;

  const actionsButtons = document.createElement('div');
  actionsButtons.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 4px;
  `;

  const encounterBtn = createButton('🎲 Encounter', callbacks.onGenerateEncounter);
  const teleportBtn = createButton('📍 Teleport', callbacks.onTeleport, true);

  actionsButtons.appendChild(encounterBtn);
  actionsButtons.appendChild(teleportBtn);
  actionsContent.appendChild(actionsButtons);
  sidebar.appendChild(actionsSection);

  // =========================================================================
  // Helpers
  // =========================================================================

  function createSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'sidebar-section';
    section.style.cssText = `
      background: var(--background-primary);
      border-radius: 6px;
      padding: 8px;
    `;

    const header = document.createElement('div');
    header.className = 'section-header';
    header.textContent = title;
    header.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    `;

    const content = document.createElement('div');
    content.className = 'section-content';

    section.appendChild(header);
    section.appendChild(content);
    return section;
  }

  function createButton(
    label: string,
    onClick: () => void,
    disabled = false
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.disabled = disabled;
    btn.style.cssText = `
      background: var(--interactive-normal);
      border: 1px solid var(--background-modifier-border);
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 12px;
      color: var(--text-normal);
      cursor: ${disabled ? 'not-allowed' : 'pointer'};
      opacity: ${disabled ? '0.5' : '1'};
      transition: background 0.1s;
      flex: 1;
    `;

    if (!disabled) {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'var(--interactive-hover)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'var(--interactive-normal)';
      });
      btn.addEventListener('click', onClick);
    }

    return btn;
  }

  function updateTravelSection(travel: SidebarState['travel']): void {
    // Status
    const statusMap: Record<string, string> = {
      idle: '⏸️ Idle',
      planning: '📍 Planning...',
      traveling: '🚶 Traveling...',
      paused: '⏸️ Paused',
    };
    travelStatus.textContent = `Status: ${statusMap[travel.status] || travel.status}`;

    // Speed
    travelSpeed.textContent = `Speed: ${travel.speed} mi/day`;
    if (travel.currentTerrain) {
      travelSpeed.textContent += ` • ${travel.currentTerrain}`;
    }

    // Buttons based on status
    planBtn.disabled = travel.status !== 'idle';
    startBtn.disabled = travel.status !== 'idle';
    planBtn.style.opacity = planBtn.disabled ? '0.5' : '1';
    startBtn.style.opacity = startBtn.disabled ? '0.5' : '1';
    planBtn.style.cursor = planBtn.disabled ? 'not-allowed' : 'pointer';
    startBtn.style.cursor = startBtn.disabled ? 'not-allowed' : 'pointer';
  }

  function updateActionsSection(actions: SidebarState['actions']): void {
    encounterBtn.disabled = !actions.canGenerateEncounter;
    teleportBtn.disabled = !actions.canTeleport;

    encounterBtn.style.opacity = encounterBtn.disabled ? '0.5' : '1';
    teleportBtn.style.opacity = teleportBtn.disabled ? '0.5' : '1';
    encounterBtn.style.cursor = encounterBtn.disabled ? 'not-allowed' : 'pointer';
    teleportBtn.style.cursor = teleportBtn.disabled ? 'not-allowed' : 'pointer';
  }

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    update(state: RenderState): void {
      updateTravelSection(state.sidebar.travel);
      updateActionsSection(state.sidebar.actions);
    },

    setCollapsed(collapsed: boolean): void {
      sidebar.style.display = collapsed ? 'none' : 'flex';
    },

    dispose(): void {
      sidebar.remove();
    },
  };
}
