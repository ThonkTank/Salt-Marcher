// src/apps/almanac/mode/almanac-controller.ts
// Handles rendering and interactions for the Almanac workmode within Obsidian.

/**
 * Almanac Controller
 *
 * Presenter/controller for the Almanac workmode. Hooks the state machine into the
 * Obsidian ItemView host element and renders a lightweight shell for the
 * Dashboard, Manager and Events modes.
 */

import type { App } from 'obsidian';
import type { CalendarSchema } from '../domain/calendar-schema';
import { getMonthById, getMonthIndex } from '../domain/calendar-schema';
import type { CalendarEvent } from '../domain/calendar-event';
import type { CalendarTimestamp } from '../domain/calendar-timestamp';
import { formatTimestamp, createDayTimestamp, createHourTimestamp, createMinuteTimestamp } from '../domain/calendar-timestamp';
import { advanceTime } from '../domain/time-arithmetic';
import {
    InMemoryCalendarRepository,
    InMemoryEventRepository,
    InMemoryPhenomenonRepository,
} from '../data/in-memory-repository';
import { InMemoryStateGateway } from '../data/in-memory-gateway';
import {
    type AlmanacMode,
    type AlmanacState,
    type CalendarViewZoom,
    type EventsViewMode,
    type CalendarManagerViewMode,
} from './contracts';
import { AlmanacStateMachine } from './state-machine';
import {
    gregorianSchema,
    createSampleEvents,
    getDefaultCurrentTimestamp,
} from '../fixtures/gregorian.fixture';
import { createSamplePhenomena } from '../fixtures/phenomena.fixture';

const MODE_COPY: Record<AlmanacMode, { label: string; description: string }> = {
    dashboard: { label: 'Dashboard', description: 'Current date, quick actions and upcoming events' },
    manager: { label: 'Manager', description: 'Manage calendars, zoom levels and defaults' },
    events: { label: 'Events', description: 'Cross-calendar phenomena overview and filters' },
};

const MANAGER_ZOOM_OPTIONS: CalendarViewZoom[] = ['month', 'week', 'day', 'hour'];
const MANAGER_VIEW_OPTIONS: CalendarManagerViewMode[] = ['calendar', 'overview'];
const EVENT_VIEW_OPTIONS: EventsViewMode[] = ['timeline', 'table', 'map'];

export class AlmanacController {
    private readonly calendarRepo: InMemoryCalendarRepository;
    private readonly eventRepo: InMemoryEventRepository;
    private readonly phenomenonRepo: InMemoryPhenomenonRepository;
    private readonly gateway: InMemoryStateGateway;
    private readonly stateMachine: AlmanacStateMachine;

    private containerEl: HTMLElement | null = null;
    private unsubscribe: (() => void) | null = null;
    private currentState: AlmanacState | null = null;
    private showTimeJumpForm = false;

    constructor(private readonly app: App) {
        this.calendarRepo = new InMemoryCalendarRepository();
        this.eventRepo = new InMemoryEventRepository();
        this.eventRepo.bindCalendarRepository(this.calendarRepo);
        this.phenomenonRepo = new InMemoryPhenomenonRepository();
        this.gateway = new InMemoryStateGateway(this.calendarRepo, this.eventRepo, this.phenomenonRepo);
        this.stateMachine = new AlmanacStateMachine(
            this.calendarRepo,
            this.eventRepo,
            this.gateway,
            this.phenomenonRepo,
        );

        // Seed sample data for MVP preview
        this.calendarRepo.seed([
            gregorianSchema,
            {
                id: 'lunar-cycle',
                name: 'Lunar Cycle',
                description: 'Six-month seasonal calendar for travel campaigns',
                daysPerWeek: 6,
                hoursPerDay: 20,
                minutesPerHour: 60,
                minuteStep: 10,
                months: [
                    { id: 'ember', name: 'Ember', length: 30 },
                    { id: 'sleet', name: 'Sleet', length: 30 },
                    { id: 'bloom', name: 'Bloom', length: 30 },
                    { id: 'zenith', name: 'Zenith', length: 30 },
                    { id: 'gale', name: 'Gale', length: 30 },
                    { id: 'dusk', name: 'Dusk', length: 30 },
                ],
                epoch: { year: 1, monthId: 'ember', day: 1 },
                schemaVersion: '1.0.0',
            },
        ]);
        void this.calendarRepo.setGlobalDefault(gregorianSchema.id);
        this.eventRepo.seed(createSampleEvents(2024));
        this.phenomenonRepo.seed(createSamplePhenomena());
    }

    async onOpen(container: HTMLElement): Promise<void> {
        await this.onClose();

        this.containerEl = container;
        container.empty();
        container.addClass('almanac-container');

        // Ensure an initial active calendar exists for demo purposes
        const current = this.gateway.getCurrentState();
        if (!current.activeCalendarId) {
            await this.gateway.setActiveCalendar(
                gregorianSchema.id,
                getDefaultCurrentTimestamp(2024),
            );
        }

        this.unsubscribe = this.stateMachine.subscribe(state => {
            this.currentState = state;
            this.render(state);
        });

        await this.stateMachine.dispatch({ type: 'INIT_ALMANAC' });
    }

    async onClose(): Promise<void> {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.containerEl = null;
    }

    private render(state: AlmanacState): void {
        if (!this.containerEl) return;

        this.containerEl.empty();
        const shell = this.containerEl.createDiv({ cls: 'almanac-shell' });

        const header = shell.createDiv({ cls: 'almanac-shell__header' });
        this.renderTitle(header, state);
        this.renderModeSwitcher(header, state);
        this.renderStatusBar(header, state);

        if (state.almanacUiState.error) {
            const errorBanner = shell.createDiv({ cls: 'almanac-shell__error' });
            errorBanner.setText(state.almanacUiState.error);
        }

        if (state.almanacUiState.isLoading) {
            const loader = shell.createDiv({ cls: 'almanac-shell__loader' });
            loader.setText('Loading…');
        }

        const content = shell.createDiv({ cls: 'almanac-shell__content' });
        switch (state.almanacUiState.mode) {
            case 'dashboard':
                this.renderDashboard(content, state);
                break;
            case 'manager':
                this.renderManager(content, state);
                break;
            case 'events':
                this.renderEvents(content, state);
                break;
        }
    }

    private renderTitle(host: HTMLElement, state: AlmanacState): void {
        const titleRow = host.createDiv({ cls: 'almanac-shell__title-row' });
        titleRow.createEl('h1', { text: 'Almanac' });

        const activeCalendar = this.getActiveCalendar(state);
        const subtitle = titleRow.createDiv({ cls: 'almanac-shell__subtitle' });
        if (activeCalendar) {
            const isDefault = activeCalendar.id === state.calendarState.defaultCalendarId;
            subtitle.setText(`Active calendar: ${activeCalendar.name}${isDefault ? ' (Default)' : ''}`);
        } else {
            subtitle.setText('No calendar selected');
        }

        const controls = titleRow.createDiv({ cls: 'almanac-shell__controls' });
        this.renderCalendarSelector(controls, state);
    }

