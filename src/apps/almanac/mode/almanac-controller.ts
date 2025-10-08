// src/apps/almanac/mode/almanac-controller.ts
// Handles rendering and interactions for the Almanac workmode within Obsidian.

/**
 * Almanac Controller
 *
 * Presenter/controller for the Almanac workmode. Hooks the state machine into the
 * Obsidian ItemView host element and renders a lightweight shell for the
 * Dashboard, Manager and Events modes.
 */

import { App, Modal, type EventRef } from 'obsidian';
import type { CalendarSchema } from '../domain/calendar-schema';
import { getMonthById, getMonthIndex } from '../domain/calendar-schema';
import type { CalendarEvent } from '../domain/calendar-event';
import type { CalendarTimestamp } from '../domain/calendar-timestamp';
import { formatTimestamp, createDayTimestamp, createHourTimestamp, createMinuteTimestamp } from '../domain/calendar-timestamp';
import { advanceTime } from '../domain/time-arithmetic';
import type { CalendarRepository } from '../data/calendar-repository';
import type { EventRepository } from '../data/event-repository';
import type { PhenomenonRepository } from '../data/in-memory-repository';
import type { CalendarStateGateway } from '../data/calendar-state-gateway';
import type { AlmanacRepository } from '../data/almanac-repository';
import {
    InMemoryCalendarRepository,
    InMemoryEventRepository,
    InMemoryPhenomenonRepository,
} from '../data/in-memory-repository';
import { InMemoryStateGateway } from '../data/in-memory-gateway';
import {
    type AlmanacMode,
    type AlmanacInitOverrides,
    type AlmanacState,
    type AlmanacContentMode,
    type CalendarViewMode,
    type CalendarManagerViewMode,
    type CalendarViewZoom,
    type EventEditorDraft,
    type EventEditorMode,
    type EventEditorPreviewItem,
    type EventsViewMode,
    type ImportSummary,
    type PhenomenonEditorDraft,
} from './contracts';
import { AlmanacStateMachine } from './state-machine';
import {
    registerCartographerBridge,
    type CartographerBridgeHandle,
} from './cartographer-bridge';
import { renderEventsMap as renderEventsMapComponent } from './events';
import { emitAlmanacEvent } from '../telemetry';
import { createSplitView, type SplitViewHandle } from '../../../ui/workmode';
import { createCalendarViewContainer, type CalendarViewContainerHandle } from './components/calendar-view-container';
import { createAlmanacContentContainer, type AlmanacContentContainerHandle } from './components/almanac-content-container';
import { ensureDefaultCalendar } from '../data/calendar-presets';

const MODE_COPY: Record<AlmanacMode, { label: string; description: string }> = {
    dashboard: { label: 'Dashboard', description: 'Current date, quick actions and upcoming events' },
    manager: { label: 'Manager', description: 'Manage calendars, zoom levels and defaults' },
    events: { label: 'Events', description: 'Cross-calendar phenomena overview and filters' },
};

const MANAGER_ZOOM_OPTIONS: CalendarViewZoom[] = ['month', 'week', 'day', 'hour'];
const MANAGER_VIEW_OPTIONS: CalendarManagerViewMode[] = ['calendar', 'overview'];
const EVENT_VIEW_OPTIONS: EventsViewMode[] = ['timeline', 'table', 'map'];
const ALMANAC_PROTOCOL_BASE = 'obsidian://saltmarcher';
const ALMANAC_PROTOCOL_HOSTS = new Set(['saltmarcher', 'salt-marcher']);

interface EventEditorCalendarOption {
    readonly id: string;
    readonly name: string;
    readonly daysPerWeek: number;
    readonly months: ReadonlyArray<{ readonly id: string; readonly name: string; readonly length: number }>;
}

type EventEditorModalConfig = {
    readonly mode: EventEditorMode;
    readonly calendars: ReadonlyArray<EventEditorCalendarOption>;
    readonly errors: ReadonlyArray<string>;
    readonly preview: ReadonlyArray<EventEditorPreviewItem>;
    readonly isSaving: boolean;
    readonly submitError?: string;
    readonly onUpdate: (update: Partial<EventEditorDraft>) => void;
    readonly onSubmit: () => void;
    readonly onCancel: () => void;
    readonly onDelete?: () => void;
};

class EventEditorModal extends Modal {
    private draft: EventEditorDraft;
    private config: EventEditorModalConfig;
    private container: HTMLElement | null = null;

    constructor(app: App, draft: EventEditorDraft, config: EventEditorModalConfig) {
        super(app);
        this.draft = { ...draft };
        this.config = { ...config };
    }

    open(): void {
        super.open();
        this.render();
    }

    update(
        draft: EventEditorDraft,
        config: Partial<Omit<EventEditorModalConfig, 'onUpdate' | 'onSubmit' | 'onCancel'>> & {
            readonly onDelete?: () => void;
        },
    ): void {
        this.draft = { ...draft };
        this.config = { ...this.config, ...config } as EventEditorModalConfig;
        this.render();
    }

    close(): void {
        this.container?.remove();
        this.container = null;
        super.close();
    }

