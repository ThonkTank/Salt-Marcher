/**
 * Calendar Panel
 *
 * Sidebar panel displaying current game date, time, season, and moon phases.
 * Provides quick time advancement controls.
 *
 * Uses MVVM-compliant Callbacks pattern - no direct service access.
 */

import { setIcon } from 'obsidian';
import type { PanelContext } from '../base-panel';
import { BasePanel } from '../base-panel-impl';
import type { DateTime, CalendarConfig, TimeOfDay, Duration } from '@core/schemas/time';
import type { TimeChangeReason } from '@/features/time';
import { createDivider, createIconButton, createButtonGroup } from '@shared/form';

// ═══════════════════════════════════════════════════════════════
// Callbacks Interface
// ═══════════════════════════════════════════════════════════════

/**
 * Callbacks for CalendarPanel actions.
 * View wires these to ViewModel methods.
 */
export interface CalendarPanelCallbacks {
  onAdvanceTime: (duration: Duration, reason: TimeChangeReason) => void;
}

// ═══════════════════════════════════════════════════════════════
// CSS Classes
// ═══════════════════════════════════════════════════════════════

const CSS = {
  panel: 'calendar-panel',
  date: 'calendar-date',
  dateMain: 'calendar-date-main',
  dateYear: 'calendar-date-year',
  time: 'calendar-time',
  timeValue: 'calendar-time-value',
  period: 'calendar-period',
  season: 'calendar-season',
  moons: 'calendar-moons',
  moon: 'calendar-moon',
  moonIcon: 'calendar-moon-icon',
  moonName: 'calendar-moon-name',
  moonPhase: 'calendar-moon-phase',
  controls: 'calendar-controls',
  controlButton: 'calendar-control-button',
  divider: 'calendar-divider',
} as const;

// ═══════════════════════════════════════════════════════════════
// Time of Day Display Names
// ═══════════════════════════════════════════════════════════════

const TIME_OF_DAY_LABELS: Record<TimeOfDay, { label: string; icon: string }> = {
  dawn: { label: 'Dawn', icon: 'sunrise' },
  morning: { label: 'Morning', icon: 'sun' },
  midday: { label: 'Midday', icon: 'sun' },
  afternoon: { label: 'Afternoon', icon: 'sun' },
  evening: { label: 'Evening', icon: 'sunset' },
  night: { label: 'Night', icon: 'moon' },
};

// ═══════════════════════════════════════════════════════════════
// Moon Phase Icons
// ═══════════════════════════════════════════════════════════════

const MOON_PHASE_ICONS: Record<string, string> = {
  new: 'circle',
  waxing: 'moon',
  full: 'circle-dot',
  waning: 'moon',
};

// ═══════════════════════════════════════════════════════════════
// Calendar Panel
// ═══════════════════════════════════════════════════════════════

export class CalendarPanel extends BasePanel {
  readonly id = 'calendar';
  readonly displayName = 'Calendar';
  readonly icon = 'calendar';
  readonly priority = 20;
  readonly collapsible = true;
  readonly defaultCollapsed = false;

  private readonly callbacks: CalendarPanelCallbacks;

  constructor(callbacks: CalendarPanelCallbacks) {
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

    const { currentDateTime, calendar, timeOfDay, season, moonPhases } = context;

    // Date display
    this.renderDate(currentDateTime, calendar);

    // Time display
    this.renderTime(currentDateTime, timeOfDay);

    // Divider
    createDivider(container);

    // Season
    if (season) {
      this.renderSeason(season.name);
    }

    // Moon phases
    if (moonPhases.length > 0) {
      this.renderMoons(moonPhases);
    }

    // Divider
    createDivider(container);

    // Quick time controls
    this.renderControls();
  }