    private renderCalendarSelector(host: HTMLElement, state: AlmanacState): void {
        if (state.calendarState.calendars.length === 0) {
            host.createEl('span', { text: 'No calendars available' });
            return;
        }

        const select = host.createEl('select', { cls: 'almanac-calendar-select' });
        select.disabled = state.calendarState.isPersisting || state.almanacUiState.isLoading;

        state.calendarState.calendars.forEach(schema => {
            const option = select.createEl('option', {
                text: this.describeCalendarOption(schema, state),
                attr: { value: schema.id },
            });
            if (schema.id === state.calendarState.activeCalendarId) {
                option.selected = true;
            }
        });

        select.addEventListener('change', event => {
            const target = event.target as HTMLSelectElement;
            if (!target.value) return;
            this.runDispatch({ type: 'CALENDAR_SELECT_REQUESTED', calendarId: target.value });
        });

        const activeCalendarId = state.calendarState.activeCalendarId;
        if (activeCalendarId) {
            const defaultButton = host.createEl('button', {
                text: 'Set as default',
                cls: 'almanac-control-button',
            });
            const isDefault = activeCalendarId === state.calendarState.defaultCalendarId;
            defaultButton.disabled = isDefault || state.calendarState.isPersisting;
            if (isDefault) {
                defaultButton.setText('Default calendar');
                defaultButton.disabled = true;
            } else {
                defaultButton.addEventListener('click', () => {
                    this.runDispatch({ type: 'CALENDAR_DEFAULT_SET_REQUESTED', calendarId: activeCalendarId });
                });
            }
        }
    }

    private describeCalendarOption(schema: CalendarSchema, state: AlmanacState): string {
        const markers: string[] = [];
        if (schema.id === state.calendarState.activeCalendarId) markers.push('active');
        if (schema.id === state.calendarState.defaultCalendarId || schema.isDefaultGlobal) markers.push('default');
        const suffix = markers.length ? ` (${markers.join(', ')})` : '';
        return `${schema.name}${suffix}`;
    }

    private renderModeSwitcher(host: HTMLElement, state: AlmanacState): void {
        const switcher = host.createDiv({ cls: 'almanac-mode-switcher' });
        (['dashboard', 'manager', 'events'] as AlmanacMode[]).forEach(mode => {
            const entry = MODE_COPY[mode];
            const button = switcher.createEl('button', {
                text: entry.label,
                cls: 'almanac-mode-switcher__item',
            });
            button.setAttribute('title', entry.description);
            button.classList.toggle('is-active', state.almanacUiState.mode === mode);
            button.addEventListener('click', () => this.runDispatch({ type: 'ALMANAC_MODE_SELECTED', mode }));
        });
    }

    private renderStatusBar(host: HTMLElement, state: AlmanacState): void {
        const statusContainer = host.createDiv({ cls: 'almanac-shell__status' });
        if (state.almanacUiState.isLoading) {
            statusContainer.addClass('is-loading');
            statusContainer.setText('Loading data…');
            return;
        }

        const summary = state.almanacUiState.statusSummary;
        const tokens: string[] = [];
        if (state.calendarState.isPersisting) tokens.push('Saving…');
        if (summary?.zoomLabel) tokens.push(summary.zoomLabel);
        if (summary?.filterCount !== undefined) tokens.push(`Filters: ${summary.filterCount}`);
        if (tokens.length === 0) tokens.push('Ready');

        statusContainer.setText(tokens.join(' • '));
    }

    private renderDashboard(host: HTMLElement, state: AlmanacState): void {
        const calendar = this.getActiveCalendar(state);
        if (!calendar) {
            host.createEl('p', {
                text: 'No calendars available. Open the Manager to create one.',
                cls: 'almanac-empty',
            });
            return;
        }

        const currentTimestamp = state.calendarState.currentTimestamp;
        const content = host.createDiv({ cls: 'almanac-dashboard' });

        const currentSection = content.createDiv({ cls: 'almanac-section' });
        currentSection.createEl('h2', { text: 'Current Date & Time' });
        if (currentTimestamp) {
            const formatted = this.formatCalendarTimestamp(calendar, currentTimestamp);
            currentSection.createDiv({ cls: 'almanac-time-card', text: formatted });
        } else {
            currentSection.createEl('p', { text: 'No current timestamp available.' });
        }

        this.renderQuickActions(content, state);
        this.renderUpcomingEvents(content, calendar, state.calendarState.upcomingEvents);
        this.renderTriggeredEvents(content, calendar, state.calendarState.triggeredEvents);
        this.renderUpcomingPhenomena(content, calendar, state.calendarState.upcomingPhenomena);
    }

    private renderQuickActions(host: HTMLElement, state: AlmanacState): void {
        const section = host.createDiv({ cls: 'almanac-section' });
        section.createEl('h2', { text: 'Quick Actions' });
        const buttons = section.createDiv({ cls: 'almanac-actions' });

        const createButton = (label: string, amount: number, unit: 'day' | 'hour' | 'minute') => {
            const btn = buttons.createEl('button', { text: label });
            btn.disabled = state.calendarState.isPersisting || state.almanacUiState.isLoading;
            btn.addEventListener('click', () => this.runDispatch({
                type: 'TIME_ADVANCE_REQUESTED',
                amount,
                unit,
            }));
        };

        createButton('+1 Day', 1, 'day');
        createButton('+1 Hour', 1, 'hour');
        createButton('+15 Min', 15, 'minute');

        const advancedBtn = buttons.createEl('button', { text: 'Set Date & Time' });
        advancedBtn.disabled = state.almanacUiState.isLoading;
        advancedBtn.addEventListener('click', () => {
            this.showTimeJumpForm = !this.showTimeJumpForm;
            if (this.currentState) {
                this.render(this.currentState);
            }
        });

        if (this.showTimeJumpForm) {
            this.renderTimeJumpForm(section, state);
        }
    }