    private ensureContainer(): HTMLElement {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.classList.add('almanac-modal');
            this.container.dataset.modal = 'event-editor';
            document.body.appendChild(this.container);
        }
        return this.container;
    }

    private getHost(): HTMLElement {
        const contentEl = (this as Partial<Modal> & { contentEl?: HTMLElement }).contentEl;
        if (contentEl) {
            return contentEl;
        }
        return this.ensureContainer();
    }

    private render(): void {
        const host = this.getHost();
        host.textContent = '';

        const wrapper = document.createElement('div');
        wrapper.classList.add('almanac-modal');
        wrapper.dataset.modal = 'event-editor';
        host.appendChild(wrapper);

        const form = document.createElement('form');
        form.classList.add('almanac-modal__form');
        wrapper.appendChild(form);
        form.addEventListener('submit', event => {
            event.preventDefault();
            if (!this.config.isSaving) {
                this.config.onSubmit();
            }
        });

        const heading = document.createElement('h2');
        heading.textContent = this.draft.kind === 'recurring' ? 'Recurring event' : 'Single event';
        heading.dataset.mode = this.draft.kind;
        form.appendChild(heading);

        if (this.config.submitError) {
            const errorBanner = document.createElement('div');
            errorBanner.classList.add('almanac-section', 'almanac-section--error');
            errorBanner.textContent = this.config.submitError;
            form.appendChild(errorBanner);
        }

        if (this.config.errors.length > 0) {
            const errorList = document.createElement('ul');
            errorList.classList.add('almanac-form-errors');
            this.config.errors.forEach(message => {
                const item = document.createElement('li');
                item.textContent = message;
                errorList.appendChild(item);
            });
            form.appendChild(errorList);
        }

        const calendarOption =
            this.config.calendars.find(option => option.id === this.draft.calendarId) ?? this.config.calendars[0] ?? null;

        const calendarField = document.createElement('label');
        calendarField.classList.add('almanac-modal__field');
        calendarField.textContent = 'Calendar';
        const calendarSelect = document.createElement('select');
        calendarSelect.disabled = this.config.isSaving;
        this.config.calendars.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.id;
            opt.textContent = option.name;
            calendarSelect.appendChild(opt);
        });
        if (this.draft.calendarId) {
            calendarSelect.value = this.draft.calendarId;
        }
        calendarSelect.addEventListener('change', () => {
            this.config.onUpdate({ calendarId: calendarSelect.value });
        });
        calendarField.appendChild(calendarSelect);
        form.appendChild(calendarField);
        const titleField = document.createElement('label');
        titleField.classList.add('almanac-modal__field');
        titleField.textContent = 'Title';
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.required = true;
        titleInput.value = this.draft.title;
        titleInput.disabled = this.config.isSaving;
        titleInput.addEventListener('input', () => {
            this.config.onUpdate({ title: titleInput.value });
        });
        titleField.appendChild(titleInput);
        form.appendChild(titleField);

        const categoryField = document.createElement('label');
        categoryField.classList.add('almanac-modal__field');
        categoryField.textContent = 'Category';
        const categoryInput = document.createElement('input');
        categoryInput.type = 'text';
        categoryInput.value = this.draft.category;
        categoryInput.disabled = this.config.isSaving;
        categoryInput.addEventListener('input', () => {
            this.config.onUpdate({ category: categoryInput.value });
        });
        categoryField.appendChild(categoryInput);
        form.appendChild(categoryField);

        const noteField = document.createElement('label');
        noteField.classList.add('almanac-modal__field');
        noteField.textContent = 'Notes';
        const noteInput = document.createElement('textarea');
        noteInput.rows = 3;
        noteInput.value = this.draft.note;
        noteInput.disabled = this.config.isSaving;
        noteInput.addEventListener('input', () => {
            this.config.onUpdate({ note: noteInput.value });
        });
        noteField.appendChild(noteInput);
        form.appendChild(noteField);

        const dateGroup = document.createElement('div');
        dateGroup.classList.add('almanac-modal__field', 'almanac-modal__field--inline');
        const dateLabel = document.createElement('span');
        dateLabel.textContent = 'Date';
        dateGroup.appendChild(dateLabel);

        const yearInput = document.createElement('input');
        yearInput.type = 'number';
        yearInput.min = '1';
        yearInput.value = this.draft.year;
        yearInput.disabled = this.config.isSaving;
        yearInput.addEventListener('input', () => {
            this.config.onUpdate({ year: yearInput.value });
        });
        dateGroup.appendChild(yearInput);

        const monthSelect = document.createElement('select');
        monthSelect.disabled = this.config.isSaving;
        const months = calendarOption?.months ?? [];
        months.forEach(month => {
            const opt = document.createElement('option');
            opt.value = month.id;
            opt.textContent = month.name;
            monthSelect.appendChild(opt);
        });
        if (this.draft.monthId) {
            monthSelect.value = this.draft.monthId;
        }

        const dayInput = document.createElement('input');
        dayInput.type = 'number';
        dayInput.min = '1';
        dayInput.value = this.draft.day;
        dayInput.disabled = this.config.isSaving;

        const updateDayLimit = () => {
            const month = months.find(item => item.id === monthSelect.value);
            if (month) {
                dayInput.max = String(month.length);
            } else {
                dayInput.removeAttribute('max');
            }
        };
        updateDayLimit();

        monthSelect.addEventListener('change', () => {
            this.config.onUpdate({ monthId: monthSelect.value });
            updateDayLimit();
        });
        dateGroup.appendChild(monthSelect);

        dayInput.addEventListener('input', () => {
            this.config.onUpdate({ day: dayInput.value });
        });
        dateGroup.appendChild(dayInput);
        form.appendChild(dateGroup);

        const allDayField = document.createElement('label');
        allDayField.classList.add('almanac-modal__checkbox');
        const allDayInput = document.createElement('input');
        allDayInput.type = 'checkbox';
        allDayInput.checked = this.draft.allDay;
        allDayInput.disabled = this.config.isSaving;
        allDayInput.addEventListener('change', () => {
            this.config.onUpdate({ allDay: allDayInput.checked });
        });
        allDayField.appendChild(allDayInput);
        allDayField.appendChild(document.createTextNode('All-day event'));
        form.appendChild(allDayField);

        const needsTimeFields = !this.draft.allDay;
        if (this.draft.kind === 'single') {
            const precisionField = document.createElement('label');
            precisionField.classList.add('almanac-modal__field');
            precisionField.textContent = 'Time precision';
            const precisionSelect = document.createElement('select');
            precisionSelect.disabled = this.config.isSaving || this.draft.allDay;
            ['day', 'hour', 'minute'].forEach(value => {
                const opt = document.createElement('option');
                opt.value = value;
                opt.textContent = value.charAt(0).toUpperCase() + value.slice(1);
                precisionSelect.appendChild(opt);
            });
            precisionSelect.value = this.draft.timePrecision;
            precisionSelect.addEventListener('change', () => {
                this.config.onUpdate({ timePrecision: precisionSelect.value as 'day' | 'hour' | 'minute' });
            });
            precisionField.appendChild(precisionSelect);
            form.appendChild(precisionField);
        }
        if (needsTimeFields) {
            const timeGroup = document.createElement('div');
            timeGroup.classList.add('almanac-modal__field', 'almanac-modal__field--inline');
            const timeLabel = document.createElement('span');
            timeLabel.textContent = 'Time';
            timeGroup.appendChild(timeLabel);

            const hourInput = document.createElement('input');
            hourInput.type = 'number';
            hourInput.min = '0';
            hourInput.value = this.draft.hour;
            hourInput.disabled = this.config.isSaving;
            hourInput.addEventListener('input', () => {
                this.config.onUpdate({ hour: hourInput.value });
            });
            timeGroup.appendChild(hourInput);

            const minuteInput = document.createElement('input');
            minuteInput.type = 'number';
            minuteInput.min = '0';
            minuteInput.value = this.draft.minute;
            minuteInput.disabled = this.config.isSaving;
            minuteInput.addEventListener('input', () => {
                this.config.onUpdate({ minute: minuteInput.value });
            });
            timeGroup.appendChild(minuteInput);

            form.appendChild(timeGroup);
        }

        const durationField = document.createElement('label');
        durationField.classList.add('almanac-modal__field');
        durationField.textContent = 'Duration (minutes)';
        const durationInput = document.createElement('input');
        durationInput.type = 'number';
        durationInput.min = '0';
        durationInput.value = this.draft.durationMinutes;
        durationInput.disabled = this.config.isSaving;
        durationInput.addEventListener('input', () => {
            this.config.onUpdate({ durationMinutes: durationInput.value });
        });
        durationField.appendChild(durationInput);
        form.appendChild(durationField);

        if (this.draft.kind === 'recurring') {
            const ruleField = document.createElement('label');
            ruleField.classList.add('almanac-modal__field');
            ruleField.textContent = 'Rule type';
            const ruleSelect = document.createElement('select');
            ruleSelect.disabled = this.config.isSaving;
            const ruleOptions: Array<{ value: EventEditorDraft['ruleType']; label: string }> = [
                { value: 'weekly_dayIndex', label: 'Weekly' },
                { value: 'monthly_position', label: 'Monthly position' },
                { value: 'annual_offset', label: 'Annual offset' },
            ];
            ruleOptions.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option.value;
                opt.textContent = option.label;
                ruleSelect.appendChild(opt);
            });
            ruleSelect.value = this.draft.ruleType;
            ruleSelect.addEventListener('change', () => {
                this.config.onUpdate({ ruleType: ruleSelect.value as EventEditorDraft['ruleType'] });
            });
            ruleField.appendChild(ruleSelect);
            form.appendChild(ruleField);

            if (this.draft.ruleType === 'weekly_dayIndex') {
                const weeklyField = document.createElement('label');
                weeklyField.classList.add('almanac-modal__field');
                weeklyField.textContent = 'Day of week';
                const weeklySelect = document.createElement('select');
                weeklySelect.disabled = this.config.isSaving;
                const days = calendarOption ? calendarOption.daysPerWeek : 7;
                for (let i = 0; i < days; i += 1) {
                    const opt = document.createElement('option');
                    opt.value = String(i);
                    opt.textContent = `Day ${i + 1}`;
                    weeklySelect.appendChild(opt);
                }
                weeklySelect.value = this.draft.ruleDayIndex;
                weeklySelect.addEventListener('change', () => {
                    this.config.onUpdate({ ruleDayIndex: weeklySelect.value });
                });
                weeklyField.appendChild(weeklySelect);

                const intervalInput = document.createElement('input');
                intervalInput.type = 'number';
                intervalInput.min = '1';
                intervalInput.value = this.draft.ruleInterval;
                intervalInput.disabled = this.config.isSaving;
                intervalInput.addEventListener('input', () => {
                    this.config.onUpdate({ ruleInterval: intervalInput.value });
                });
                weeklyField.appendChild(intervalInput);
                form.appendChild(weeklyField);
            } else {
                const monthField = document.createElement('label');
                monthField.classList.add('almanac-modal__field');
                monthField.textContent = 'Rule month';
                const ruleMonthSelect = document.createElement('select');
                ruleMonthSelect.disabled = this.config.isSaving;
                (calendarOption?.months ?? []).forEach(month => {
                    const opt = document.createElement('option');
                    opt.value = month.id;
                    opt.textContent = month.name;
                    ruleMonthSelect.appendChild(opt);
                });
                ruleMonthSelect.value = this.draft.ruleMonthId || this.draft.monthId || '';
                ruleMonthSelect.addEventListener('change', () => {
                    this.config.onUpdate({ ruleMonthId: ruleMonthSelect.value });
                });
                monthField.appendChild(ruleMonthSelect);

                const ruleDayInput = document.createElement('input');
                ruleDayInput.type = 'number';
                ruleDayInput.min = '1';
                ruleDayInput.value = this.draft.ruleDay;
                ruleDayInput.disabled = this.config.isSaving;
                ruleDayInput.addEventListener('input', () => {
                    this.config.onUpdate({ ruleDay: ruleDayInput.value });
                });
                monthField.appendChild(ruleDayInput);
                form.appendChild(monthField);
            }
            const policyField = document.createElement('label');
            policyField.classList.add('almanac-modal__field');
            policyField.textContent = 'Time policy';
            const policySelect = document.createElement('select');
            policySelect.disabled = this.config.isSaving;
            const policies: Array<{ value: EventEditorDraft['timePolicy']; label: string }> = [
                { value: 'all_day', label: 'All day' },
                { value: 'fixed', label: 'Fixed time' },
                { value: 'offset', label: 'Offset from start' },
            ];
            policies.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option.value;
                opt.textContent = option.label;
                policySelect.appendChild(opt);
            });
            policySelect.value = this.draft.timePolicy;
            policySelect.addEventListener('change', () => {
                this.config.onUpdate({ timePolicy: policySelect.value as EventEditorDraft['timePolicy'] });
            });
            policyField.appendChild(policySelect);
            form.appendChild(policyField);

            const boundsField = document.createElement('div');
            boundsField.classList.add('almanac-modal__field', 'almanac-modal__field--inline');
            const boundsLabel = document.createElement('span');
            boundsLabel.textContent = 'End date';
            boundsField.appendChild(boundsLabel);

            const endYearInput = document.createElement('input');
            endYearInput.type = 'number';
            endYearInput.min = '1';
            endYearInput.value = this.draft.boundsEndYear;
            endYearInput.disabled = this.config.isSaving;
            endYearInput.addEventListener('input', () => {
                this.config.onUpdate({ boundsEndYear: endYearInput.value });
            });
            boundsField.appendChild(endYearInput);

            const endMonthSelect = document.createElement('select');
            endMonthSelect.disabled = this.config.isSaving;
            (calendarOption?.months ?? []).forEach(month => {
                const opt = document.createElement('option');
                opt.value = month.id;
                opt.textContent = month.name;
                endMonthSelect.appendChild(opt);
            });
            endMonthSelect.value = this.draft.boundsEndMonthId || '';
            endMonthSelect.addEventListener('change', () => {
                this.config.onUpdate({ boundsEndMonthId: endMonthSelect.value });
            });
            boundsField.appendChild(endMonthSelect);

            const endDayInput = document.createElement('input');
            endDayInput.type = 'number';
            endDayInput.min = '1';
            endDayInput.value = this.draft.boundsEndDay;
            endDayInput.disabled = this.config.isSaving;
            endDayInput.addEventListener('input', () => {
                this.config.onUpdate({ boundsEndDay: endDayInput.value });
            });
            boundsField.appendChild(endDayInput);

            form.appendChild(boundsField);
        }

        const previewSection = document.createElement('div');
        previewSection.classList.add('almanac-modal__preview');
        form.appendChild(previewSection);
        const previewHeading = document.createElement('h3');
        previewHeading.textContent = 'Upcoming occurrences';
        previewSection.appendChild(previewHeading);
        if (this.config.preview.length === 0) {
            const emptyPreview = document.createElement('p');
            emptyPreview.textContent = 'No preview available yet.';
            previewSection.appendChild(emptyPreview);
        } else {
            const list = document.createElement('ul');
            this.config.preview.slice(0, 5).forEach(item => {
                const listItem = document.createElement('li');
                listItem.textContent = item.label;
                list.appendChild(listItem);
            });
            previewSection.appendChild(list);
        }

        const actions = document.createElement('div');
        actions.classList.add('almanac-modal__actions');
        form.appendChild(actions);

        const saveButton = document.createElement('button');
        saveButton.type = 'submit';
        saveButton.textContent = this.config.isSaving ? 'Saving…' : 'Save event';
        saveButton.classList.add('almanac-control-button');
        saveButton.dataset.role = 'save-event';
        saveButton.disabled = this.config.isSaving;
        actions.appendChild(saveButton);

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        cancelButton.classList.add('almanac-control-button');
        cancelButton.disabled = this.config.isSaving;
        cancelButton.addEventListener('click', () => {
            this.config.onCancel();
        });
        actions.appendChild(cancelButton);

        if (this.config.onDelete && this.draft.id) {
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.textContent = 'Delete';
            deleteButton.classList.add('almanac-control-button');
            deleteButton.dataset.role = 'delete-event';
            deleteButton.disabled = this.config.isSaving;
            deleteButton.addEventListener('click', () => {
                this.config.onDelete?.();
            });
            actions.appendChild(deleteButton);
        }
    }
}

