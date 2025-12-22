/**
 * Sidebar Panel (Quick Controls).
 *
 * Displays Travel, Audio, Party, and Actions sections.
 */

import type { RenderState, SidebarState, QuestSectionState, QuestStatusFilter, QuestProgressDisplay, PartySectionState } from '../types';

// ============================================================================
// Sidebar Panel Callbacks
// ============================================================================

export interface SidebarPanelCallbacks {
  // Travel
  /** Toggle travel planning mode (click on map to add waypoints) */
  onToggleTravelMode: () => void;
  /** Start travel along planned route */
  onStartTravel: () => void;
  /** Pause travel */
  onPauseTravel: () => void;
  /** Resume paused travel */
  onResumeTravel: () => void;
  /** Cancel travel (stop and clear route) */
  onCancelTravel: () => void;

  // Party
  /** Open party management (shows "Coming soon" notification) */
  onManageParty: () => void;

  // Quest
  /** Change quest status filter */
  onQuestStatusFilterChange: (filter: QuestStatusFilter) => void;
  /** Activate a discovered quest */
  onActivateQuest: (questId: string) => void;
  /** Complete a quest */
  onCompleteQuest: (questId: string) => void;
  /** Fail/Abandon a quest */
  onFailQuest: (questId: string) => void;
  /** Toggle objective completion */
  onToggleObjective: (questId: string, objectiveId: string) => void;
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

  // Waypoint count display (shows during planning)
  const waypointCount = document.createElement('div');
  waypointCount.className = 'waypoint-count';
  waypointCount.style.cssText = `
    font-size: 11px;
    color: var(--text-accent);
    margin-bottom: 6px;
    display: none;
  `;

  // ETA display (shows during planning/traveling)
  const etaDisplay = document.createElement('div');
  etaDisplay.className = 'eta-display';
  etaDisplay.style.cssText = `
    font-size: 11px;
    color: var(--text-success);
    margin-bottom: 6px;
    display: none;
  `;

  const travelButtons = document.createElement('div');
  travelButtons.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 4px;
  `;

  // Row 1: Plan/Cancel Plan + Start
  const row1 = document.createElement('div');
  row1.style.cssText = 'display: flex; gap: 4px;';

  const planBtn = createButton('Plan', callbacks.onToggleTravelMode);
  const startBtn = createButton('Start', callbacks.onStartTravel, true);
  startBtn.style.display = 'none'; // Hidden until waypoints exist

  row1.appendChild(planBtn);
  row1.appendChild(startBtn);

  // Row 2: Pause/Resume + Cancel (shown during travel)
  const row2 = document.createElement('div');
  row2.style.cssText = 'display: none; gap: 4px;';

  const pauseResumeBtn = createButton('Pause', callbacks.onPauseTravel);
  const cancelBtn = createButton('Cancel', callbacks.onCancelTravel);

  row2.appendChild(pauseResumeBtn);
  row2.appendChild(cancelBtn);

  travelButtons.appendChild(row1);
  travelButtons.appendChild(row2);

  travelContent.appendChild(travelStatus);
  travelContent.appendChild(travelSpeed);
  travelContent.appendChild(waypointCount);
  travelContent.appendChild(etaDisplay);
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

  // === Party Section ===
  const partySection = createSection('👥 PARTY');
  const partyContent = partySection.querySelector('.section-content') as HTMLElement;

  // Party status row (size + health)
  const partyStatus = document.createElement('div');
  partyStatus.className = 'party-status';
  partyStatus.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 8px;
  `;

  const partySizeEl = document.createElement('span');
  partySizeEl.className = 'party-size';

  const healthSummaryEl = document.createElement('span');
  healthSummaryEl.className = 'health-summary';

  partyStatus.appendChild(partySizeEl);
  partyStatus.appendChild(healthSummaryEl);
  partyContent.appendChild(partyStatus);

  // Manage button
  const manageBtn = createButton('Manage →', callbacks.onManageParty);
  manageBtn.style.width = '100%';
  partyContent.appendChild(manageBtn);

  sidebar.appendChild(partySection);

  // === Quest Section ===
  const questSection = createSection('📜 QUESTS');
  const questContent = questSection.querySelector('.section-content') as HTMLElement;
  sidebar.appendChild(questSection);