    private renderTimeJumpForm(section: HTMLElement, state: AlmanacState): void {
        const calendar = this.getActiveCalendar(state);
        if (!calendar) {
            section.createEl('p', { text: 'No calendar available for time jump.', cls: 'almanac-empty' });
            return;
        }

        const current = state.calendarState.currentTimestamp
            ?? this.getFallbackTimestamp(state)
            ?? createDayTimestamp(calendar.id, calendar.epoch.year, calendar.epoch.monthId, calendar.epoch.day);
        const timeDefinition = state.calendarState.timeDefinition;

        const form = section.createEl('form', { cls: 'almanac-timejump-form' });

        const row = form.createDiv({ cls: 'almanac-timejump-row' });

        const yearInput = row.createEl('input', {
            attr: { type: 'number', name: 'year', value: String(current.year) },
        }) as HTMLInputElement;

        const monthSelect = row.createEl('select', { attr: { name: 'month' } }) as HTMLSelectElement;
        calendar.months.forEach(month => {
            const option = monthSelect.createEl('option', { value: month.id, text: month.name });
            if (month.id === current.monthId) option.selected = true;
        });

        const dayInput = row.createEl('input', {
            attr: { type: 'number', name: 'day', value: String(current.day), min: '1', max: String(this.getMonthLength(calendar, current.monthId)) },
        }) as HTMLInputElement;

        const timeRow = form.createDiv({ cls: 'almanac-timejump-row' });
        const hourInput = timeRow.createEl('input', {
            attr: { type: 'number', name: 'hour', value: String(current.hour ?? 0), min: '0', max: String((timeDefinition?.hoursPerDay ?? 24) - 1) },
        }) as HTMLInputElement;

        const minuteInput = timeRow.createEl('input', {
            attr: { type: 'number', name: 'minute', value: String(current.minute ?? 0), min: '0', max: String((timeDefinition?.minutesPerHour ?? 60) - 1) },
        }) as HTMLInputElement;

        const note = form.createDiv({ cls: 'almanac-timejump-note' });
        note.setText('Enter a target date/time for the active calendar. Minute precision respects the configured schema.');

        const buildTargetTimestamp = (): CalendarTimestamp | null => {
            const year = Number(yearInput.value);
            const monthId = monthSelect.value || calendar.months[0]?.id;
            const dayValue = Number(dayInput.value);
            if (!monthId || Number.isNaN(year) || Number.isNaN(dayValue) || year <= 0) {
                return null;
            }
            const monthLength = this.getMonthLength(calendar, monthId);
            const clampedDay = Math.max(1, Math.min(dayValue, monthLength));

            if (timeDefinition) {
                const hoursPerDay = timeDefinition.hoursPerDay ?? 24;
                const minutesPerHour = timeDefinition.minutesPerHour ?? 60;
                const minuteStep = timeDefinition.minuteStep ?? 1;
                const hourValue = Number(hourInput.value ?? 0);
                const minuteValue = Number(minuteInput.value ?? 0);
                const clampedHour = Math.max(0, Math.min(isNaN(hourValue) ? 0 : hourValue, hoursPerDay - 1));
                const clampedMinuteRaw = Math.max(0, Math.min(isNaN(minuteValue) ? 0 : minuteValue, minutesPerHour - 1));
                const clampedMinute = Math.floor(clampedMinuteRaw / minuteStep) * minuteStep;
                return createMinuteTimestamp(calendar.id, year, monthId, clampedDay, clampedHour, clampedMinute);
            }

            const hourValue = Number(hourInput.value ?? 0);
            if (!Number.isNaN(hourValue)) {
                const clampedHour = Math.max(0, Math.min(hourValue, 23));
                return createHourTimestamp(calendar.id, year, monthId, clampedDay, clampedHour);
            }

            return createDayTimestamp(calendar.id, year, monthId, clampedDay);
        };

        const actions = form.createDiv({ cls: 'almanac-timejump-actions' });
        const previewBtn = actions.createEl('button', { text: 'Preview', attr: { type: 'button' } });
        previewBtn.disabled = state.almanacUiState.isLoading;
        const applyBtn = actions.createEl('button', { text: 'Apply', attr: { type: 'submit' } });
        applyBtn.disabled = state.almanacUiState.isLoading;
        const cancelBtn = actions.createEl('button', { text: 'Cancel', attr: { type: 'button' } });
        cancelBtn.addEventListener('click', () => {
            this.showTimeJumpForm = false;
            if (this.currentState) {
                this.render(this.currentState);
            }
        });

        previewBtn.addEventListener('click', async () => {
            const target = buildTargetTimestamp();
            if (!target) {
                console.warn('Invalid preview target supplied');
                return;
            }
            await this.runDispatch({ type: 'TIME_JUMP_PREVIEW_REQUESTED', timestamp: target });
        });

        form.addEventListener('submit', event => {
            event.preventDefault();

            const year = Number(yearInput.value);
            const monthId = monthSelect.value || calendar.months[0]?.id;
            const day = Number(dayInput.value);
            const hour = Number(hourInput.value);
            const minute = Number(minuteInput.value);

            if (!monthId || Number.isNaN(year) || Number.isNaN(day) || year <= 0 || day <= 0) {
                console.warn('Invalid date supplied');
                return;
            }

            const monthLength = this.getMonthLength(calendar, monthId);
            const clampedDay = Math.max(1, Math.min(day, monthLength));
            let target: CalendarTimestamp;

            if (timeDefinition) {
                const clampedHour = Math.max(0, Math.min(hour, timeDefinition.hoursPerDay - 1));
                const clampedMinute = Math.max(0, Math.min(minute, timeDefinition.minutesPerHour - 1));
                target = createMinuteTimestamp(calendar.id, year, monthId, clampedDay, clampedHour, clampedMinute);
            } else if (!Number.isNaN(hour)) {
                const clampedHour = Math.max(0, Math.min(hour, 23));
                target = createHourTimestamp(calendar.id, year, monthId, clampedDay, clampedHour);
            } else {
                target = createDayTimestamp(calendar.id, year, monthId, clampedDay);
            }

            const dispatchResult = this.runDispatch({ type: 'TIME_JUMP_REQUESTED', timestamp: target });
            dispatchResult?.finally(() => {
                this.showTimeJumpForm = false;
                if (this.currentState) {
                    this.render(this.currentState);
                }
            });
        });

        if (state.managerUiState.jumpPreview.length > 0) {
            const previewBox = form.createDiv({ cls: 'almanac-timejump-warnings' });
            previewBox.createEl('strong', { text: 'Events affected:' });
            const list = previewBox.createEl('ul');
            state.managerUiState.jumpPreview.forEach(event => {
                const item = list.createEl('li');
                item.setText(`${event.title} — ${this.formatCalendarTimestamp(calendar, event.date)}`);
            });
        }
    }

    private getMonthLength(calendar: CalendarSchema, monthId: string): number {
        const month = calendar.months.find(m => m.id === monthId);
        return month?.length ?? calendar.months[0]?.length ?? 30;
    }

    private renderUpcomingEvents(host: HTMLElement, calendar: CalendarSchema, events: CalendarEvent[]): void {
        const section = host.createDiv({ cls: 'almanac-section' });
        section.createEl('h2', { text: 'Upcoming Events' });
        if (events.length === 0) {
            section.createEl('p', { text: 'No upcoming events', cls: 'almanac-empty' });
            return;
        }
        this.renderEventList(section, calendar, events);
    }