class PhenomenonEditorModal extends Modal {
    private draft: PhenomenonEditorDraft;
    private calendars: ReadonlyArray<{ id: string; name: string }>;
    private isSaving: boolean;
    private error?: string;
    private readonly onSave: (draft: PhenomenonEditorDraft) => void;
    private readonly onCancel: () => void;
    private container: HTMLElement | null = null;
    private nameInput: HTMLInputElement | null = null;
    private categoryInput: HTMLInputElement | null = null;
    private visibilitySelect: HTMLSelectElement | null = null;
    private notesInput: HTMLTextAreaElement | null = null;
    private calendarCheckboxes = new Map<string, HTMLInputElement>();
    private saveButton: HTMLButtonElement | null = null;
    private cancelButton: HTMLButtonElement | null = null;
    private errorEl: HTMLElement | null = null;

    constructor(
        app: App,
        draft: PhenomenonEditorDraft,
        config: {
            calendars: ReadonlyArray<{ id: string; name: string }>;
            isSaving: boolean;
            error?: string;
            onSave: (draft: PhenomenonEditorDraft) => void;
            onCancel: () => void;
        },
    ) {
        super(app);
        this.draft = { ...draft };
        this.calendars = config.calendars;
        this.isSaving = config.isSaving;
        this.error = config.error;
        this.onSave = config.onSave;
        this.onCancel = config.onCancel;
    }

    open(): void {
        super.open();
        this.render();
    }

    update(
        draft: PhenomenonEditorDraft,
        config: {
            isSaving: boolean;
            error?: string;
            calendars?: ReadonlyArray<{ id: string; name: string }>;
        },
    ): void {
        this.draft = { ...draft };
        if (config.calendars) {
            this.calendars = config.calendars;
            this.renderCalendars();
        }
        this.isSaving = config.isSaving;
        this.error = config.error;
        this.syncForm();
    }

    close(): void {
        this.container?.remove();
        this.container = null;
        this.calendarCheckboxes.clear();
        super.close();
    }

    private render(): void {
        this.container = document.createElement('div');
        this.container.classList.add('almanac-modal');
        this.container.dataset.modal = 'phenomenon-editor';

        const form = document.createElement('form');
        form.classList.add('almanac-modal__form');
        this.container.appendChild(form);

        const heading = document.createElement('h2');
        heading.textContent = 'Phenomenon Editor';
        form.appendChild(heading);

        const nameField = document.createElement('label');
        nameField.classList.add('almanac-modal__field');
        nameField.textContent = 'Name';
        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.required = true;
        this.nameInput.addEventListener('input', () => {
            this.draft = { ...this.draft, name: this.nameInput!.value };
        });
        nameField.appendChild(this.nameInput);
        form.appendChild(nameField);

        const categoryField = document.createElement('label');
        categoryField.classList.add('almanac-modal__field');
        categoryField.textContent = 'Category';
        this.categoryInput = document.createElement('input');
        this.categoryInput.type = 'text';
        this.categoryInput.addEventListener('input', () => {
            this.draft = { ...this.draft, category: this.categoryInput!.value };
        });
        categoryField.appendChild(this.categoryInput);
        form.appendChild(categoryField);

        const visibilityField = document.createElement('label');
        visibilityField.classList.add('almanac-modal__field');
        visibilityField.textContent = 'Visibility';
        this.visibilitySelect = document.createElement('select');
        const optionAll = document.createElement('option');
        optionAll.value = 'all_calendars';
        optionAll.textContent = 'All calendars';
        this.visibilitySelect.appendChild(optionAll);
        const optionSelected = document.createElement('option');
        optionSelected.value = 'selected';
        optionSelected.textContent = 'Selected calendars';
        this.visibilitySelect.appendChild(optionSelected);
        this.visibilitySelect.addEventListener('change', () => {
            const visibility = this.visibilitySelect!.value as PhenomenonEditorDraft['visibility'];
            const appliesTo = visibility === 'all_calendars' ? [] : this.draft.appliesToCalendarIds;
            this.draft = { ...this.draft, visibility, appliesToCalendarIds: appliesTo };
            this.syncCalendarCheckboxes();
        });
        visibilityField.appendChild(this.visibilitySelect);
        form.appendChild(visibilityField);

        const calendarWrapper = document.createElement('div');
        calendarWrapper.classList.add('almanac-modal__field');
        const calendarLabel = document.createElement('span');
        calendarLabel.textContent = 'Calendars';
        calendarWrapper.appendChild(calendarLabel);
        const calendarList = document.createElement('div');
        calendarList.classList.add('almanac-modal__checkboxes');
        calendarWrapper.appendChild(calendarList);
        form.appendChild(calendarWrapper);
        this.renderCalendars(calendarList);

        const notesField = document.createElement('label');
        notesField.classList.add('almanac-modal__field');
        notesField.textContent = 'Notes';
        this.notesInput = document.createElement('textarea');
        this.notesInput.rows = 4;
        this.notesInput.addEventListener('input', () => {
            this.draft = { ...this.draft, notes: this.notesInput!.value };
        });
        notesField.appendChild(this.notesInput);
        form.appendChild(notesField);

        this.errorEl = document.createElement('div');
        this.errorEl.classList.add('almanac-modal__error');
        form.appendChild(this.errorEl);

        const actions = document.createElement('div');
        actions.classList.add('almanac-modal__actions');
        this.cancelButton = document.createElement('button');
        this.cancelButton.type = 'button';
        this.cancelButton.textContent = 'Cancel';
        this.cancelButton.addEventListener('click', event => {
            event.preventDefault();
            this.onCancel();
        });
        actions.appendChild(this.cancelButton);
        this.saveButton = document.createElement('button');
        this.saveButton.type = 'submit';
        this.saveButton.textContent = 'Save';
        actions.appendChild(this.saveButton);
        form.appendChild(actions);

        form.addEventListener('submit', event => {
            event.preventDefault();
            this.onSave({ ...this.draft });
        });

        document.body.appendChild(this.container);
        this.syncForm();
    }

