// src/workmodes/almanac/view/astronomical-panel.ts
// Astronomical panel showing moon phases, eclipses, and seasonal transitions

import {
  DefaultAstronomicalCalculator,
  getDayOfYear,
  advanceTime,
  formatTimestamp,
} from '../helpers';
import { createCollapsiblePanelState, createCollapseToggleButton } from './panel-collapse-util';
import type { CalendarStateGateway } from '../data/calendar-state-gateway';
import type { CalendarSchema, CalendarTimestamp, PhenomenonOccurrence } from '../helpers';

export interface AstronomicalPanelOptions {
  readonly currentTimestamp: CalendarTimestamp;
  readonly schema: CalendarSchema;
  readonly gateway: CalendarStateGateway;
  readonly onEventClick?: (event: PhenomenonOccurrence) => void;
}

export interface AstronomicalPanelHandle {
  update(timestamp: CalendarTimestamp, schema: CalendarSchema): Promise<void>;
  destroy(): void;
}

const MOON_PHASE_ICONS: Record<string, string> = {
  new_moon: '🌑',
  waxing_crescent: '🌒',
  first_quarter: '🌓',
  waxing_gibbous: '🌔',
  full_moon: '🌕',
  waning_gibbous: '🌖',
  last_quarter: '🌗',
  waning_crescent: '🌘',
};