    private renderTriggeredEvents(host: HTMLElement, calendar: CalendarSchema, events: CalendarEvent[]): void {
        if (events.length === 0) return;
        const section = host.createDiv({ cls: 'almanac-section' });
        section.createEl('h2', { text: 'Recently Triggered' });
        this.renderEventList(section, calendar, events);
    }

    private renderUpcomingPhenomena(host: HTMLElement, calendar: CalendarSchema, phenomena: AlmanacState['calendarState']['upcomingPhenomena']): void {
        if (phenomena.length === 0) {
            return;
        }

        const section = host.createDiv({ cls: 'almanac-section' });
        section.createEl('h2', { text: 'Upcoming Phenomena' });

        const list = section.createEl('ul', { cls: 'almanac-event-list' });
        phenomena.forEach(occurrence => {
            const item = list.createEl('li', { cls: 'almanac-event-item' });
            item.createEl('strong', { text: occurrence.name });
            item.createEl('span', {
                text: ` — ${formatTimestamp(occurrence.timestamp, getMonthById(calendar, occurrence.timestamp.monthId)?.name ?? occurrence.timestamp.monthId)} (${occurrence.category})`,
            });
        });
    }

    private renderEventList(host: HTMLElement, calendar: CalendarSchema, events: CalendarEvent[]): void {
        const list = host.createEl('ul', { cls: 'almanac-event-list' });
        events.forEach(event => {
            const item = list.createEl('li', { cls: 'almanac-event-item' });
            item.createEl('strong', { text: event.title });
            item.createEl('span', {
                text: ` — ${this.formatCalendarTimestamp(calendar, event.date)}`,
                cls: 'almanac-event-time',
            });
            if (event.description) {
                item.createEl('div', { text: event.description, cls: 'almanac-event-desc' });
            }
        });
    }

    private renderManager(host: HTMLElement, state: AlmanacState): void {
        const section = host.createDiv({ cls: 'almanac-manager' });
        const creationSection = section.createDiv({ cls: 'almanac-section almanac-manager__create' });
        this.renderCalendarCreateForm(creationSection, state);
        const header = section.createDiv({ cls: 'almanac-manager__controls' });

        const modeGroup = header.createDiv({ cls: 'almanac-toggle-group' });
        MANAGER_VIEW_OPTIONS.forEach(option => {
            const btn = modeGroup.createEl('button', { text: option === 'calendar' ? 'Calendar' : 'Overview' });
            btn.classList.toggle('is-active', state.managerUiState.viewMode === option);
            btn.addEventListener('click', () => this.runDispatch({
                type: 'MANAGER_VIEW_MODE_CHANGED',
                viewMode: option,
            }));
        });

        const zoomGroup = header.createDiv({ cls: 'almanac-toggle-group' });
        MANAGER_ZOOM_OPTIONS.forEach(option => {
            const label = option.charAt(0).toUpperCase() + option.slice(1);
            const btn = zoomGroup.createEl('button', { text: label });
            btn.classList.toggle('is-active', state.managerUiState.zoom === option);
            btn.addEventListener('click', () => this.runDispatch({
                type: 'MANAGER_ZOOM_CHANGED',
                zoom: option,
            }));
        });

        if (state.managerUiState.error) {
            const err = section.createDiv({ cls: 'almanac-section almanac-section--error' });
            err.setText(state.managerUiState.error);
        }

        if (state.managerUiState.viewMode === 'overview') {
            this.renderCalendarOverview(section, state);
        } else {
            this.renderManagerCalendarView(section, state);
        }
    }

    private renderCalendarCreateForm(host: HTMLElement, state: AlmanacState): void {
        host.createEl('h2', { text: 'Create calendar' });
        host.createEl('p', {
            text: 'Define a quick calendar skeleton. You can refine months and events later in the manager.',
            cls: 'almanac-section__helper',
        });

        if (state.managerUiState.createErrors.length > 0) {
            const errorList = host.createEl('ul', { cls: 'almanac-form-errors' });
            state.managerUiState.createErrors.forEach(message => {
                errorList.createEl('li', { text: message });
            });
        }

        const form = host.createEl('form', { cls: 'almanac-create-form' });
        form.addEventListener('submit', event => {
            event.preventDefault();
            void this.runDispatch({ type: 'CALENDAR_CREATE_REQUESTED' });
        });

        const grid = form.createDiv({ cls: 'almanac-create-form__grid' });
        const { createDraft, isCreating } = state.managerUiState;
        const isDisabled = isCreating || state.calendarState.isPersisting;

        const buildInput = (
            field: keyof typeof createDraft,
            label: string,
            options: { type?: string; min?: string; step?: string } = {},
        ): HTMLInputElement => {
            const wrapper = grid.createDiv({ cls: 'almanac-form-field' });
            wrapper.createEl('label', { text: label, attr: { for: `almanac-${field}` } });
            const input = wrapper.createEl('input', {
                attr: {
                    id: `almanac-${field}`,
                    name: `almanac-${field}`,
                    type: options.type ?? 'text',
                    value: createDraft[field],
                    ...(options.min ? { min: options.min } : {}),
                    ...(options.step ? { step: options.step } : {}),
                },
            }) as HTMLInputElement;
            input.disabled = isDisabled;
            input.addEventListener('input', () => {
                void this.runDispatch({
                    type: 'MANAGER_CREATE_FORM_UPDATED',
                    field: field,
                    value: input.value,
                });
            });
            return input;
        };

        buildInput('id', 'Identifier');
        buildInput('name', 'Name');

        const descriptionWrapper = grid.createDiv({ cls: 'almanac-form-field almanac-form-field--wide' });
        descriptionWrapper.createEl('label', { text: 'Description', attr: { for: 'almanac-description' } });
        const description = descriptionWrapper.createEl('textarea', {
            attr: { id: 'almanac-description', rows: '2' },
            text: createDraft.description,
        }) as HTMLTextAreaElement;
        description.disabled = isDisabled;
        description.addEventListener('input', () => {
            void this.runDispatch({
                type: 'MANAGER_CREATE_FORM_UPDATED',
                field: 'description',
                value: description.value,
            });
        });

        buildInput('daysPerWeek', 'Days per week', { type: 'number', min: '1', step: '1' });
        buildInput('monthCount', 'Months per year', { type: 'number', min: '1', step: '1' });
        buildInput('monthLength', 'Days per month', { type: 'number', min: '1', step: '1' });
        buildInput('hoursPerDay', 'Hours per day', { type: 'number', min: '1', step: '1' });
        buildInput('minutesPerHour', 'Minutes per hour', { type: 'number', min: '1', step: '1' });
        buildInput('minuteStep', 'Minute step', { type: 'number', min: '1', step: '1' });
        buildInput('epochYear', 'Epoch year', { type: 'number', min: '1', step: '1' });
        buildInput('epochDay', 'Epoch day', { type: 'number', min: '1', step: '1' });

        const actions = form.createDiv({ cls: 'almanac-create-form__actions' });
        const submit = actions.createEl('button', {
            text: isCreating ? 'Creating…' : 'Create calendar',
            attr: { type: 'submit' },
        });
        submit.disabled = isDisabled;
    }

