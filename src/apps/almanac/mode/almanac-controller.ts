/**
 * Almanac Controller
 *
 * Main controller for the Almanac workmode.
 * Manages state, handles user interactions, and updates UI.
 */

import type { App } from 'obsidian';
import type { CalendarSchema } from '../domain/calendar-schema';
import { getMonthById } from '../domain/calendar-schema';
import type { CalendarTimestamp } from '../domain/calendar-timestamp';
import { formatTimestamp } from '../domain/calendar-timestamp';
import type { CalendarEvent } from '../domain/calendar-event';
import { InMemoryCalendarRepository, InMemoryEventRepository } from '../data/in-memory-repository';
import { InMemoryStateGateway, type AdvanceTimeResult } from '../data/in-memory-gateway';
import { gregorianSchema, createSampleEvents, getDefaultCurrentTimestamp } from '../fixtures/gregorian.fixture';

export class AlmanacController {
  private containerEl: HTMLElement | null = null;
  private calendarRepo: InMemoryCalendarRepository;
  private eventRepo: InMemoryEventRepository;
  private gateway: InMemoryStateGateway;
  private recentlyTriggeredEvents: CalendarEvent[] = [];

  constructor(private app: App) {
    // Initialize repositories
    this.calendarRepo = new InMemoryCalendarRepository();
    this.eventRepo = new InMemoryEventRepository();
    this.gateway = new InMemoryStateGateway(this.calendarRepo, this.eventRepo);

    // Seed with test data
    this.calendarRepo.seed([gregorianSchema]);
    this.eventRepo.seed(createSampleEvents(2024));
  }

  async onOpen(container: HTMLElement): Promise<void> {
    this.containerEl = container;
    container.empty();
    container.addClass('almanac-container');

    // Initialize with default state
    await this.gateway.setActiveCalendar(
      gregorianSchema.id,
      getDefaultCurrentTimestamp(2024)
    );

    await this.render();
  }

  async onClose(): Promise<void> {
    this.containerEl = null;
  }

  private async render(): Promise<void> {
    if (!this.containerEl) return;

    this.containerEl.empty();

    const snapshot = await this.gateway.loadSnapshot();

    if (!snapshot.activeCalendar) {
      this.renderEmptyState();
      return;
    }

    this.renderDashboard(
      snapshot.activeCalendar,
      snapshot.currentTimestamp,
      snapshot.upcomingEvents,
      this.recentlyTriggeredEvents
    );
  }

  private renderEmptyState(): void {
    if (!this.containerEl) return;

    const empty = this.containerEl.createDiv({ cls: 'almanac-empty-state' });
    empty.createEl('h2', { text: 'No Active Calendar' });
    empty.createEl('p', { text: 'Please create or select a calendar to begin.' });
  }

  private renderDashboard(
    calendar: CalendarSchema,
    currentTimestamp: CalendarTimestamp | null,
    upcomingEvents: CalendarEvent[],
    triggeredEvents: CalendarEvent[]
  ): void {
    if (!this.containerEl) return;

    // Header
    const header = this.containerEl.createDiv({ cls: 'almanac-header' });
    header.createEl('h1', { text: 'Almanac Dashboard' });
    header.createEl('p', { text: `Calendar: ${calendar.name}`, cls: 'almanac-subtitle' });

    // Current time section
    this.renderCurrentTime(calendar, currentTimestamp);

    // Quick actions
    this.renderQuickActions();

    // Upcoming events
    this.renderUpcomingEvents(calendar, upcomingEvents);
    this.renderTriggeredEvents(calendar, triggeredEvents);
  }

  private renderCurrentTime(calendar: CalendarSchema, timestamp: CalendarTimestamp | null): void {
    if (!this.containerEl || !timestamp) return;

    const section = this.containerEl.createDiv({ cls: 'almanac-section' });
    section.createEl('h2', { text: 'Current Date & Time' });

    const month = getMonthById(calendar, timestamp.monthId);
    const formatted = formatTimestamp(timestamp, month?.name);

    const timeCard = section.createDiv({ cls: 'almanac-time-card' });
    timeCard.createEl('div', { text: formatted, cls: 'almanac-time-display' });
  }

  private renderQuickActions(): void {
    if (!this.containerEl) return;

    const section = this.containerEl.createDiv({ cls: 'almanac-section' });
    section.createEl('h2', { text: 'Quick Actions' });

    const actions = section.createDiv({ cls: 'almanac-actions' });

    // +1 Day button
    const dayBtn = actions.createEl('button', { text: '+1 Day' });
    dayBtn.addEventListener('click', async () => {
      await this.handleAdvanceTime(1, 'day');
    });

    // +1 Hour button
    const hourBtn = actions.createEl('button', { text: '+1 Hour' });
    hourBtn.addEventListener('click', async () => {
      await this.handleAdvanceTime(1, 'hour');
    });

    // +15 Minutes button
    const minuteBtn = actions.createEl('button', { text: '+15 Min' });
    minuteBtn.addEventListener('click', async () => {
      await this.handleAdvanceTime(15, 'minute');
    });
  }

  private renderUpcomingEvents(calendar: CalendarSchema, events: CalendarEvent[]): void {
    if (!this.containerEl) return;

    const section = this.containerEl.createDiv({ cls: 'almanac-section' });
    section.createEl('h2', { text: 'Upcoming Events' });

    if (events.length === 0) {
      section.createEl('p', { text: 'No upcoming events', cls: 'almanac-empty' });
      return;
    }

    this.renderEventList(section, calendar, events);
  }

  private renderTriggeredEvents(calendar: CalendarSchema, events: CalendarEvent[]): void {
    if (!this.containerEl || events.length === 0) return;

    const section = this.containerEl.createDiv({ cls: 'almanac-section' });
    section.createEl('h2', { text: 'Recently Triggered' });

    this.renderEventList(section, calendar, events);
  }

  private renderEventList(section: HTMLElement, calendar: CalendarSchema, events: CalendarEvent[]): void {
    const list = section.createEl('ul', { cls: 'almanac-event-list' });

    events.forEach(event => {
      const item = list.createEl('li', { cls: 'almanac-event-item' });

      const month = getMonthById(calendar, event.date.monthId);
      const timeStr = formatTimestamp(event.date, month?.name);

      item.createEl('strong', { text: event.title });
      item.createEl('span', { text: ` — ${timeStr}`, cls: 'almanac-event-time' });

      if (event.description) {
        item.createEl('div', { text: event.description, cls: 'almanac-event-desc' });
      }
    });
  }

  private async handleAdvanceTime(amount: number, unit: 'day' | 'hour'): Promise<void> {
    try {
      const result: AdvanceTimeResult = await this.gateway.advanceTimeBy(amount, unit);
      this.recentlyTriggeredEvents = result.triggeredEvents;
      await this.render();
    } catch (error) {
      console.error('Failed to advance time:', error);
      // In a real app, show error notification
    }
  }
}