export function createAstronomicalPanel(
  container: HTMLElement,
  options: AstronomicalPanelOptions,
): AstronomicalPanelHandle {
  const { currentTimestamp, schema, gateway, onEventClick } = options;
  const calculator = new DefaultAstronomicalCalculator();
  const root = container.createDiv({ cls: 'sm-astronomical-panel' });

  // Phase 2: Create collapsible panel state
  const collapseState = createCollapsiblePanelState({
    panelId: 'astronomical',
    defaultCollapsed: false,
  });

  renderPanel(currentTimestamp, schema);

  async function renderPanel(timestamp: CalendarTimestamp, calendarSchema: CalendarSchema): Promise<void> {
    root.empty();

    // Phase 2: Add header with collapse button
    const header = root.createDiv({ cls: 'sm-astronomical-panel__header' });
    const collapseBtn = createCollapseToggleButton(collapseState, () => renderPanel(timestamp, calendarSchema));
    header.appendChild(collapseBtn);
    header.createEl('h3', { text: 'Astronomische Ereignisse', cls: 'sm-astronomical-panel__title' });

    // Phase 2: Stop here if collapsed
    if (collapseState.isCollapsed) {
      return;
    }

    const currentPhaseSection = root.createDiv({ cls: 'sm-astronomical-panel__section' });
    renderCurrentMoonPhase(currentPhaseSection, timestamp, calendarSchema);

    const nextEclipseSection = root.createDiv({ cls: 'sm-astronomical-panel__section' });
    await renderNextEclipse(nextEclipseSection, timestamp, calendarSchema);

    const nextSeasonSection = root.createDiv({ cls: 'sm-astronomical-panel__section' });
    renderNextSeason(nextSeasonSection, timestamp, calendarSchema);

    const timelineSection = root.createDiv({ cls: 'sm-astronomical-panel__section' });
    await renderTimeline(timelineSection, timestamp, calendarSchema);
  }

  function renderCurrentMoonPhase(s: HTMLElement, t: CalendarTimestamp, c: CalendarSchema): void {
    const dayOfYear = getDayOfYear(c, t);
    const moonPhase = calculator.computeMoonPhase(dayOfYear, t.year);
    const header = s.createDiv({ cls: 'sm-astronomical-panel__header' });
    const icon = header.createSpan({ cls: 'sm-astronomical-panel__icon' });
    icon.textContent = MOON_PHASE_ICONS[moonPhase.phase] || '🌙';
    header.createSpan({ text: 'Aktuelle Mondphase', cls: 'sm-astronomical-panel__header-text' });
    const content = s.createDiv({ cls: 'sm-astronomical-panel__content' });
    content.createDiv({ text: moonPhase.name, cls: 'sm-astronomical-panel__phase-name' });
    content.createDiv({ text: Math.round(moonPhase.illumination * 100) + '% beleuchtet', cls: 'sm-astronomical-panel__phase-illumination' });
  }

  async function renderNextEclipse(s: HTMLElement, t: CalendarTimestamp, c: CalendarSchema): Promise<void> {
    let nextEclipse: { day: number; year: number; timestamp: CalendarTimestamp } | null = null;
    for (let offset = 0; offset <= 60; offset++) {
      const candidate = advanceTime(c, t, offset, 'day').timestamp;
      const dayOfYear = getDayOfYear(c, candidate);
      const eclipse = calculator.computeEclipse(dayOfYear, candidate.year);
      if (eclipse !== null) {
        nextEclipse = { day: dayOfYear, year: candidate.year, timestamp: candidate };
        break;
      }
    }
    const header = s.createDiv({ cls: 'sm-astronomical-panel__header' });
    header.createSpan({ cls: 'sm-astronomical-panel__icon', text: '🌑' });
    header.createSpan({ text: 'Nächste Eklipse', cls: 'sm-astronomical-panel__header-text' });
    const content = s.createDiv({ cls: 'sm-astronomical-panel__content' });
    if (nextEclipse) {
      const eclipse = calculator.computeEclipse(nextEclipse.day, nextEclipse.year);
      if (eclipse) {
        const daysUntil = Math.round((getDayOfYear(c, nextEclipse.timestamp) - getDayOfYear(c, t)) + (nextEclipse.timestamp.year - t.year) * 365);
        const eclipseType = eclipse.type === 'solar' ? 'Sonnenfinsternis' : 'Mondfinsternis';
        const intensityMap: Record<string, string> = { total: 'Total', partial: 'Partiell', annular: 'Ringförmig', penumbral: 'Halbschatten' };
        content.createDiv({ text: eclipseType + ' (' + intensityMap[eclipse.intensity] + ')', cls: 'sm-astronomical-panel__eclipse-type' });
        content.createDiv({ text: 'In ' + daysUntil + ' Tag' + (daysUntil !== 1 ? 'en' : ''), cls: 'sm-astronomical-panel__eclipse-days' });
        const vis = eclipse.visibility === 'global' ? 'Global' : eclipse.visibility === 'regional' ? 'Regional' : 'Lokal';
        content.createDiv({ text: 'Sichtbarkeit: ' + vis, cls: 'sm-astronomical-panel__eclipse-visibility' });
      }
    } else {
      content.createDiv({ text: 'Keine Eklipse in den nächsten 60 Tagen', cls: 'sm-astronomical-panel__no-eclipse' });
    }
  }

  function renderNextSeason(s: HTMLElement, t: CalendarTimestamp, c: CalendarSchema): void {
    const currentDay = getDayOfYear(c, t);
    const transitions = [
      { day: 80, name: 'Frühlingsanfang', icon: '🌸' },
      { day: 172, name: 'Sommeranfang', icon: '☀️' },
      { day: 266, name: 'Herbstanfang', icon: '🍂' },
      { day: 355, name: 'Winteranfang', icon: '❄️' },
    ];
    let nextTransition = transitions.find((tr) => tr.day > currentDay);
    if (!nextTransition) nextTransition = transitions[0];
    const daysUntil = nextTransition.day > currentDay ? nextTransition.day - currentDay : (365 - currentDay) + nextTransition.day;
    const header = s.createDiv({ cls: 'sm-astronomical-panel__header' });
    header.createSpan({ cls: 'sm-astronomical-panel__icon', text: nextTransition.icon });
    header.createSpan({ text: 'Nächste Jahreszeit', cls: 'sm-astronomical-panel__header-text' });
    const content = s.createDiv({ cls: 'sm-astronomical-panel__content' });
    content.createDiv({ text: nextTransition.name, cls: 'sm-astronomical-panel__season-name' });
    content.createDiv({ text: 'In ' + daysUntil + ' Tag' + (daysUntil !== 1 ? 'en' : ''), cls: 'sm-astronomical-panel__season-days' });
  }

  async function renderTimeline(s: HTMLElement, t: CalendarTimestamp, c: CalendarSchema): Promise<void> {
    const header = s.createDiv({ cls: 'sm-astronomical-panel__header' });
    header.createSpan({ cls: 'sm-astronomical-panel__icon', text: '📅' });
    header.createSpan({ text: 'Kommende Ereignisse (30 Tage)', cls: 'sm-astronomical-panel__header-text' });
    const content = s.createDiv({ cls: 'sm-astronomical-panel__content sm-astronomical-panel__timeline' });
    const rangeEnd = advanceTime(c, t, 30, 'day').timestamp;
    const events = await gateway.getAstronomicalEvents(t, rangeEnd);
    if (events.length === 0) {
      content.createDiv({ text: 'Keine astronomischen Ereignisse in den nächsten 30 Tagen', cls: 'sm-astronomical-panel__no-events' });
      return;
    }
    const list = content.createEl('ul', { cls: 'sm-astronomical-panel__timeline-list' });
    for (const event of events.slice(0, 10)) {
      const item = list.createEl('li', { cls: 'sm-astronomical-panel__timeline-item' });
      const date = item.createSpan({ cls: 'sm-astronomical-panel__timeline-date' });
      date.textContent = formatTimestamp(event.timestamp, c.months.find(m => m.id === event.timestamp.monthId)?.name);
      item.createSpan({ cls: 'sm-astronomical-panel__timeline-name', text: event.name });
      if (onEventClick) {
        item.addClass('sm-astronomical-panel__timeline-item--clickable');
        item.addEventListener('click', () => onEventClick(event));
      }
    }
    if (events.length > 10) content.createDiv({ text: '+ ' + (events.length - 10) + ' weitere Ereignisse', cls: 'sm-astronomical-panel__timeline-more' });
  }

  return {
    update: async (timestamp: CalendarTimestamp, calendarSchema: CalendarSchema) => renderPanel(timestamp, calendarSchema),
    destroy: () => {
      collapseState.destroy();
      root.empty();
    },
  };
}