    private renderCalendarOverview(host: HTMLElement, state: AlmanacState): void {
        const table = host.createEl('table', { cls: 'almanac-table' });
        const thead = table.createEl('thead');
        const headRow = thead.createEl('tr');
        const selectAllHeader = headRow.createEl('th');
        const selectAll = selectAllHeader.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement;
        const totalCalendars = state.calendarState.calendars.length;
        const selectedCount = state.managerUiState.selection.length;
        selectAll.indeterminate = selectedCount > 0 && selectedCount < totalCalendars;
        selectAll.checked = selectedCount > 0 && selectedCount === totalCalendars;
        selectAll.addEventListener('change', () => {
            const nextSelection = selectAll.checked
                ? state.calendarState.calendars.map(schema => schema.id)
                : [];
            this.runDispatch({ type: 'MANAGER_SELECTION_CHANGED', selection: nextSelection });
        });

        ['Name', 'Identifier', 'Default', 'Months', 'Actions'].forEach(label => headRow.createEl('th', { text: label }));

        const body = table.createEl('tbody');
        if (state.calendarState.calendars.length === 0) {
            const row = body.createEl('tr');
            const cell = row.createEl('td', { text: 'No calendars registered', cls: 'almanac-empty' });
            cell.setAttr('colspan', '6');
            return;
        }

        state.calendarState.calendars.forEach(schema => {
            const row = body.createEl('tr');
            const isActive = schema.id === state.calendarState.activeCalendarId;
            if (isActive) row.addClass('is-active');

            const selectCell = row.createEl('td', { cls: 'almanac-row-select-cell' });
            const checkboxLabel = selectCell.createEl('label', { cls: 'almanac-row-select' });
            const checkbox = checkboxLabel.createEl('input', {
                attr: { type: 'checkbox', value: schema.id },
            }) as HTMLInputElement;
            checkbox.checked = state.managerUiState.selection.includes(schema.id);
            checkbox.addEventListener('change', () => {
                const currentSelection = this.currentState?.managerUiState.selection ?? [];
                const nextSelection = checkbox.checked
                    ? [...currentSelection, schema.id]
                    : currentSelection.filter(id => id !== schema.id);
                this.runDispatch({ type: 'MANAGER_SELECTION_CHANGED', selection: nextSelection });
            });
            checkboxLabel.createEl('span', { text: 'Select' });

            const nameCell = row.createEl('td', { cls: 'almanac-table__name-cell' });
            nameCell.createDiv({ text: schema.name, cls: 'almanac-table__name' });
            if (schema.description) {
                nameCell.createDiv({ text: schema.description, cls: 'almanac-table__description' });
            }
            row.createEl('td', { text: schema.id });

            const defaultCell = row.createEl('td');
            const isDefault = schema.id === state.calendarState.defaultCalendarId || schema.isDefaultGlobal;
            defaultCell.setText(isDefault ? 'Default' : '—');

            row.createEl('td', { text: String(schema.months.length) });

            const actions = row.createEl('td');
            const selectBtn = actions.createEl('button', { text: isActive ? 'Active' : 'Activate' });
            selectBtn.disabled = isActive || state.calendarState.isPersisting;
            if (!isActive) {
                selectBtn.addEventListener('click', () => {
                    this.runDispatch({ type: 'CALENDAR_SELECT_REQUESTED', calendarId: schema.id });
                });
            }

            const defaultBtn = actions.createEl('button', { text: 'Set Default' });
            defaultBtn.disabled = isDefault || state.calendarState.isPersisting;
            if (isDefault) {
                defaultBtn.setText('Default');
            } else {
                defaultBtn.addEventListener('click', () => {
                    this.runDispatch({ type: 'CALENDAR_DEFAULT_SET_REQUESTED', calendarId: schema.id });
                });
            }
        });
    }

    private renderManagerCalendarView(host: HTMLElement, state: AlmanacState): void {
        const calendar = this.getActiveCalendar(state);
        if (!calendar) {
            host.createEl('p', { text: 'No calendar selected.', cls: 'almanac-empty' });
            return;
        }

        const anchor = state.managerUiState.anchorTimestamp
            ?? state.calendarState.currentTimestamp
            ?? createDayTimestamp(calendar.id, calendar.epoch.year, calendar.epoch.monthId, calendar.epoch.day);
        const zoom = state.managerUiState.zoom;

        const navBar = host.createDiv({ cls: 'almanac-calendar-nav' });
        const prevBtn = navBar.createEl('button', { text: 'Previous' });
        prevBtn.disabled = state.almanacUiState.isLoading;
        prevBtn.addEventListener('click', () => this.runDispatch({ type: 'MANAGER_NAVIGATION_REQUESTED', direction: 'prev' }));

        const todayBtn = navBar.createEl('button', { text: 'Today' });
        todayBtn.disabled = state.almanacUiState.isLoading;
        todayBtn.addEventListener('click', () => this.runDispatch({ type: 'MANAGER_NAVIGATION_REQUESTED', direction: 'today' }));

        const nextBtn = navBar.createEl('button', { text: 'Next' });
        nextBtn.disabled = state.almanacUiState.isLoading;
        nextBtn.addEventListener('click', () => this.runDispatch({ type: 'MANAGER_NAVIGATION_REQUESTED', direction: 'next' }));

        if (state.managerUiState.selection.length > 0) {
            const selectionSummary = navBar.createDiv({ cls: 'almanac-calendar-nav__selection' });
            selectionSummary.setText(`${state.managerUiState.selection.length} selected`);
        }

        navBar.createEl('span', {
            text: this.describeAnchorLabel(anchor, zoom, calendar),
            cls: 'almanac-calendar-nav__label',
        });

        const container = host.createDiv({ cls: 'almanac-calendar-view' });
        switch (zoom) {
            case 'month':
                this.renderMonthGrid(container, calendar, anchor, state);
                break;
            case 'week':
                this.renderWeekView(container, calendar, anchor, state);
                break;
            case 'day':
                this.renderDayView(container, calendar, anchor, state);
                break;
            case 'hour':
                this.renderHourView(container, calendar, anchor, state);
                break;
        }
    }