    private renderCalendars(host?: HTMLElement): void {
        const target = host ?? this.container?.querySelector('.almanac-modal__checkboxes');
        if (!target) {
            return;
        }
        target.textContent = '';
        this.calendarCheckboxes.clear();
        this.calendars.forEach(calendar => {
            const label = document.createElement('label');
            label.classList.add('almanac-modal__checkbox');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = calendar.id;
            input.addEventListener('change', () => {
                const existing = new Set(this.draft.appliesToCalendarIds);
                if (input.checked) {
                    existing.add(calendar.id);
                } else {
                    existing.delete(calendar.id);
                }
                this.draft = { ...this.draft, appliesToCalendarIds: Array.from(existing) };
            });
            label.appendChild(input);
            const span = document.createElement('span');
            span.textContent = calendar.name;
            label.appendChild(span);
            target.appendChild(label);
            this.calendarCheckboxes.set(calendar.id, input);
        });
        this.syncCalendarCheckboxes();
    }

    private syncCalendarCheckboxes(): void {
        for (const [id, checkbox] of this.calendarCheckboxes.entries()) {
            checkbox.checked = this.draft.appliesToCalendarIds.includes(id);
            checkbox.disabled = this.draft.visibility === 'all_calendars';
        }
    }

    private syncForm(): void {
        if (!this.container) {
            return;
        }
        if (this.nameInput) {
            this.nameInput.value = this.draft.name;
        }
        if (this.categoryInput) {
            this.categoryInput.value = this.draft.category;
        }
        if (this.visibilitySelect) {
            this.visibilitySelect.value = this.draft.visibility;
        }
        if (this.notesInput) {
            this.notesInput.value = this.draft.notes ?? '';
        }
        this.syncCalendarCheckboxes();
        if (this.saveButton) {
            this.saveButton.disabled = this.isSaving;
        }
        if (this.cancelButton) {
            this.cancelButton.disabled = this.isSaving;
        }
        if (this.errorEl) {
            this.errorEl.textContent = this.error ?? '';
            this.errorEl.classList.toggle('is-visible', Boolean(this.error));
        }
    }
}

class EventImportDialog extends Modal {
    private value = '';
    private isLoading: boolean;
    private error?: string;
    private readonly onSubmit: (payload: string) => void;
    private readonly onCancel: () => void;
    private container: HTMLElement | null = null;
    private textarea: HTMLTextAreaElement | null = null;
    private saveButton: HTMLButtonElement | null = null;
    private cancelButton: HTMLButtonElement | null = null;
    private errorEl: HTMLElement | null = null;

    constructor(
        app: App,
        config: {
            isLoading: boolean;
            error?: string;
            onSubmit: (payload: string) => void;
            onCancel: () => void;
        },
    ) {
        super(app);
        this.isLoading = config.isLoading;
        this.error = config.error;
        this.onSubmit = config.onSubmit;
        this.onCancel = config.onCancel;
    }

    open(): void {
        super.open();
        this.render();
    }

    update(config: { isLoading: boolean; error?: string }): void {
        this.isLoading = config.isLoading;
        this.error = config.error;
        this.sync();
    }

    close(): void {
        this.container?.remove();
        this.container = null;
        super.close();
    }

    private render(): void {
        this.container = document.createElement('div');
        this.container.classList.add('almanac-modal');
        this.container.dataset.modal = 'event-import';

        const form = document.createElement('form');
        form.classList.add('almanac-modal__form');
        this.container.appendChild(form);

        const heading = document.createElement('h2');
        heading.textContent = 'Import Phenomena';
        form.appendChild(heading);

        this.textarea = document.createElement('textarea');
        this.textarea.rows = 8;
        this.textarea.dataset.role = 'import-input';
        this.textarea.addEventListener('input', () => {
            this.value = this.textarea!.value;
        });
        form.appendChild(this.textarea);

        this.errorEl = document.createElement('div');
        this.errorEl.classList.add('almanac-modal__error');
        form.appendChild(this.errorEl);

        const actions = document.createElement('div');
        actions.classList.add('almanac-modal__actions');
        this.cancelButton = document.createElement('button');
        this.cancelButton.type = 'button';
        this.cancelButton.textContent = 'Cancel';
        this.cancelButton.addEventListener('click', event => {
            event.preventDefault();
            this.onCancel();
        });
        actions.appendChild(this.cancelButton);
        this.saveButton = document.createElement('button');
        this.saveButton.type = 'submit';
        this.saveButton.textContent = 'Import';
        actions.appendChild(this.saveButton);
        form.appendChild(actions);

        form.addEventListener('submit', event => {
            event.preventDefault();
            this.onSubmit(this.value);
        });

        document.body.appendChild(this.container);
        this.sync();
    }

    private sync(): void {
        if (this.textarea && this.textarea.value !== this.value) {
            this.textarea.value = this.value;
        }
        if (this.saveButton) {
            this.saveButton.disabled = this.isLoading;
        }
        if (this.cancelButton) {
            this.cancelButton.disabled = this.isLoading;
        }
        if (this.errorEl) {
            this.errorEl.textContent = this.error ?? '';
            this.errorEl.classList.toggle('is-visible', Boolean(this.error));
        }
    }
}

export interface AlmanacControllerDependencies {
    readonly calendarRepo?: CalendarRepository;
    readonly eventRepo?: EventRepository;
    readonly phenomenonRepo?: PhenomenonRepository & AlmanacRepository;
    readonly gateway?: CalendarStateGateway;
}

export class AlmanacController {
    private readonly calendarRepo: CalendarRepository;
    private readonly eventRepo: EventRepository;
    private readonly phenomenonRepo: PhenomenonRepository & AlmanacRepository;
    private readonly gateway: CalendarStateGateway;
    private readonly stateMachine: AlmanacStateMachine;

    private containerEl: HTMLElement | null = null;
    private unsubscribe: (() => void) | null = null;
    private currentState: AlmanacState | null = null;
    private showTimeJumpForm = false;
    private phenomenonEditorModal: PhenomenonEditorModal | null = null;
    private eventEditorModal: EventEditorModal | null = null;
    private eventImportModal: EventImportDialog | null = null;
    private cartographerBridge: CartographerBridgeHandle | null = null;
    private protocolRef: EventRef | null = null;
    private pendingDeepLink: AlmanacInitOverrides | null = null;
    private isSyncingDeepLink = false;
    private lastDeepLinkUrl: string | null = null;
    private allowDeepLinkSync = false;

    // Split-view components
    private splitView: SplitViewHandle | null = null;
    private calendarView: CalendarViewContainerHandle | null = null;
    private contentContainer: AlmanacContentContainerHandle | null = null;
    private readonly handleProtocolUrl = (rawUrl: string): void => {
        if (this.isSyncingDeepLink) {
            return;
        }
        const overrides = this.parseDeepLink(rawUrl);
        if (!overrides) {
            return;
        }
        this.pendingDeepLink = overrides;
        if (!this.containerEl) {
            return;
        }
        this.allowDeepLinkSync = false;
        const travelId =
            overrides && Object.prototype.hasOwnProperty.call(overrides, 'travelId')
                ? overrides.travelId ?? null
                : undefined;
        void this.runDispatch({ type: 'INIT_ALMANAC', travelId, overrides }).finally(() => {
            this.pendingDeepLink = null;
            this.allowDeepLinkSync = true;
            if (this.currentState) {
                this.syncDeepLink(this.currentState);
            }
        });
    };