  private renderDate(dateTime: DateTime, calendar: CalendarConfig): void {
    const container = this.ensureContainer();

    const dateEl = container.createDiv({ cls: CSS.date });
    dateEl.style.textAlign = 'center';

    // Month and day
    const monthName = calendar.monthNames[dateTime.month - 1] || `Month ${dateTime.month}`;
    const mainEl = dateEl.createDiv({ cls: CSS.dateMain });
    mainEl.style.fontSize = '1.4em';
    mainEl.style.fontWeight = '600';
    mainEl.setText(`${monthName} ${dateTime.day}`);

    // Year
    const yearEl = dateEl.createDiv({ cls: CSS.dateYear });
    yearEl.style.fontSize = '0.9em';
    yearEl.style.color = 'var(--text-muted)';
    yearEl.setText(`Year ${dateTime.year}`);
  }

  private renderTime(dateTime: DateTime, timeOfDay: TimeOfDay): void {
    const container = this.ensureContainer();

    const timeEl = this.createFlexRow(container, CSS.time, { gap: '12px', justify: 'center' });

    // Clock time
    const hours = String(dateTime.hour).padStart(2, '0');
    const minutes = String(dateTime.minute).padStart(2, '0');
    const timeValueEl = timeEl.createDiv({ cls: CSS.timeValue });
    timeValueEl.style.fontSize = '1.2em';
    timeValueEl.style.fontFamily = 'monospace';
    timeValueEl.style.fontWeight = '500';
    timeValueEl.setText(`${hours}:${minutes}`);

    // Time of day period
    const periodInfo = TIME_OF_DAY_LABELS[timeOfDay];
    const periodEl = this.createFlexRow(timeEl, CSS.period, { gap: '4px' });
    periodEl.style.color = 'var(--text-muted)';
    const periodIconEl = periodEl.createSpan();
    setIcon(periodIconEl, periodInfo.icon);
    periodEl.createSpan({ text: periodInfo.label });
  }

  private renderSeason(seasonName: string): void {
    const container = this.ensureContainer();

    const seasonEl = this.createFlexRow(container, CSS.season, { gap: '6px', justify: 'center' });
    const iconEl = seasonEl.createSpan();
    setIcon(iconEl, 'leaf');
    seasonEl.createSpan({ text: seasonName });
  }

  private renderMoons(moons: Array<{ moon: string; phase: string }>): void {
    const container = this.ensureContainer();

    const moonsEl = this.createFlexColumn(container, CSS.moons, { gap: '4px' });

    for (const { moon, phase } of moons) {
      const moonEl = this.createFlexRow(moonsEl, CSS.moon, { gap: '6px', justify: 'center' });

      // Moon icon
      const iconEl = moonEl.createSpan({ cls: CSS.moonIcon });
      const icon = MOON_PHASE_ICONS[phase.toLowerCase()] || 'moon';
      setIcon(iconEl, icon);

      // Moon name and phase
      const nameEl = moonEl.createSpan({ cls: CSS.moonName, text: moon });
      nameEl.style.fontWeight = '500';
      const phaseEl = moonEl.createSpan({ cls: CSS.moonPhase, text: `(${phase})` });
      phaseEl.style.color = 'var(--text-muted)';
      phaseEl.style.fontSize = '0.9em';
    }
  }

  private renderControls(): void {
    const container = this.ensureContainer();

    const controlsEl = createButtonGroup(container, CSS.controls);
    controlsEl.style.justifyContent = 'center';

    // +1 hour
    createIconButton(controlsEl, '+1h', 'clock', () => {
      this.callbacks.onAdvanceTime({ hours: 1 }, 'manual');
    }, { className: CSS.controlButton });

    // +8 hours (rest)
    createIconButton(controlsEl, '+8h', 'bed', () => {
      this.callbacks.onAdvanceTime({ hours: 8 }, 'rest');
    }, { className: CSS.controlButton });

    // +1 day
    createIconButton(controlsEl, '+1d', 'calendar-plus', () => {
      this.callbacks.onAdvanceTime({ days: 1 }, 'manual');
    }, { className: CSS.controlButton });
  }
}