    private describeAnchorLabel(anchor: CalendarTimestamp, zoom: CalendarViewZoom, calendar: CalendarSchema): string {
        const monthName = getMonthById(calendar, anchor.monthId)?.name ?? anchor.monthId;
        switch (zoom) {
            case 'month':
                return `${monthName} ${anchor.year}`;
            case 'week':
                return `Week of ${formatTimestamp(anchor, monthName)}`;
            case 'day':
                return `Day view – ${formatTimestamp(anchor, monthName)}`;
            case 'hour':
                return `Hour view – ${formatTimestamp(anchor, monthName)}`;
            default:
                return formatTimestamp(anchor, monthName);
        }
    }

    private renderMonthGrid(
        container: HTMLElement,
        calendar: CalendarSchema,
        anchor: CalendarTimestamp,
        state: AlmanacState,
    ): void {
        const table = container.createEl('table', { cls: 'almanac-month-grid' });
        const headerRow = table.createEl('thead').createEl('tr');
        for (let i = 0; i < calendar.daysPerWeek; i++) {
            headerRow.createEl('th', { text: `Day ${i + 1}` });
        }

        const body = table.createEl('tbody');
        const monthIndex = getMonthIndex(calendar, anchor.monthId);
        const month = monthIndex >= 0 ? calendar.months[monthIndex] : calendar.months[0];
        const weeks: Array<Array<number | null>> = [];
        let currentWeek: Array<number | null> = new Array(calendar.daysPerWeek).fill(null);
        for (let day = 1; day <= month.length; day++) {
            const slot = (day - 1) % calendar.daysPerWeek;
            currentWeek[slot] = day;
            if (slot === calendar.daysPerWeek - 1 || day === month.length) {
                weeks.push(currentWeek);
                currentWeek = new Array(calendar.daysPerWeek).fill(null);
            }
        }

        const eventsByDay = this.groupEventsByDay(state, calendar.id, anchor.year, month.id);

        weeks.forEach(week => {
            const row = body.createEl('tr');
            week.forEach(dayNumber => {
                const cell = row.createEl('td', { cls: 'almanac-month-grid__cell' });
                if (dayNumber === null) {
                    cell.addClass('is-empty');
                    return;
                }
                const dayHeader = cell.createDiv({ text: String(dayNumber), cls: 'almanac-month-grid__day' });
                if (dayNumber === anchor.day) {
                    cell.addClass('is-anchor');
                    dayHeader.addClass('is-anchor');
                }
                const events = eventsByDay.get(dayNumber) ?? [];
                events.slice(0, 2).forEach(event => {
                    cell.createDiv({ text: `${this.formatEventTime(event)} • ${event.title}`, cls: 'almanac-month-grid__event' });
                });
                if (events.length > 2) {
                    cell.createDiv({ text: `+${events.length - 2} more`, cls: 'almanac-month-grid__more' });
                }
            });
        });
    }

    private renderWeekView(
        container: HTMLElement,
        calendar: CalendarSchema,
        anchor: CalendarTimestamp,
        state: AlmanacState,
    ): void {
        const list = container.createDiv({ cls: 'almanac-week-view' });
        for (let offset = 0; offset < calendar.daysPerWeek; offset++) {
            const dayTimestamp = this.getOffsetTimestamp(calendar, anchor, offset);
            const dayBox = list.createDiv({ cls: 'almanac-week-view__day' });
            const monthName = getMonthById(calendar, dayTimestamp.monthId)?.name ?? dayTimestamp.monthId;
            dayBox.createDiv({ text: formatTimestamp(dayTimestamp, monthName), cls: 'almanac-week-view__heading' });
            const events = this.getEventsForDate(state, calendar.id, dayTimestamp.year, dayTimestamp.monthId, dayTimestamp.day);
            if (events.length === 0) {
                dayBox.createDiv({ text: 'No events', cls: 'almanac-week-view__empty' });
                continue;
            }
            events.forEach(event => {
                dayBox.createDiv({ text: `${this.formatEventTime(event)} • ${event.title}`, cls: 'almanac-week-view__event' });
            });
        }
    }

    private renderDayView(
        container: HTMLElement,
        calendar: CalendarSchema,
        anchor: CalendarTimestamp,
        state: AlmanacState,
    ): void {
        const events = this.getEventsForDate(state, calendar.id, anchor.year, anchor.monthId, anchor.day);
        const list = container.createDiv({ cls: 'almanac-day-view' });
        list.createDiv({ text: `Events for ${formatTimestamp(anchor, getMonthById(calendar, anchor.monthId)?.name)}`, cls: 'almanac-day-view__heading' });
        if (events.length === 0) {
            list.createDiv({ text: 'No events scheduled.', cls: 'almanac-day-view__empty' });
            return;
        }
        events
            .slice()
            .sort((a, b) => (a.date.hour ?? 0) - (b.date.hour ?? 0))
            .forEach(event => {
                list.createDiv({ text: `${this.formatEventTime(event)} • ${event.title}`, cls: 'almanac-day-view__event' });
            });
    }

    private renderHourView(
        container: HTMLElement,
        calendar: CalendarSchema,
        anchor: CalendarTimestamp,
        state: AlmanacState,
    ): void {
        const events = this.getEventsForDate(state, calendar.id, anchor.year, anchor.monthId, anchor.day);
        const segments = [0, 6, 12, 18];
        const view = container.createDiv({ cls: 'almanac-hour-view' });
        segments.forEach(startHour => {
            const endHour = startHour + 5;
            const bucket = view.createDiv({ cls: 'almanac-hour-view__segment' });
            bucket.createDiv({ text: `${String(startHour).padStart(2, '0')}:00 – ${String(endHour + 1).padStart(2, '0')}:00`, cls: 'almanac-hour-view__segment-heading' });
            const segmentEvents = events.filter(event => {
                const hour = event.date.hour ?? 0;
                return hour >= startHour && hour <= endHour;
            });
            if (segmentEvents.length === 0) {
                bucket.createDiv({ text: '—', cls: 'almanac-hour-view__empty' });
                return;
            }
            segmentEvents.forEach(event => {
                bucket.createDiv({ text: `${this.formatEventTime(event)} • ${event.title}`, cls: 'almanac-hour-view__event' });
            });
        });
    }

    private getOffsetTimestamp(calendar: CalendarSchema, anchor: CalendarTimestamp, offsetDays: number): CalendarTimestamp {
        if (offsetDays === 0) {
            return anchor;
        }
        return advanceTime(calendar, anchor, offsetDays, 'day').timestamp;
    }