  // === Actions Section ===
  const actionsSection = createSection('⚔️ ACTIONS');
  const actionsContent = actionsSection.querySelector('.section-content') as HTMLElement;

  // Placeholder until Rest button is implemented (Task #2309)
  const placeholderText = document.createElement('div');
  placeholderText.style.cssText = `
    font-size: 12px;
    color: var(--text-faint);
    font-style: italic;
  `;
  placeholderText.textContent = 'Coming soon...';
  actionsContent.appendChild(placeholderText);
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

    // IMMER Event-Listener hinzufügen - disabled-Attribut verhindert native Klicks
    btn.addEventListener('mouseenter', () => {
      if (!btn.disabled) {
        btn.style.background = 'var(--interactive-hover)';
      }
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'var(--interactive-normal)';
    });
    btn.addEventListener('click', onClick);

    return btn;
  }

  function updateTravelSection(state: RenderState): void {
    const { travelMode, planningWaypoints, travelStatus: status } = state;
    const travel = state.sidebar.travel;

    // Status display
    const statusMap: Record<string, string> = {
      idle: '⏸️ Idle',
      planning: '📍 Planning...',
      traveling: '🚶 Traveling...',
      paused: '⏸️ Paused',
    };

    // Use travelMode for planning state, otherwise use travel feature status
    const displayStatus = travelMode ? 'planning' : status;
    travelStatus.textContent = `Status: ${statusMap[displayStatus] || displayStatus}`;

    // Speed
    travelSpeed.textContent = `Speed: ${travel.speed} mi/day`;
    if (travel.currentTerrain) {
      travelSpeed.textContent += ` • ${travel.currentTerrain}`;
    }

    // Waypoint count (visible during planning)
    if (travelMode && planningWaypoints.length > 0) {
      waypointCount.style.display = 'block';
      waypointCount.textContent = `📍 ${planningWaypoints.length} waypoint${planningWaypoints.length > 1 ? 's' : ''} set`;
    } else {
      waypointCount.style.display = 'none';
    }

    // Button visibility based on travel state
    const isIdle = status === 'idle' && !travelMode;
    const isPlanning = travelMode || status === 'planning'; // Also check status for route-ready state
    const isTraveling = status === 'traveling';
    const isPaused = status === 'paused';

    // Row 1: Plan + Start (visible when idle or planning)
    row1.style.display = (isIdle || isPlanning) ? 'flex' : 'none';

    // Plan button: toggles between "Plan" and "Cancel Plan"
    planBtn.textContent = travelMode ? 'Cancel Plan' : 'Plan';
    updateButtonState(planBtn, status === 'idle' || travelMode);

    // Start button: visible when planning with waypoints OR route is ready
    const canStart = (travelMode && planningWaypoints.length > 0) || status === 'planning';
    startBtn.style.display = isPlanning ? 'flex' : 'none';
    updateButtonState(startBtn, canStart);

    // Row 2: Pause/Resume + Cancel (visible when traveling or paused)
    row2.style.display = (isTraveling || isPaused) ? 'flex' : 'none';

    // Pause/Resume button
    if (isTraveling) {
      pauseResumeBtn.textContent = 'Pause';
      pauseResumeBtn.onclick = callbacks.onPauseTravel;
    } else if (isPaused) {
      pauseResumeBtn.textContent = 'Resume';
      pauseResumeBtn.onclick = callbacks.onResumeTravel;
    }
    updateButtonState(pauseResumeBtn, true);
    updateButtonState(cancelBtn, true);

    // ETA display (visible during planning, traveling, or paused)
    // Use previewETA during planning, otherwise travel.eta
    const etaToShow = state.previewETA || travel.eta;
    if (etaToShow && (isPlanning || isTraveling || isPaused)) {
      etaDisplay.textContent = `⏱️ ETA: ${etaToShow.display}`;
      etaDisplay.style.display = 'block';
    } else {
      etaDisplay.style.display = 'none';
    }
  }

  function updateButtonState(btn: HTMLButtonElement, enabled: boolean): void {
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? '1' : '0.5';
    btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
  }

  function updateQuestSection(quest: QuestSectionState): void {
    // Clear existing content
    questContent.innerHTML = '';

    // === Status Filter Dropdown ===
    const filterRow = document.createElement('div');
    filterRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    `;

    const filterLabel = document.createElement('span');
    filterLabel.style.cssText = `
      font-size: 11px;
      color: var(--text-muted);
    `;
    filterLabel.textContent = 'Status:';

    const filterSelect = document.createElement('select');
    filterSelect.style.cssText = `
      flex: 1;
      font-size: 11px;
      padding: 4px 6px;
      background: var(--background-modifier-form-field);
      border: 1px solid var(--background-modifier-border);
      border-radius: 4px;
      color: var(--text-normal);
    `;

    const filterOptions: { value: QuestStatusFilter; label: string }[] = [
      { value: 'all', label: 'All' },
      { value: 'active', label: 'Active' },
      { value: 'discovered', label: 'Discovered' },
      { value: 'completed', label: 'Completed' },
      { value: 'failed', label: 'Failed' },
    ];

    for (const opt of filterOptions) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      option.selected = opt.value === quest.statusFilter;
      filterSelect.appendChild(option);
    }

    filterSelect.addEventListener('change', () => {
      callbacks.onQuestStatusFilterChange(filterSelect.value as QuestStatusFilter);
    });

    filterRow.appendChild(filterLabel);
    filterRow.appendChild(filterSelect);
    questContent.appendChild(filterRow);

    // === Filter quests based on status ===
    const filteredQuests = quest.allQuests.filter(q => {
      if (quest.statusFilter === 'all') return true;
      return q.status === quest.statusFilter;
    });

    // === Show empty message if no quests ===
    if (filteredQuests.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.style.cssText = `
        font-size: 12px;
        color: var(--text-faint);
        font-style: italic;
        padding: 8px 0;
      `;
      emptyMessage.textContent = quest.statusFilter === 'all'
        ? 'No quests yet'
        : `No ${quest.statusFilter} quests`;
      questContent.appendChild(emptyMessage);
      return;
    }

    // === Render filtered quests ===
    for (const questItem of filteredQuests) {
      questContent.appendChild(renderQuestItem(questItem));
    }
  }

  function renderQuestItem(questItem: QuestProgressDisplay): HTMLElement {
    const questEl = document.createElement('div');

    // Border color based on status
    const borderColors: Record<string, string> = {
      active: 'var(--text-accent)',
      discovered: 'var(--text-warning)',
      completed: 'var(--text-success)',
      failed: 'var(--text-error)',
    };

    questEl.style.cssText = `
      margin-bottom: 8px;
      padding: 8px;
      background: var(--background-modifier-hover);
      border-radius: 4px;
      border-left: 3px solid ${borderColors[questItem.status] || 'var(--text-muted)'};
    `;

    // === Quest Header (Name + Deadline) ===
    const headerRow = document.createElement('div');
    headerRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    `;

    const nameEl = document.createElement('div');
    nameEl.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: var(--text-normal);
    `;
    nameEl.textContent = questItem.name;

    // Deadline indicator
    if (questItem.hasDeadline) {
      const deadlineEl = document.createElement('span');
      deadlineEl.style.cssText = `
        font-size: 10px;
        color: var(--text-warning);
        margin-left: 4px;
      `;
      deadlineEl.textContent = '⏰';
      deadlineEl.title = questItem.deadlineDisplay || 'Has deadline';
      nameEl.appendChild(deadlineEl);
    }

    headerRow.appendChild(nameEl);
    questEl.appendChild(headerRow);

    // === Objectives with Checkboxes (for active quests) ===
    if (questItem.status === 'active' && questItem.objectives.length > 0) {
      const objectivesContainer = document.createElement('div');
      objectivesContainer.style.cssText = `
        margin-bottom: 6px;
      `;

      for (const obj of questItem.objectives) {
        const objRow = document.createElement('label');
        objRow.style.cssText = `
          display: flex;
          align-items: flex-start;
          gap: 6px;
          font-size: 11px;
          color: var(--text-muted);
          cursor: pointer;
          margin-bottom: 2px;
        `;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = obj.completed;
        checkbox.disabled = obj.completed; // Can't uncheck completed objectives
        checkbox.style.cssText = `
          margin-top: 2px;
          cursor: ${obj.completed ? 'not-allowed' : 'pointer'};
        `;

        if (!obj.completed) {
          checkbox.addEventListener('change', () => {
            callbacks.onToggleObjective(questItem.questId, obj.objectiveId);
          });
        }

        const objText = document.createElement('span');
        objText.style.cssText = obj.completed
          ? 'text-decoration: line-through; opacity: 0.7;'
          : '';
        objText.textContent = obj.target > 1
          ? `${obj.description} (${obj.current}/${obj.target})`
          : obj.description;

        objRow.appendChild(checkbox);
        objRow.appendChild(objText);
        objectivesContainer.appendChild(objRow);
      }

      questEl.appendChild(objectivesContainer);
    }

    // === XP Pool + Info Row ===
    const infoRow = document.createElement('div');
    infoRow.style.cssText = `
      font-size: 10px;
      color: var(--text-muted);
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    `;

    if (questItem.accumulatedXP > 0) {
      const xpEl = document.createElement('span');
      xpEl.style.color = 'var(--text-success)';
      xpEl.textContent = `XP: ${questItem.accumulatedXP}`;
      infoRow.appendChild(xpEl);
    }

    if (questItem.questGiver) {
      const giverEl = document.createElement('span');
      giverEl.textContent = `NPC: ${questItem.questGiver}`;
      infoRow.appendChild(giverEl);
    }

    if (infoRow.childNodes.length > 0) {
      questEl.appendChild(infoRow);
    }

    // === Quick Actions ===
    const actionsRow = document.createElement('div');
    actionsRow.style.cssText = `
      display: flex;
      gap: 4px;
      margin-top: 6px;
    `;

    if (questItem.status === 'discovered') {
      const activateBtn = createSmallButton('Activate', () => {
        callbacks.onActivateQuest(questItem.questId);
      });
      actionsRow.appendChild(activateBtn);
    }

    if (questItem.status === 'active') {
      const completeBtn = createSmallButton('Complete', () => {
        callbacks.onCompleteQuest(questItem.questId);
      }, 'var(--text-success)');
      const failBtn = createSmallButton('Fail', () => {
        callbacks.onFailQuest(questItem.questId);
      }, 'var(--text-error)');
      actionsRow.appendChild(completeBtn);
      actionsRow.appendChild(failBtn);
    }

    if (actionsRow.childNodes.length > 0) {
      questEl.appendChild(actionsRow);
    }

    return questEl;
  }

  function updatePartySection(party: PartySectionState): void {
    // Update party size - with bullet separator for spec conformity
    // Spec: "4 PCs • All OK" (SessionRunner.md#party-sektion)
    const sizeText = party.size === 0
      ? 'No Party'
      : party.size === 1
        ? '1 PC'
        : `${party.size} PCs`;

    // Bullet only when party exists (health summary is shown)
    partySizeEl.textContent = party.size > 0 ? `${sizeText} •` : sizeText;

    // Update health summary with color
    healthSummaryEl.textContent = party.healthSummary.display;

    // Color based on worst status
    if (party.healthSummary.down > 0) {
      healthSummaryEl.style.color = 'var(--text-error)';
    } else if (party.healthSummary.critical > 0) {
      healthSummaryEl.style.color = 'var(--text-warning)';
    } else if (party.healthSummary.wounded > 0) {
      healthSummaryEl.style.color = 'var(--text-muted)';
    } else {
      healthSummaryEl.style.color = 'var(--text-success)';
    }
  }

  function createSmallButton(
    label: string,
    onClick: () => void,
    color?: string
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      background: transparent;
      border: 1px solid ${color || 'var(--background-modifier-border)'};
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 10px;
      color: ${color || 'var(--text-normal)'};
      cursor: pointer;
      transition: background 0.1s;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'var(--background-modifier-hover)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    update(state: RenderState): void {
      updateTravelSection(state);
      updatePartySection(state.sidebar.party);
      updateQuestSection(state.sidebar.quest);
      // Actions section is static until Rest button is implemented (Task #2309)
    },

    setCollapsed(collapsed: boolean): void {
      sidebar.style.display = collapsed ? 'none' : 'flex';
    },

    dispose(): void {
      sidebar.remove();
    },
  };
}