    constructor(private readonly app: App, deps: AlmanacControllerDependencies = {}) {
        const calendarRepo = deps.calendarRepo ?? new InMemoryCalendarRepository();
        const eventRepo = deps.eventRepo ?? new InMemoryEventRepository();
        if (eventRepo instanceof InMemoryEventRepository) {
            eventRepo.bindCalendarRepository(calendarRepo);
        }
        const phenomenonRepo = deps.phenomenonRepo ?? new InMemoryPhenomenonRepository();
        const gateway = deps.gateway ?? new InMemoryStateGateway(calendarRepo, eventRepo, phenomenonRepo);

        this.calendarRepo = calendarRepo;
        this.eventRepo = eventRepo;
        this.phenomenonRepo = phenomenonRepo;
        this.gateway = gateway;
        this.stateMachine = new AlmanacStateMachine(
            this.calendarRepo,
            this.eventRepo,
            this.gateway,
            this.phenomenonRepo,
        );
        this.ensureProtocolHandler();
    }

    async onOpen(container: HTMLElement): Promise<void> {
        await this.onClose();

        this.containerEl = container;
        container.empty();
        container.addClass('almanac-container');

        this.lastDeepLinkUrl = null;
        this.ensureProtocolHandler();
        this.allowDeepLinkSync = false;

        this.cartographerBridge = registerCartographerBridge(this.stateMachine, {
            onRequestJump: () => this.openTimeJumpFromCartographer(),
            onFollowUp: eventId => this.handleTravelFollowUp(eventId),
        });

        // Ensure at least one calendar exists (creates Gregorian as default if needed)
        await ensureDefaultCalendar(this.calendarRepo);

        const activeCalendarId = this.gateway.getActiveCalendarId();
        if (!activeCalendarId) {
            const calendars = await this.calendarRepo.listCalendars();
            const fallback = calendars.find(calendar => calendar.isDefaultGlobal) ?? calendars[0];
            if (fallback) {
                const initialTimestamp = createDayTimestamp(
                    fallback.id,
                    fallback.epoch.year,
                    fallback.epoch.monthId,
                    fallback.epoch.day,
                );
                await this.gateway.setActiveCalendar(fallback.id, { initialTimestamp });
            }
        }

        this.unsubscribe = this.stateMachine.subscribe(state => {
            this.currentState = state;
            this.render(state);
            this.syncDeepLink(state);
        });

        const overrides = this.pendingDeepLink ?? null;
        const travelId =
            overrides && Object.prototype.hasOwnProperty.call(overrides, 'travelId')
                ? overrides.travelId ?? null
                : undefined;
        await this.stateMachine.dispatch({
            type: 'INIT_ALMANAC',
            travelId,
            overrides: overrides ?? undefined,
        });
        this.pendingDeepLink = null;
        this.allowDeepLinkSync = true;
        if (this.currentState) {
            this.syncDeepLink(this.currentState);
        }
    }

    async onClose(): Promise<void> {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.phenomenonEditorModal?.close();
        this.phenomenonEditorModal = null;
        this.eventImportModal?.close();
        this.eventImportModal = null;
        this.eventEditorModal?.close();
        this.eventEditorModal = null;

        // Clean up split-view components
        this.calendarView?.destroy();
        this.calendarView = null;
        this.contentContainer?.destroy();
        this.contentContainer = null;
        this.splitView?.destroy();
        this.splitView = null;

        this.containerEl = null;
        this.cartographerBridge?.release();
        this.cartographerBridge = null;
        this.allowDeepLinkSync = false;
    }

    private render(state: AlmanacState): void {
        if (!this.containerEl) return;

        // Initialize split-view components on first render
        if (!this.splitView || !this.calendarView || !this.contentContainer) {
            this.initializeSplitView(state);
        }

        // Update calendar view
        if (this.calendarView && state.calendarViewState) {
            this.calendarView.update(state.calendarViewState);
        }

        // Update content based on mode
        if (this.contentContainer) {
            // Clear and render the appropriate content
            const mode = state.almanacUiState.mode as AlmanacContentMode;
            this.contentContainer.setMode(mode);

            // Render content for active mode
            switch (mode) {
                case 'dashboard':
                    this.renderDashboard(this.contentContainer.dashboardElement, state);
                    break;
                case 'manager':
                    this.renderManager(this.contentContainer.managerElement, state);
                    break;
                case 'events':
                    this.renderEvents(this.contentContainer.eventsElement, state);
                    break;
            }
        }

        this.syncDialogs(state);
    }

    private initializeSplitView(state: AlmanacState): void {
        if (!this.containerEl) return;

        // Clear container
        this.containerEl.empty();
        this.containerEl.addClass('almanac-container');

        // Create split-view layout
        this.splitView = createSplitView(this.containerEl, {
            className: 'almanac-split-layout',
            initialSplit: 0.6, // 60% upper, 40% lower
            minUpperSize: 200,
            minLowerSize: 200,
            orientation: 'horizontal',
            resizable: true,
        });

        // Create calendar view (upper section)
        const calendarMode: CalendarViewMode = 'month'; // Default mode
        this.calendarView = createCalendarViewContainer(this.app, this.splitView.upperElement, {
            mode: calendarMode,
            state: state.calendarViewState || {
                mode: calendarMode,
                zoom: 'month',
                anchorTimestamp: state.calendarState.currentTimestamp,
                events: state.calendarState.upcomingEvents,
                isLoading: false,
            },
            onModeChange: (mode) => {
                // TODO: Dispatch calendar view mode change event
                console.log('Calendar view mode changed:', mode);
            },
            onNavigate: (direction) => {
                if (direction === 'prev' || direction === 'next') {
                    void this.runDispatch({
                        type: 'MANAGER_NAVIGATION_REQUESTED',
                        direction,
                    });
                } else {
                    void this.runDispatch({
                        type: 'MANAGER_NAVIGATION_REQUESTED',
                        direction: 'today',
                    });
                }
            },
            onEventCreate: (timestamp) => {
                void this.runDispatch({
                    type: 'EVENT_CREATE_REQUESTED',
                    mode: 'single',
                    calendarId: state.calendarState.activeCalendarId ?? undefined,
                });
            },
            onEventSelect: (eventId) => {
                void this.runDispatch({
                    type: 'EVENT_EDIT_REQUESTED',
                    eventId,
                });
            },
        });

        // Create content container (lower section)
        const contentMode = state.almanacUiState.mode as AlmanacContentMode;
        this.contentContainer = createAlmanacContentContainer(this.app, this.splitView.lowerElement, {
            mode: contentMode,
            onModeChange: (mode) => {
                void this.runDispatch({
                    type: 'ALMANAC_MODE_SELECTED',
                    mode: mode as AlmanacMode,
                });
            },
        });
    }

    private renderTitle(host: HTMLElement, state: AlmanacState): void {
        const titleRow = host.createDiv({ cls: 'almanac-shell__title-row' });
        const titleGroup = titleRow.createDiv({ cls: 'almanac-shell__title-group' });
        titleGroup.createEl('h1', { text: 'Almanac' });

        const activeCalendar = this.getActiveCalendar(state);
        const subtitle = titleGroup.createDiv({ cls: 'almanac-shell__subtitle' });
        if (activeCalendar) {
            const isDefault = activeCalendar.id === state.calendarState.defaultCalendarId;
            subtitle.setText(`Active calendar: ${activeCalendar.name}${isDefault ? ' (Default)' : ''}`);
        } else {
            subtitle.setText('No calendar selected');
        }

        const controls = titleRow.createDiv({ cls: 'almanac-shell__controls' });
        this.renderCalendarSelector(controls, state);
    }

    private renderShell(host: HTMLElement, state: AlmanacState, renderBody: (body: HTMLElement) => void): void {
        host.empty();
        const shell = host.createDiv({ cls: 'almanac-shell' });

        this.renderTitle(shell, state);
        this.renderModeSwitcher(shell, state);
        this.renderStatusBar(shell, state);

        const body = shell.createDiv({ cls: 'almanac-shell__body' });
        renderBody(body);
    }