    private groupEventsByDay(
        state: AlmanacState,
        calendarId: string,
        year: number,
        monthId: string,
    ): Map<number, CalendarEvent[]> {
        const events = [...state.calendarState.upcomingEvents, ...state.calendarState.triggeredEvents];
        const map = new Map<number, CalendarEvent[]>();
        events.forEach(event => {
            if (event.date.calendarId !== calendarId) return;
            if (event.date.year !== year) return;
            if (event.date.monthId !== monthId) return;
            const day = event.date.day;
            if (!map.has(day)) {
                map.set(day, []);
            }
            map.get(day)!.push(event);
        });
        return map;
    }

    private getEventsForDate(
        state: AlmanacState,
        calendarId: string,
        year: number,
        monthId: string,
        day: number,
    ): CalendarEvent[] {
        const pool = [...state.calendarState.upcomingEvents, ...state.calendarState.triggeredEvents];
        return pool.filter(event =>
            event.date.calendarId === calendarId &&
            event.date.year === year &&
            event.date.monthId === monthId &&
            event.date.day === day,
        );
    }

    private formatEventTime(event: CalendarEvent): string {
        if (event.date.hour === undefined) {
            return 'All day';
        }
        const hour = String(event.date.hour).padStart(2, '0');
        const minute = String(event.date.minute ?? 0).padStart(2, '0');
        return `${hour}:${minute}`;
    }

    private getFallbackTimestamp(state: AlmanacState): CalendarTimestamp | null {
        if (state.managerUiState.anchorTimestamp) {
            return state.managerUiState.anchorTimestamp;
        }
        if (state.calendarState.currentTimestamp) {
            return state.calendarState.currentTimestamp;
        }
        const calendar = this.getActiveCalendar(state) ?? state.calendarState.calendars[0] ?? null;
        if (!calendar) {
            return null;
        }
        const firstMonth = calendar.months[0] ?? { id: calendar.epoch.monthId, length: calendar.months[0]?.length ?? 30 };
        return createDayTimestamp(calendar.id, calendar.epoch.year, firstMonth.id, calendar.epoch.day);
    }

    private renderEvents(host: HTMLElement, state: AlmanacState): void {
        const section = host.createDiv({ cls: 'almanac-events' });
        const controls = section.createDiv({ cls: 'almanac-toggle-group' });
        EVENT_VIEW_OPTIONS.forEach(option => {
            const label = option.charAt(0).toUpperCase() + option.slice(1);
            const btn = controls.createEl('button', { text: label });
            btn.classList.toggle('is-active', state.eventsUiState.viewMode === option);
            btn.addEventListener('click', () => this.runDispatch({
                type: 'EVENTS_VIEW_MODE_CHANGED',
                viewMode: option,
            }));
        });

        this.renderEventsFilters(section, state);

        if (state.eventsUiState.error) {
            const err = section.createDiv({ cls: 'almanac-section almanac-section--error' });
            err.setText(state.eventsUiState.error);
        }

        const contentSection = section.createDiv({ cls: 'almanac-section' });
        contentSection.createEl('h2', { text: this.describeEventsViewHeading(state.eventsUiState.viewMode) });

        if (!state.eventsUiState.phenomena.length) {
            contentSection.createEl('p', { text: 'No phenomena match the current filters.', cls: 'almanac-empty' });
            this.renderPhenomenonDetail(section, state);
            return;
        }

        switch (state.eventsUiState.viewMode) {
            case 'timeline':
                this.renderEventsTimeline(contentSection, state);
                break;
            case 'table':
                this.renderEventsTable(contentSection, state);
                break;
            case 'map':
                this.renderEventsMapPlaceholder(contentSection);
                break;
        }

        this.renderPhenomenonDetail(section, state);
    }

    private renderPhenomenonDetail(section: HTMLElement, state: AlmanacState): void {
        const detailSection = section.createDiv({ cls: 'almanac-section almanac-phenomenon-detail' });

        if (state.eventsUiState.isDetailLoading) {
            detailSection.createEl('p', { text: 'Loading phenomenon…', cls: 'almanac-empty' });
            return;
        }

        const detail = state.eventsUiState.selectedPhenomenonDetail;
        if (!state.eventsUiState.selectedPhenomenonId || !detail) {
            detailSection.createEl('p', { text: 'Select a phenomenon to view details.', cls: 'almanac-empty' });
            return;
        }

        const header = detailSection.createDiv({ cls: 'almanac-phenomenon-detail__header' });
        const title = header.createEl('h3', { text: detail.name, cls: 'almanac-phenomenon-detail__title' });
        if (detail.category) {
            title.createEl('span', { text: ` (${detail.category})`, cls: 'almanac-phenomenon-detail__category' });
        }
        const closeButton = header.createEl('button', { text: 'Close', cls: 'almanac-control-button' });
        closeButton.addEventListener('click', () => this.runDispatch({ type: 'EVENTS_PHENOMENON_DETAIL_CLOSED' }));

        if (detail.notes) {
            detailSection.createEl('p', { text: detail.notes, cls: 'almanac-phenomenon-detail__notes' });
        }

        if (detail.linkedCalendars.length > 0) {
            const calendarsRow = detailSection.createDiv({ cls: 'almanac-phenomenon-detail__calendars' });
            calendarsRow.createEl('strong', { text: 'Linked calendars:' });
            calendarsRow.createEl('span', { text: detail.linkedCalendars.map(item => item.name).join(', ') });
        }

        if (detail.upcomingOccurrences.length > 0) {
            const occurrencesList = detailSection.createEl('ul', { cls: 'almanac-phenomenon-detail__occurrences' });
            detail.upcomingOccurrences.forEach(occurrence => {
                const item = occurrencesList.createEl('li');
                item.createEl('strong', { text: `${occurrence.calendarName}: ${occurrence.nextLabel}` });
                if (occurrence.subsequent.length > 0) {
                    const subsequentList = item.createEl('ul', { cls: 'almanac-phenomenon-detail__subsequent' });
                    occurrence.subsequent.forEach(label => {
                        subsequentList.createEl('li', { text: label });
                    });
                }
            });
        } else {
            detailSection.createEl('p', { text: 'No upcoming occurrences scheduled.', cls: 'almanac-empty' });
        }
    }

    private describeEventsViewHeading(viewMode: EventsViewMode): string {
        if (viewMode === 'timeline') return 'Phenomena Timeline';
        if (viewMode === 'table') return 'Phenomena Table';
        return 'Phenomena Map';
    }

