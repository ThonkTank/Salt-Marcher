/**
 * Travel Panel
 *
 * Sidebar panel for controlling overland travel.
 * Displays route information and travel controls.
 *
 * Uses MVVM-compliant Callbacks pattern - no direct orchestrator access.
 */

import type { PanelContext } from '../base-panel';
import { BasePanel } from '../base-panel-impl';
import type { TravelState } from '@/features/travel';
import { formatDuration } from '@/features/travel';
import {
  createLabelValuePair,
  createEmptyHint,
  createIconButton,
  createButtonGroup,
} from '@shared/form';

// ═══════════════════════════════════════════════════════════════
// Callbacks Interface
// ═══════════════════════════════════════════════════════════════

/**
 * Callbacks for TravelPanel actions.
 * View wires these to ViewModel methods.
 */
export interface TravelPanelCallbacks {
  onStartTravel: () => void;
  onPauseTravel: () => void;
  onResumeTravel: () => void;
  onStopTravel: () => void;
  onClearRoute: () => void;
  onSetAnimationSpeed: (speed: number) => void;
}

// ═══════════════════════════════════════════════════════════════
// CSS Classes
// ═══════════════════════════════════════════════════════════════

const CSS = {
  panel: 'travel-panel',
  info: 'travel-info',
  infoRow: 'travel-info-row',
  infoLabel: 'travel-info-label',
  infoValue: 'travel-info-value',
  controls: 'travel-controls',
  button: 'travel-button',
  buttonPrimary: 'travel-button--primary',
  buttonDanger: 'travel-button--danger',
  status: 'travel-status',
  statusIdle: 'travel-status--idle',
  statusPlanning: 'travel-status--planning',
  statusTraveling: 'travel-status--traveling',
  statusPaused: 'travel-status--paused',
  statusArrived: 'travel-status--arrived',
  speedControl: 'travel-speed-control',
  speedSlider: 'travel-speed-slider',
  empty: 'travel-empty',
} as const;

// ═══════════════════════════════════════════════════════════════
// Travel Panel
// ═══════════════════════════════════════════════════════════════

export class TravelPanel extends BasePanel {
  readonly id = 'travel';
  readonly displayName = 'Travel';
  readonly icon = 'footprints';
  readonly priority = 10;
  readonly collapsible = true;
  readonly defaultCollapsed = false;

  private readonly callbacks: TravelPanelCallbacks;

  constructor(callbacks: TravelPanelCallbacks) {
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
    this.clearAndRender(() => this.renderState(context.travelState));
  }

  // ─────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────

  private renderState(state: TravelState): void {
    const container = this.ensureContainer();
    container.empty();

    // Status indicator
    this.renderStatus(state);

    // Route info (if planning or traveling)
    if (state.route) {
      this.renderRouteInfo(state);
    }

    // Controls
    this.renderControls(state);

    // Speed control (if traveling)
    if (state.status === 'traveling' || state.status === 'paused') {
      this.renderSpeedControl();
    }

    // Empty state
    if (state.status === 'idle' && !state.route) {
      this.renderEmptyState();
    }
  }

  private renderStatus(state: TravelState): void {
    const container = this.ensureContainer();

    const statusText = {
      idle: 'Idle',
      planning: 'Planning Route',
      traveling: 'Traveling',
      paused: 'Paused',
      arrived: 'Arrived!',
    }[state.status];

    const statusClass = {
      idle: CSS.statusIdle,
      planning: CSS.statusPlanning,
      traveling: CSS.statusTraveling,
      paused: CSS.statusPaused,
      arrived: CSS.statusArrived,
    }[state.status];

    this.createStatusBadge(container, statusText, `${CSS.status} ${statusClass}`);
  }

  private renderRouteInfo(state: TravelState): void {
    const container = this.ensureContainer();
    if (!state.route) return;

    const infoEl = container.createDiv({ cls: CSS.info });

    // Distance
    createLabelValuePair(infoEl, 'Distance', `${state.route.totalDistance} hexes`);

    // Estimated time
    createLabelValuePair(infoEl, 'Est. Time', formatDuration(state.route.totalDuration));

    // Waypoints count
    createLabelValuePair(infoEl, 'Waypoints', `${state.route.waypoints.length}`);
  }

  private renderControls(state: TravelState): void {
    const container = this.ensureContainer();
    const controlsEl = createButtonGroup(container, CSS.controls);

    switch (state.status) {
      case 'idle':
        // No controls when idle without route
        break;

      case 'planning':
        createIconButton(controlsEl, 'Start Travel', 'play', () => {
          this.callbacks.onStartTravel();
        }, { primary: true, className: CSS.button });
        createIconButton(controlsEl, 'Clear Route', 'trash-2', () => {
          this.callbacks.onClearRoute();
        }, { danger: true, className: CSS.button });
        break;

      case 'traveling':
        createIconButton(controlsEl, 'Pause', 'pause', () => {
          this.callbacks.onPauseTravel();
        }, { className: CSS.button });
        createIconButton(controlsEl, 'Stop', 'square', () => {
          this.callbacks.onStopTravel();
        }, { danger: true, className: CSS.button });
        break;

      case 'paused':
        createIconButton(controlsEl, 'Resume', 'play', () => {
          this.callbacks.onResumeTravel();
        }, { primary: true, className: CSS.button });
        createIconButton(controlsEl, 'Stop', 'square', () => {
          this.callbacks.onStopTravel();
        }, { danger: true, className: CSS.button });
        break;

      case 'arrived':
        createIconButton(controlsEl, 'Done', 'check', () => {
          this.callbacks.onClearRoute();
        }, { primary: true, className: CSS.button });
        break;
    }
  }

  private renderSpeedControl(): void {
    const container = this.ensureContainer();
    const speedEl = this.createFlexRow(container, CSS.speedControl);

    const label = speedEl.createSpan({ text: 'Speed:' });
    label.style.fontSize = '0.9em';
    label.style.color = 'var(--text-muted)';

    const slider = speedEl.createEl('input', {
      cls: CSS.speedSlider,
      type: 'range',
      attr: {
        min: '1',
        max: '120',
        step: '1',
        value: '60',
      },
    });
    slider.style.flex = '1';
    slider.style.cursor = 'pointer';

    const valueDisplay = speedEl.createSpan({ text: '60x' });
    valueDisplay.style.minWidth = '40px';
    valueDisplay.style.textAlign = 'right';
    valueDisplay.style.fontWeight = '500';

    slider.addEventListener('input', () => {
      const value = parseInt(slider.value);
      valueDisplay.setText(`${value}x`);
      this.callbacks.onSetAnimationSpeed(value);
    });
  }

  private renderEmptyState(): void {
    const container = this.ensureContainer();
    createEmptyHint(container, 'Click on the map to add waypoints and plan a route.', CSS.empty);
  }
}
