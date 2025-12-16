/**
 * Encounter Panel
 *
 * Panel for displaying active encounters during travel.
 * Shows creature groups, XP, difficulty, and resolution controls.
 *
 * Uses MVVM-compliant Callbacks pattern - no direct orchestrator access.
 */

import type { PanelContext } from '@/application/session-runner/panels/base-panel';
import { BasePanel } from '@/application/session-runner/panels/base-panel-impl';
import type { GeneratedEncounter, EncounterCreatureGroup } from '@/features/encounter';
import {
  createIconButton,
  createButtonGroup,
  createLabelValuePair,
  createEmptyHint,
} from '@shared/form';

// ═══════════════════════════════════════════════════════════════
// Callbacks Interface
// ═══════════════════════════════════════════════════════════════

/**
 * Callbacks for EncounterPanel actions.
 * View wires these to EventBus events.
 */
export interface EncounterPanelCallbacks {
  onResolve: (outcome: 'victory' | 'flee' | 'negotiated') => void;
  onDismiss: () => void;
}

// ═══════════════════════════════════════════════════════════════
// CSS Classes
// ═══════════════════════════════════════════════════════════════

const CSS = {
  panel: 'encounter-panel',
  header: 'encounter-header',
  difficultyBadge: 'encounter-difficulty-badge',
  info: 'encounter-info',
  creatureTable: 'encounter-creatures',
  controls: 'encounter-controls',
  empty: 'encounter-empty',
} as const;

// ═══════════════════════════════════════════════════════════════
// Encounter Panel
// ═══════════════════════════════════════════════════════════════

export class EncounterPanel extends BasePanel {
  readonly id = 'encounter';
  readonly displayName = 'Encounter';
  readonly icon = 'swords';
  readonly priority = 15;
  readonly collapsible = true;
  readonly defaultCollapsed = false;

  private readonly callbacks: EncounterPanelCallbacks;

  constructor(callbacks: EncounterPanelCallbacks) {
    super();
    this.callbacks = callbacks;
  }

  // ─────────────────────────────────────────────────────────────
  // BasePanel Hooks
  // ─────────────────────────────────────────────────────────────

  protected getPanelClass(): string {
    return CSS.panel;
  }

  protected onRender(): void {
    // Initial render is triggered by first onUpdate() call
  }

  protected onUpdate(context: PanelContext): void {
    this.clearAndRender(() => this.renderState(context));
  }

  // ─────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────

  private renderState(context: PanelContext): void {
    const container = this.ensureContainer();
    container.empty();

    const encounter = context.activeEncounter;

    if (!encounter) {
      this.renderEmptyState();
      return;
    }

    // Header with difficulty badge
    this.renderHeader(encounter);

    // Summary info
    this.renderSummary(encounter);

    // Creature table
    this.renderCreatureTable(encounter.groups);

    // Action buttons
    this.renderControls();
  }

  private renderEmptyState(): void {
    const container = this.ensureContainer();
    createEmptyHint(
      container,
      'No active encounter. Travel to trigger encounter checks.',
      CSS.empty
    );
  }

  private renderHeader(encounter: GeneratedEncounter): void {
    const container = this.ensureContainer();
    const header = container.createDiv({ cls: CSS.header });

    // Difficulty badge
    const badge = header.createSpan({ cls: CSS.difficultyBadge });
    badge.setText(encounter.difficulty.toUpperCase());
    badge.dataset.difficulty = encounter.difficulty;

    // Terrain info
    header.createSpan({ text: ` \u2022 ${encounter.terrain}` });
  }

  private renderSummary(encounter: GeneratedEncounter): void {
    const container = this.ensureContainer();
    const info = container.createDiv({ cls: CSS.info });

    createLabelValuePair(info, 'Creatures', String(encounter.creatureCount));
    createLabelValuePair(info, 'Total XP', String(encounter.totalXp));
    createLabelValuePair(
      info,
      'Adjusted XP',
      `${encounter.adjustedXp} (\u00d7${encounter.multiplier})`
    );
  }

  private renderCreatureTable(groups: EncounterCreatureGroup[]): void {
    const container = this.ensureContainer();
    const table = container.createEl('table', { cls: CSS.creatureTable });

    // Header
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');
    ['Creature', 'CR', 'Count', 'XP'].forEach((h) =>
      headerRow.createEl('th', { text: h })
    );

    // Body
    const tbody = table.createEl('tbody');
    for (const group of groups) {
      const row = tbody.createEl('tr');
      row.createEl('td', { text: group.creatureName });
      row.createEl('td', { text: group.cr });
      row.createEl('td', { text: String(group.count) });
      row.createEl('td', { text: String(group.count * group.xpEach) });
    }
  }

  private renderControls(): void {
    const container = this.ensureContainer();
    const controls = createButtonGroup(container, CSS.controls);

    createIconButton(
      controls,
      'Victory',
      'swords',
      () => {
        this.callbacks.onResolve('victory');
      },
      { primary: true }
    );

    createIconButton(controls, 'Flee', 'footprints', () => {
      this.callbacks.onResolve('flee');
    });

    createIconButton(controls, 'Negotiated', 'handshake', () => {
      this.callbacks.onResolve('negotiated');
    });

    createIconButton(
      controls,
      'Dismiss',
      'x',
      () => {
        this.callbacks.onDismiss();
      },
      { danger: true }
    );
  }
}