    private renderEventsTimeline(section: HTMLElement, state: AlmanacState): void {
        const list = section.createEl('ol', { cls: 'almanac-phenomena-timeline' });
        const selectedId = state.eventsUiState.selectedPhenomenonId ?? null;
        const sorted = [...state.eventsUiState.phenomena].sort((a, b) => {
            const aKey = a.nextOccurrence ?? '';
            const bKey = b.nextOccurrence ?? '';
            return aKey.localeCompare(bKey);
        });
        sorted.forEach(item => {
            const entry = list.createEl('li', { cls: 'almanac-phenomena-timeline__entry' });
            entry.classList.toggle('is-active', item.id === selectedId);
            entry.tabIndex = 0;
            entry.setAttribute('role', 'button');
            const selectPhenomenon = () => {
                this.runDispatch({ type: 'EVENTS_PHENOMENON_SELECTED', phenomenonId: item.id });
            };
            entry.addEventListener('click', selectPhenomenon);
            entry.addEventListener('keydown', event => {
                if (event instanceof KeyboardEvent && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    selectPhenomenon();
                }
            });
            const heading = entry.createDiv({ cls: 'almanac-phenomena-timeline__title' });
            heading.createEl('strong', { text: item.title });
            if (item.category) {
                heading.createEl('span', { text: ` (${item.category})`, cls: 'almanac-phenomena-category' });
            }
            if (item.nextOccurrence) {
                entry.createDiv({ text: item.nextOccurrence, cls: 'almanac-phenomena-occurrence' });
            }
            if (item.linkedCalendars && item.linkedCalendars.length > 0) {
                entry.createDiv({
                    text: `Linked calendars: ${item.linkedCalendars.join(', ')}`,
                    cls: 'almanac-phenomena-calendars',
                });
            }
        });
    }

    private renderEventsTable(section: HTMLElement, state: AlmanacState): void {
        const table = section.createEl('table', { cls: 'almanac-phenomena-table' });
        const thead = table.createEl('thead');
        const headRow = thead.createEl('tr');
        ['Name', 'Category', 'Next Occurrence', 'Calendars'].forEach(label => headRow.createEl('th', { text: label }));

        const tbody = table.createEl('tbody');
        state.eventsUiState.phenomena.forEach(item => {
            const row = tbody.createEl('tr');
            row.classList.toggle('is-active', item.id === state.eventsUiState.selectedPhenomenonId);
            row.tabIndex = 0;
            row.setAttribute('role', 'button');
            const selectPhenomenon = () => {
                this.runDispatch({ type: 'EVENTS_PHENOMENON_SELECTED', phenomenonId: item.id });
            };
            row.addEventListener('click', selectPhenomenon);
            row.addEventListener('keydown', event => {
                if (event instanceof KeyboardEvent && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    selectPhenomenon();
                }
            });
            row.createEl('td', { text: item.title });
            row.createEl('td', { text: item.category ?? '—' });
            row.createEl('td', { text: item.nextOccurrence ?? '—' });
            row.createEl('td', { text: item.linkedCalendars?.join(', ') ?? '—' });
        });
    }

    private renderEventsMapPlaceholder(section: HTMLElement): void {
        section.createEl('p', {
            text: 'Map view will plot phenomena across campaign regions (not yet implemented).',
            cls: 'almanac-empty',
        });
    }

    private renderEventsFilters(section: HTMLElement, state: AlmanacState): void {
        const filtersBar = section.createDiv({ cls: 'almanac-events__filters' });

        const categoryWrapper = filtersBar.createDiv({ cls: 'almanac-filter-group', attr: { 'data-filter-group': 'category' } });
        categoryWrapper.createEl('div', { text: 'Categories', cls: 'almanac-filter-label' });
        const categoryList = categoryWrapper.createDiv({ cls: 'almanac-filter-checkboxes' });
        const currentCategoryFilters = state.eventsUiState.filters.categories;
        state.eventsUiState.availableCategories.forEach(category => {
            const label = categoryList.createEl('label', { cls: 'almanac-filter-checkbox', attr: { 'data-filter': 'category' } });
            const input = label.createEl('input', {
                attr: { type: 'checkbox', value: category },
            }) as HTMLInputElement;
            input.checked = currentCategoryFilters.includes(category);
            input.addEventListener('change', () => {
                const currentFilters = this.currentState?.eventsUiState.filters ?? { categories: [], calendarIds: [] };
                const nextCategories = input.checked
                    ? [...currentFilters.categories, category]
                    : currentFilters.categories.filter(id => id !== category);
                this.runDispatch({
                    type: 'EVENTS_FILTER_CHANGED',
                    filters: {
                        categories: nextCategories,
                        calendarIds: currentFilters.calendarIds,
                    },
                });
            });
            label.createEl('span', { text: category });
        });

        const calendarWrapper = filtersBar.createDiv({ cls: 'almanac-filter-group', attr: { 'data-filter-group': 'calendar' } });
        calendarWrapper.createEl('div', { text: 'Calendars', cls: 'almanac-filter-label' });
        const calendarList = calendarWrapper.createDiv({ cls: 'almanac-filter-checkboxes' });
        state.eventsUiState.availableCalendars.forEach(calendar => {
            const label = calendarList.createEl('label', { cls: 'almanac-filter-checkbox', attr: { 'data-filter': 'calendar' } });
            const input = label.createEl('input', {
                attr: { type: 'checkbox', value: calendar.id },
            }) as HTMLInputElement;
            input.checked = state.eventsUiState.filters.calendarIds.includes(calendar.id);
            input.addEventListener('change', () => {
                const currentFilters = this.currentState?.eventsUiState.filters ?? { categories: [], calendarIds: [] };
                const nextIds = input.checked
                    ? [...currentFilters.calendarIds, calendar.id]
                    : currentFilters.calendarIds.filter(id => id !== calendar.id);
                this.runDispatch({
                    type: 'EVENTS_FILTER_CHANGED',
                    filters: {
                        categories: currentFilters.categories,
                        calendarIds: nextIds,
                    },
                });
            });
            label.createEl('span', { text: calendar.name });
        });

        const resetButton = filtersBar.createEl('button', {
            text: 'Reset filters',
            cls: 'almanac-control-button',
            attr: { 'data-action': 'reset-filters' },
        });
        resetButton.disabled = state.eventsUiState.filterCount === 0;
        resetButton.addEventListener('click', () => {
            this.runDispatch({
                type: 'EVENTS_FILTER_CHANGED',
                filters: { categories: [], calendarIds: [] },
            });
        });
    }

    private getActiveCalendar(state: AlmanacState): CalendarSchema | null {
        const activeId = state.calendarState.activeCalendarId;
        if (!activeId) return null;
        return state.calendarState.calendars.find(calendar => calendar.id === activeId) ?? null;
    }

    private formatCalendarTimestamp(schema: CalendarSchema, timestamp: CalendarTimestamp): string {
        const month = getMonthById(schema, timestamp.monthId);
        return formatTimestamp(timestamp, month?.name);
    }

    private runDispatch(event: Parameters<AlmanacStateMachine['dispatch']>[0]): Promise<void> {
        return this.stateMachine.dispatch(event).catch(error => {
            console.error('Almanac dispatch error', error);
        });
    }
}