    private renderCalendarSelector(host: HTMLElement, state: AlmanacState): void {
        if (state.calendarState.calendars.length === 0) {
            const emptyState = host.createDiv({ cls: 'almanac-empty-state' });
            emptyState.createEl('h2', { text: 'No calendars available' });
            emptyState.createEl('p', {
                text: 'Create your first calendar to start planning events.',
            });

            const createButton = emptyState.createEl('button', {
                text: 'Create calendar',
                cls: 'almanac-control-button',
                attr: { 'data-action': 'create-first-calendar' },
            }) as HTMLButtonElement;
            createButton.disabled = state.almanacUiState.isLoading || state.calendarState.isPersisting;
            createButton.addEventListener('click', () => {
                emitAlmanacEvent({
                    type: 'calendar.almanac.create_flow',
                    source: 'calendar-selector',
                    availableCalendars: state.calendarState.calendars.length,
                });
                void this.runDispatch({ type: 'ALMANAC_MODE_SELECTED', mode: 'manager' });
                void this.runDispatch({ type: 'MANAGER_CREATE_FORM_UPDATED', field: 'name', value: '' });
                void this.runDispatch({ type: 'MANAGER_CREATE_FORM_UPDATED', field: 'id', value: '' });
            });
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
        this.renderShell(host, state, body => {
            const calendar = this.getActiveCalendar(state);
            if (!calendar) {
                body.createEl('p', {
                    text: 'No calendars available. Open the Manager to create one.',
                    cls: 'almanac-empty',
                });
                return;
            }

            const currentTimestamp = state.calendarState.currentTimestamp;
            const content = body.createDiv({ cls: 'almanac-dashboard' });

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
        });
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
        this.renderShell(host, state, body => {
            this.renderManagerContent(body, state);
        });
    }

    private renderManagerContent(host: HTMLElement, state: AlmanacState): void {
        const section = host.createDiv({ cls: 'almanac-manager' });
        const creationSection = section.createDiv({ cls: 'almanac-section almanac-manager__create' });
        this.renderCalendarCreateForm(creationSection, state);
        const eventCreateSection = creationSection.createDiv({ cls: 'almanac-manager__event-create' });
        eventCreateSection.createEl('h3', { text: 'Create event' });
        const eventButtons = eventCreateSection.createDiv({ cls: 'almanac-manager__event-buttons' });
        const managerSingleButton = eventButtons.createEl('button', {
            text: 'Single event',
            cls: 'almanac-control-button',
            attr: { 'data-action': 'manager-event-single' },
        });
        managerSingleButton.addEventListener('click', () => {
            this.runDispatch({ type: 'EVENT_CREATE_REQUESTED', mode: 'single' });
        });
        const managerRecurringButton = eventButtons.createEl('button', {
            text: 'Recurring event',
            cls: 'almanac-control-button',
            attr: { 'data-action': 'manager-event-recurring' },
        });
        managerRecurringButton.addEventListener('click', () => {
            this.runDispatch({ type: 'EVENT_CREATE_REQUESTED', mode: 'recurring' });
        });
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
        const conflict = state.managerUiState.conflictDialog;
        if (conflict) {
            const banner = host.createDiv({ cls: 'almanac-section almanac-section--error' });
            banner.createEl('h3', { text: 'Calendar conflict' });
            banner.createEl('p', { text: conflict.message });
            if (conflict.details.length > 0) {
                const list = banner.createEl('ul', { cls: 'almanac-form-errors' });
                conflict.details.forEach(detail => list.createEl('li', { text: detail }));
            }
            const dismiss = banner.createEl('button', { text: 'Dismiss' });
            dismiss.addEventListener('click', () => {
                void this.runDispatch({ type: 'CALENDAR_CONFLICT_DISMISSED' });
            });
        }

        const deleteDialog = state.managerUiState.deleteDialog;
        if (deleteDialog) {
            const dialog = host.createDiv({ cls: 'almanac-section almanac-section--warning' });
            dialog.createEl('h3', { text: `Delete ${deleteDialog.calendarName}?` });
            dialog.createEl('p', {
                text: 'Deleting a calendar removes it from the Almanac. This action cannot be undone.',
            });
            if (deleteDialog.requiresFallback) {
                dialog.createEl('p', { text: 'A different calendar will be promoted to the default selection.' });
            }
            if (deleteDialog.linkedTravelIds.length > 0) {
                const travelList = dialog.createEl('ul');
                dialog.createEl('p', { text: 'Travel defaults to clear:' });
                deleteDialog.linkedTravelIds.forEach(travelId => travelList.createEl('li', { text: travelId }));
            }
            if (deleteDialog.linkedPhenomena.length > 0) {
                const phenomenaList = dialog.createEl('ul', { cls: 'almanac-form-errors' });
                dialog.createEl('p', { text: 'Linked phenomena preventing deletion:' });
                deleteDialog.linkedPhenomena.forEach(name => phenomenaList.createEl('li', { text: name }));
            }
            if (deleteDialog.error) {
                dialog.createEl('p', { text: deleteDialog.error, cls: 'almanac-form-errors' });
            }
            const actions = dialog.createDiv({ cls: 'almanac-create-form__actions' });
            const confirm = actions.createEl('button', {
                text: deleteDialog.isDeleting ? 'Deleting…' : 'Delete calendar',
                attr: { type: 'button' },
            });
            confirm.disabled = deleteDialog.isDeleting || deleteDialog.linkedPhenomena.length > 0;
            confirm.addEventListener('click', () => {
                void this.runDispatch({
                    type: 'CALENDAR_DELETE_CONFIRMED',
                    calendarId: deleteDialog.calendarId,
                });
            });
            const cancel = actions.createEl('button', { text: 'Cancel', attr: { type: 'button' } });
            cancel.disabled = deleteDialog.isDeleting;
            cancel.addEventListener('click', () => {
                void this.runDispatch({ type: 'CALENDAR_DELETE_CANCELLED' });
            });
        }

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
            const editState = state.managerUiState.editStateById[schema.id];
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

            const editBtn = actions.createEl('button', { text: 'Edit' });
            editBtn.disabled = Boolean(state.calendarState.isPersisting || editState?.isSaving);
            editBtn.addEventListener('click', () => {
                void this.runDispatch({ type: 'CALENDAR_EDIT_REQUESTED', calendarId: schema.id });
            });

            const deleteBtn = actions.createEl('button', { text: 'Delete' });
            deleteBtn.classList.add('almanac-button--danger');
            deleteBtn.disabled = Boolean(state.managerUiState.deleteDialog?.isDeleting);
            deleteBtn.addEventListener('click', () => {
                void this.runDispatch({ type: 'CALENDAR_DELETE_REQUESTED', calendarId: schema.id });
            });

            if (editState) {
                const editRow = body.createEl('tr', { cls: 'almanac-calendar-edit-row' });
                const editCell = editRow.createEl('td', { attr: { colspan: '6' } });
                const form = editCell.createEl('form', { cls: 'almanac-edit-form' });
                form.addEventListener('submit', event => {
                    event.preventDefault();
                    void this.runDispatch({ type: 'CALENDAR_UPDATE_REQUESTED', calendarId: schema.id });
                });
                form.createEl('h4', { text: `Edit ${schema.name}` });
                if (editState.errors.length > 0) {
                    const errorList = form.createEl('ul', { cls: 'almanac-form-errors' });
                    editState.errors.forEach(message => errorList.createEl('li', { text: message }));
                }
                if (editState.warnings.length > 0) {
                    const warningList = form.createEl('ul', { cls: 'almanac-form-errors almanac-form-errors--warning' });
                    editState.warnings.forEach(message => warningList.createEl('li', { text: message }));
                }

                const buildField = (
                    label: string,
                    field: 'name' | 'description' | 'hoursPerDay' | 'minutesPerHour' | 'minuteStep',
                    options: { type: 'text' | 'number'; multiline?: boolean; min?: string; step?: string },
                ) => {
                    const wrapper = form.createEl('label', { cls: 'almanac-modal__field' });
                    wrapper.createEl('span', { text: label });
                    if (options.multiline) {
                        const textarea = wrapper.createEl('textarea');
                        textarea.value = editState.draft[field];
                        textarea.disabled = editState.isSaving;
                        textarea.addEventListener('input', () => {
                            void this.runDispatch({
                                type: 'CALENDAR_EDIT_FORM_UPDATED',
                                calendarId: schema.id,
                                field,
                                value: textarea.value,
                            });
                        });
                    } else {
                        const input = wrapper.createEl('input');
                        input.type = options.type;
                        if (options.min) input.min = options.min;
                        if (options.step) input.step = options.step;
                        input.value = editState.draft[field];
                        input.disabled = editState.isSaving;
                        input.addEventListener('input', () => {
                            void this.runDispatch({
                                type: 'CALENDAR_EDIT_FORM_UPDATED',
                                calendarId: schema.id,
                                field,
                                value: input.value,
                            });
                        });
                    }
                };

                buildField('Name', 'name', { type: 'text' });
                buildField('Description', 'description', { type: 'text', multiline: true });
                buildField('Hours per day', 'hoursPerDay', { type: 'number', min: '1', step: '1' });
                buildField('Minutes per hour', 'minutesPerHour', { type: 'number', min: '1', step: '1' });
                buildField('Minute step', 'minuteStep', { type: 'number', min: '1', step: '1' });

                const formActions = form.createDiv({ cls: 'almanac-create-form__actions' });
                const save = formActions.createEl('button', {
                    text: editState.isSaving ? 'Saving…' : 'Save changes',
                    attr: { type: 'submit' },
                });
                save.disabled = editState.isSaving;

                const cancel = formActions.createEl('button', { text: 'Cancel', attr: { type: 'button' } });
                cancel.disabled = editState.isSaving;
                cancel.addEventListener('click', () => {
                    void this.runDispatch({ type: 'CALENDAR_EDIT_CANCELLED', calendarId: schema.id });
                });
            }
        });
    }

    private renderManagerCalendarView(host: HTMLElement, state: AlmanacState): void {
        const conflict = state.managerUiState.conflictDialog;
        if (conflict) {
            const banner = host.createDiv({ cls: 'almanac-section almanac-section--error' });
            banner.createEl('h3', { text: 'Calendar conflict' });
            banner.createEl('p', { text: conflict.message });
            if (conflict.details.length > 0) {
                const list = banner.createEl('ul', { cls: 'almanac-form-errors' });
                conflict.details.forEach(detail => list.createEl('li', { text: detail }));
            }
            const dismiss = banner.createEl('button', { text: 'Dismiss' });
            dismiss.addEventListener('click', () => {
                void this.runDispatch({ type: 'CALENDAR_CONFLICT_DISMISSED' });
            });
        }

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
        this.renderShell(host, state, body => {
            this.renderEventsContent(body, state);
        });
    }

    private renderEventsContent(host: HTMLElement, state: AlmanacState): void {
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

        this.renderEventsActions(section, state);
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
            this.renderEventsFooter(section, state);
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
                this.renderEventsMap(contentSection, state);
                break;
        }

        this.renderPhenomenonDetail(section, state);
        this.renderEventsFooter(section, state);
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
        const actions = header.createDiv({ cls: 'almanac-phenomenon-detail__actions' });
        const editButton = actions.createEl('button', {
            text: 'Edit',
            cls: 'almanac-control-button',
            attr: { 'data-action': 'edit-phenomenon' },
        });
        editButton.addEventListener('click', () => {
            this.runDispatch({ type: 'PHENOMENON_EDIT_REQUESTED', phenomenonId: detail.id });
        });
        const closeButton = actions.createEl('button', {
            text: 'Close',
            cls: 'almanac-control-button',
            attr: { 'data-action': 'close-detail' },
        });
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
            const selectWrapper = entry.createDiv({ cls: 'almanac-phenomena-timeline__select' });
            const selectionCheckbox = selectWrapper.createEl('input', {
                attr: { type: 'checkbox', value: item.id, 'data-role': 'bulk-select' },
            }) as HTMLInputElement;
            selectionCheckbox.checked = state.eventsUiState.bulkSelection.includes(item.id);
            selectionCheckbox.addEventListener('change', () => {
                this.toggleBulkSelection(item.id, selectionCheckbox.checked);
            });
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
        headRow.createEl('th', { text: 'Select' });
        ['Name', 'Category', 'Next Occurrence', 'Calendars'].forEach(label => headRow.createEl('th', { text: label }));

        const tbody = table.createEl('tbody');
        state.eventsUiState.phenomena.forEach(item => {
            const row = tbody.createEl('tr');
            row.classList.toggle('is-active', item.id === state.eventsUiState.selectedPhenomenonId);
            row.tabIndex = 0;
            row.setAttribute('role', 'button');
            const selectCell = row.createEl('td', { cls: 'almanac-phenomena-table__select' });
            const selectCheckbox = selectCell.createEl('input', {
                attr: { type: 'checkbox', value: item.id, 'data-role': 'bulk-select' },
            }) as HTMLInputElement;
            selectCheckbox.checked = state.eventsUiState.bulkSelection.includes(item.id);
            selectCheckbox.addEventListener('change', () => {
                this.toggleBulkSelection(item.id, selectCheckbox.checked);
            });
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

    private renderEventsMap(section: HTMLElement, state: AlmanacState): void {
        const wrapper = document.createElement('div');
        wrapper.classList.add('almanac-events__map');
        wrapper.dataset.role = 'events-map-container';
        section.appendChild(wrapper);

        renderEventsMapComponent(wrapper, {
            markers: state.eventsUiState.mapMarkers,
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

    private renderEventsActions(section: HTMLElement, state: AlmanacState): void {
        const actions = section.createDiv({ cls: 'almanac-events__actions' });

        const addButton = actions.createEl('button', {
            text: 'Add phenomenon',
            cls: 'almanac-control-button',
            attr: { 'data-action': 'add-phenomenon' },
        });
        addButton.addEventListener('click', () => {
            this.runDispatch({ type: 'PHENOMENON_EDIT_REQUESTED' });
        });

        const addSingleEventButton = actions.createEl('button', {
            text: 'Add single event',
            cls: 'almanac-control-button',
            attr: { 'data-action': 'add-event-single' },
        });
        addSingleEventButton.addEventListener('click', () => {
            this.runDispatch({ type: 'EVENT_CREATE_REQUESTED', mode: 'single' });
        });

        const addRecurringEventButton = actions.createEl('button', {
            text: 'Add recurring event',
            cls: 'almanac-control-button',
            attr: { 'data-action': 'add-event-recurring' },
        });
        addRecurringEventButton.addEventListener('click', () => {
            this.runDispatch({ type: 'EVENT_CREATE_REQUESTED', mode: 'recurring' });
        });

        const importButton = actions.createEl('button', {
            text: 'Import',
            cls: 'almanac-control-button',
            attr: { 'data-action': 'import-phenomena' },
        });
        importButton.addEventListener('click', () => {
            this.runDispatch({ type: 'EVENT_IMPORT_REQUESTED' });
        });

        const exportButton = actions.createEl('button', {
            text: 'Export selected',
            cls: 'almanac-control-button',
            attr: { 'data-action': 'export-selected' },
        });
        exportButton.disabled = state.eventsUiState.bulkSelection.length === 0;
        exportButton.addEventListener('click', () => {
            this.runDispatch({ type: 'EVENT_BULK_ACTION_REQUESTED', action: 'export' });
        });

        const deleteButton = actions.createEl('button', {
            text: 'Delete selected',
            cls: 'almanac-control-button',
            attr: { 'data-action': 'delete-selected' },
        });
        deleteButton.disabled = state.eventsUiState.bulkSelection.length === 0;
        deleteButton.addEventListener('click', () => {
            this.runDispatch({ type: 'EVENT_BULK_ACTION_REQUESTED', action: 'delete' });
        });
    }

    private renderEventsFooter(section: HTMLElement, state: AlmanacState): void {
        if (state.eventsUiState.lastExportPayload) {
            const exportSection = section.createDiv({ cls: 'almanac-section almanac-events__export' });
            exportSection.createEl('h3', { text: 'Export Preview' });
            const preview = exportSection.createEl('textarea', {
                cls: 'almanac-events__export-output',
                attr: { readonly: 'true', 'data-role': 'export-output' },
            }) as HTMLTextAreaElement;
            preview.rows = 6;
            preview.spellcheck = false;
            preview.value = state.eventsUiState.lastExportPayload;
            const clearButton = exportSection.createEl('button', {
                text: 'Clear export',
                cls: 'almanac-control-button',
                attr: { 'data-action': 'clear-export' },
            });
            clearButton.addEventListener('click', () => {
                this.runDispatch({ type: 'EVENT_EXPORT_CLEARED' });
            });
        }

        const summary = state.eventsUiState.importSummary;
        if (summary) {
            const summarySection = section.createDiv({
                cls: 'almanac-events__import-summary',
                attr: { 'data-role': 'import-summary' },
            });
            const parts: string[] = [`Imported ${summary.imported} phenomena`];
            if (summary.failed > 0) {
                parts.push(`Failed: ${summary.failed}`);
            }
            summarySection.setText(parts.join(' • '));
        }
    }

    private toggleBulkSelection(id: string, checked: boolean): void {
        const current = new Set(this.currentState?.eventsUiState.bulkSelection ?? []);
        if (checked) {
            current.add(id);
        } else {
            current.delete(id);
        }
        void this.runDispatch({
            type: 'EVENTS_BULK_SELECTION_UPDATED',
            selection: Array.from(current),
        });
    }

    private syncDialogs(state: AlmanacState): void {
        const eventsState = state.eventsUiState;
        const phenomenonCalendars = state.calendarState.calendars.map(schema => ({ id: schema.id, name: schema.name }));
        const calendarOptions: ReadonlyArray<EventEditorCalendarOption> = state.calendarState.calendars.map(schema => ({
            id: schema.id,
            name: schema.name,
            daysPerWeek: schema.daysPerWeek,
            months: schema.months.map(month => ({
                id: month.id,
                name: month.name,
                length: month.length,
            })),
        }));

        if (eventsState.isEditorOpen && eventsState.editorDraft) {
            if (!this.phenomenonEditorModal) {
                this.phenomenonEditorModal = new PhenomenonEditorModal(this.app, eventsState.editorDraft, {
                    calendars: phenomenonCalendars,
                    isSaving: eventsState.isSaving,
                    error: eventsState.editorError,
                    onSave: draft => {
                        void this.runDispatch({ type: 'PHENOMENON_SAVE_REQUESTED', draft });
                    },
                    onCancel: () => {
                        void this.runDispatch({ type: 'PHENOMENON_EDIT_CANCELLED' });
                    },
                });
                this.phenomenonEditorModal.open();
            } else {
                this.phenomenonEditorModal.update(eventsState.editorDraft, {
                    isSaving: eventsState.isSaving,
                    error: eventsState.editorError,
                    calendars: phenomenonCalendars,
                });
            }
        } else if (this.phenomenonEditorModal) {
            this.phenomenonEditorModal.close();
            this.phenomenonEditorModal = null;
        }

        if (eventsState.isEventEditorOpen && eventsState.eventEditorDraft) {
            const mode: EventEditorMode = eventsState.eventEditorDraft.kind === 'recurring' ? 'recurring' : 'single';
            const config: EventEditorModalConfig = {
                mode,
                calendars: calendarOptions,
                errors: eventsState.eventEditorErrors,
                preview: eventsState.eventEditorPreview,
                isSaving: eventsState.isEventSaving,
                submitError: eventsState.eventEditorError,
                onUpdate: update => {
                    void this.runDispatch({ type: 'EVENT_EDITOR_UPDATED', update });
                },
                onSubmit: () => {
                    void this.runDispatch({ type: 'EVENT_EDITOR_SAVE_REQUESTED' });
                },
                onCancel: () => {
                    void this.runDispatch({ type: 'EVENT_EDITOR_CANCELLED' });
                },
                onDelete: eventsState.eventEditorDraft.id
                    ? () => {
                          void this.runDispatch({
                              type: 'EVENT_DELETE_REQUESTED',
                              eventId: eventsState.eventEditorDraft!.id,
                          });
                      }
                    : undefined,
            };

            if (!this.eventEditorModal) {
                this.eventEditorModal = new EventEditorModal(this.app, eventsState.eventEditorDraft, config);
                this.eventEditorModal.open();
            } else {
                this.eventEditorModal.update(eventsState.eventEditorDraft, {
                    mode: config.mode,
                    calendars: config.calendars,
                    errors: config.errors,
                    preview: config.preview,
                    isSaving: config.isSaving,
                    submitError: config.submitError,
                    onDelete: config.onDelete,
                });
            }
        } else if (this.eventEditorModal) {
            this.eventEditorModal.close();
            this.eventEditorModal = null;
        }

        if (eventsState.isImportDialogOpen) {
            if (!this.eventImportModal) {
                this.eventImportModal = new EventImportDialog(this.app, {
                    isLoading: eventsState.isLoading,
                    error: eventsState.importError,
                    onSubmit: payload => {
                        void this.runDispatch({ type: 'EVENT_IMPORT_SUBMITTED', payload });
                    },
                    onCancel: () => {
                        void this.runDispatch({ type: 'EVENT_IMPORT_CANCELLED' });
                    },
                });
                this.eventImportModal.open();
            } else {
                this.eventImportModal.update({
                    isLoading: eventsState.isLoading,
                    error: eventsState.importError,
                });
            }
        } else if (this.eventImportModal) {
            this.eventImportModal.close();
            this.eventImportModal = null;
        }
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

    private ensureProtocolHandler(): void {
        if (this.protocolRef || typeof this.app.workspace?.on !== 'function') {
            return;
        }
        const ref = this.app.workspace.on('url', this.handleProtocolUrl);
        if (ref && typeof this.app.workspace?.offref === 'function') {
            this.protocolRef = ref;
        }
    }

    private parseDeepLink(rawUrl: string): AlmanacInitOverrides | null {
        if (!rawUrl) {
            return null;
        }
        let url: URL;
        try {
            url = new URL(rawUrl);
        } catch (error) {
            return null;
        }
        if (url.protocol !== 'obsidian:') {
            return null;
        }
        const host = url.hostname.toLowerCase();
        if (!ALMANAC_PROTOCOL_HOSTS.has(host)) {
            return null;
        }
        const overrides: AlmanacInitOverrides = {};
        const segments = url.pathname
            .split('/')
            .map(segment => segment.trim().toLowerCase())
            .filter(Boolean);
        if (segments[0] === 'almanac') {
            segments.shift();
        }
        if (segments[0]) {
            const segmentMode = segments[0];
            if (segmentMode === 'dashboard' || segmentMode === 'manager' || segmentMode === 'events') {
                overrides.mode = segmentMode as AlmanacMode;
            }
        }

        const params = url.searchParams;
        const modeParam = params.get('mode');
        if (modeParam === 'dashboard' || modeParam === 'manager' || modeParam === 'events') {
            overrides.mode = modeParam;
        }

        const viewParam = params.get('view');
        if (viewParam) {
            if (MANAGER_VIEW_OPTIONS.includes(viewParam as CalendarManagerViewMode)) {
                overrides.managerView = viewParam as CalendarManagerViewMode;
            }
            if (EVENT_VIEW_OPTIONS.includes(viewParam as EventsViewMode)) {
                overrides.eventsView = viewParam as EventsViewMode;
            }
        }

        const zoomParam = params.get('zoom');
        if (zoomParam && MANAGER_ZOOM_OPTIONS.includes(zoomParam as CalendarViewZoom)) {
            overrides.managerZoom = zoomParam as CalendarViewZoom;
        }

        if (params.has('phenomenon')) {
            const focus = params.get('phenomenon');
            overrides.selectedPhenomenonId = focus && focus.length > 0 ? focus : null;
        }

        if (params.has('travelId') || params.has('travel')) {
            const travelId = params.get('travelId') ?? params.get('travel');
            overrides.travelId = travelId && travelId.length > 0 ? travelId : null;
        }

        const hasValues =
            overrides.mode !== undefined ||
            overrides.managerView !== undefined ||
            overrides.managerZoom !== undefined ||
            overrides.eventsView !== undefined ||
            overrides.travelId !== undefined ||
            Object.prototype.hasOwnProperty.call(overrides, 'selectedPhenomenonId');

        return hasValues ? overrides : null;
    }

    private syncDeepLink(state: AlmanacState): void {
        if (!this.allowDeepLinkSync) {
            return;
        }
        const url = this.buildDeepLinkUrl(state);
        if (!url || url === this.lastDeepLinkUrl) {
            return;
        }
        this.lastDeepLinkUrl = url;
        if (typeof this.app.workspace?.trigger === 'function') {
            this.isSyncingDeepLink = true;
            try {
                this.app.workspace.trigger('url', url);
            } finally {
                this.isSyncingDeepLink = false;
            }
        }
    }

    private buildDeepLinkUrl(state: AlmanacState): string {
        const params: string[] = [];
        const mode = state.almanacUiState.mode;
        params.push(`mode=${encodeURIComponent(mode)}`);

        const travelId = state.travelLeafState.travelId;
        if (travelId) {
            params.push(`travelId=${encodeURIComponent(travelId)}`);
        }

        if (mode === 'manager') {
            params.push(`view=${encodeURIComponent(state.managerUiState.viewMode)}`);
            params.push(`zoom=${encodeURIComponent(state.managerUiState.zoom)}`);
        } else if (mode === 'events') {
            params.push(`view=${encodeURIComponent(state.eventsUiState.viewMode)}`);
            if (state.eventsUiState.selectedPhenomenonId) {
                params.push(`phenomenon=${encodeURIComponent(state.eventsUiState.selectedPhenomenonId)}`);
            }
        }

        const query = params.length > 0 ? `?${params.join('&')}` : '';
        return `${ALMANAC_PROTOCOL_BASE}${query}`;
    }

    private runDispatch(event: Parameters<AlmanacStateMachine['dispatch']>[0]): Promise<void> {
        return this.stateMachine.dispatch(event).catch(error => {
            console.error('Almanac dispatch error', error);
        });
    }

    private async openTimeJumpFromCartographer(): Promise<void> {
        this.showTimeJumpForm = true;
        if (this.currentState && this.containerEl) {
            this.render(this.currentState);
        }
    }

    private async handleTravelFollowUp(eventId: string): Promise<void> {
        console.info('[almanac] travel follow-up requested', { eventId });
        await this.runDispatch({ type: 'ALMANAC_MODE_SELECTED', mode: 'events' });
    }
}
