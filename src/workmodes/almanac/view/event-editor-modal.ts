// src/workmodes/almanac/view/event-editor-modal.ts
// Event editor modal for creating/editing calendar events

import { App, Modal, Notice, Setting, TextComponent } from "obsidian";
import type { CalendarEvent, CalendarSchema, CalendarTimestamp, RepeatRule, CalendarTimeOfDay } from "../domain";
import { logger } from "../../../app/plugin-logger";

export interface EventEditorModalOptions {
    /** Calendar schema for date validation */
    readonly schema: CalendarSchema;
    /** Current calendar time for default values */
    readonly currentTime: CalendarTimestamp;
    /** Existing event to edit, or undefined to create new event */
    readonly event?: CalendarEvent;
    /** Callback when event is saved */
    readonly onSave?: (event: CalendarEvent) => void;
}

/**
 * Event Editor Modal
 *
 * Provides a comprehensive interface for creating and editing calendar events.
 * Supports both single and recurring events with full recurrence pattern control.
 */
export class EventEditorModal extends Modal {
    private options: EventEditorModalOptions;

    // Form state
    private formData: {
        id: string;
        title: string;
        description: string;
        category: string;
        tags: string[];
        priority: number;
        eventKind: 'single' | 'recurring';
        // Timestamp
        year: number;
        monthId: string;
        day: number;
        hour: number;
        minute: number;
        allDay: boolean;
        // Recurrence
        recurrenceType: 'annual' | 'monthly_position' | 'weekly_dayIndex' | 'custom';
        weeklyInterval: number;
        dayIndex: number;
    };

    // UI components for dynamic updates
    private timeFieldsContainer: HTMLElement | null = null;
    private recurrenceContainer: HTMLElement | null = null;

    constructor(app: App, options: EventEditorModalOptions) {
        super(app);
        this.options = options;

        // Initialize form data from existing event or defaults
        const existingEvent = options.event;
        const currentTime = options.currentTime;

        this.formData = {
            id: existingEvent?.id ?? `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: existingEvent?.title ?? '',
            description: existingEvent?.description ?? '',
            category: existingEvent?.category ?? '',
            tags: existingEvent?.tags ? [...existingEvent.tags] : [],
            priority: existingEvent?.priority ?? 0,
            eventKind: existingEvent?.kind ?? 'single',
            year: existingEvent?.date.year ?? currentTime.year,
            monthId: existingEvent?.date.monthId ?? currentTime.monthId,
            day: existingEvent?.date.day ?? currentTime.day,
            hour: existingEvent?.date.hour ?? currentTime.hour ?? 0,
            minute: existingEvent?.date.minute ?? currentTime.minute ?? 0,
            allDay: existingEvent?.allDay ?? true,
            recurrenceType: this.inferRecurrenceType(existingEvent),
            weeklyInterval: 1,
            dayIndex: 0,
        };
    }

    private inferRecurrenceType(event: CalendarEvent | undefined): 'annual' | 'monthly_position' | 'weekly_dayIndex' | 'custom' {
        if (!event || event.kind === 'single') return 'annual';
        const rule = event.rule;
        switch (rule.type) {
            case 'annual':
            case 'annual_offset':
                return 'annual';
            case 'monthly_position':
                return 'monthly_position';
            case 'weekly_dayIndex':
                return 'weekly_dayIndex';
            case 'custom':
            default:
                return 'custom';
        }
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-almanac-event-editor");

        const isEditMode = !!this.options.event;
        const title = isEditMode ? "Edit Event" : "Create Event";

        contentEl.createEl("h2", { text: title });

        // Render form sections
        this.renderBasicFields(contentEl);
        this.renderEventKindToggle(contentEl);
        this.renderTimestampFields(contentEl);
        this.renderRecurrenceFields(contentEl);
        this.renderActionButtons(contentEl);
    }

    private renderBasicFields(container: HTMLElement): void {
        const section = container.createDiv({ cls: "sm-event-editor__section" });
        section.createEl("h3", { text: "Event Details" });

        // Title (required)
        new Setting(section)
            .setName("Title")
            .setDesc("Name of the event")
            .addText(text => text
                .setPlaceholder("Festival of the Moon")
                .setValue(this.formData.title)
                .onChange(value => {
                    this.formData.title = value;
                }));

        // Description
        new Setting(section)
            .setName("Description")
            .setDesc("Optional description or notes")
            .addTextArea(text => {
                text
                    .setPlaceholder("Annual celebration of the autumn moon...")
                    .setValue(this.formData.description)
                    .onChange(value => {
                        this.formData.description = value;
                    });
                text.inputEl.rows = 4;
                text.inputEl.style.width = "100%";
            });

        // Category
        new Setting(section)
            .setName("Category")
            .setDesc("Event category for organization")
            .addText(text => text
                .setPlaceholder("Festival, Meeting, Combat, etc.")
                .setValue(this.formData.category)
                .onChange(value => {
                    this.formData.category = value;
                }));

        // Tags (comma-separated)
        new Setting(section)
            .setName("Tags")
            .setDesc("Comma-separated tags")
            .addText(text => text
                .setPlaceholder("festival, moon, autumn")
                .setValue(this.formData.tags.join(', '))
                .onChange(value => {
                    this.formData.tags = value.split(',').map(t => t.trim()).filter(t => t.length > 0);
                }));

        // Priority
        new Setting(section)
            .setName("Priority")
            .setDesc("Higher numbers = higher priority (0-10)")
            .addText(text => text
                .setPlaceholder("0")
                .setValue(String(this.formData.priority))
                .onChange(value => {
                    const num = parseInt(value, 10);
                    if (!isNaN(num)) {
                        this.formData.priority = Math.max(0, Math.min(10, num));
                    }
                }));
    }

    private renderEventKindToggle(container: HTMLElement): void {
        const section = container.createDiv({ cls: "sm-event-editor__section" });
        section.createEl("h3", { text: "Event Type" });

        new Setting(section)
            .setName("Event Type")
            .setDesc("Single occurrence or recurring event")
            .addDropdown(dropdown => dropdown
                .addOption('single', 'Single Event')
                .addOption('recurring', 'Recurring Event')
                .setValue(this.formData.eventKind)
                .onChange(value => {
                    this.formData.eventKind = value as 'single' | 'recurring';
                    this.updateRecurrenceVisibility();
                }));
    }

    private renderTimestampFields(container: HTMLElement): void {
        const section = container.createDiv({ cls: "sm-event-editor__section" });
        section.createEl("h3", { text: "Date & Time" });

        this.timeFieldsContainer = section;

        // All-day toggle
        new Setting(section)
            .setName("All-Day Event")
            .setDesc("Event lasts entire day without specific time")
            .addToggle(toggle => toggle
                .setValue(this.formData.allDay)
                .onChange(value => {
                    this.formData.allDay = value;
                    this.updateTimeFieldsVisibility();
                }));

        // Year
        new Setting(section)
            .setName("Year")
            .addText(text => text
                .setPlaceholder(String(this.options.currentTime.year))
                .setValue(String(this.formData.year))
                .onChange(value => {
                    const num = parseInt(value, 10);
                    if (!isNaN(num)) {
                        this.formData.year = num;
                    }
                }));

        // Month (dropdown from schema)
        new Setting(section)
            .setName("Month")
            .addDropdown(dropdown => {
                for (const month of this.options.schema.months) {
                    dropdown.addOption(month.id, month.name);
                }
                dropdown.setValue(this.formData.monthId);
                dropdown.onChange(value => {
                    this.formData.monthId = value;
                });
            });

        // Day
        new Setting(section)
            .setName("Day")
            .addText(text => text
                .setPlaceholder("1")
                .setValue(String(this.formData.day))
                .onChange(value => {
                    const num = parseInt(value, 10);
                    if (!isNaN(num)) {
                        this.formData.day = Math.max(1, num);
                    }
                }));

        // Hour and Minute (conditional on all-day toggle)
        const timeContainer = section.createDiv({ cls: "sm-event-editor__time-fields" });

        const hourSetting = new Setting(timeContainer)
            .setName("Hour")
            .addText(text => text
                .setPlaceholder("0")
                .setValue(String(this.formData.hour))
                .onChange(value => {
                    const num = parseInt(value, 10);
                    if (!isNaN(num)) {
                        this.formData.hour = Math.max(0, Math.min(23, num));
                    }
                }));

        const minuteSetting = new Setting(timeContainer)
            .setName("Minute")
            .addText(text => text
                .setPlaceholder("0")
                .setValue(String(this.formData.minute))
                .onChange(value => {
                    const num = parseInt(value, 10);
                    if (!isNaN(num)) {
                        this.formData.minute = Math.max(0, Math.min(59, num));
                    }
                }));

        // Store references for visibility control
        (timeContainer as any)._hourSetting = hourSetting;
        (timeContainer as any)._minuteSetting = minuteSetting;

        this.updateTimeFieldsVisibility();
    }

    private renderRecurrenceFields(container: HTMLElement): void {
        const section = container.createDiv({ cls: "sm-event-editor__section sm-event-editor__recurrence" });
        section.createEl("h3", { text: "Recurrence Pattern" });

        this.recurrenceContainer = section;

        // Recurrence type selector
        new Setting(section)
            .setName("Recurrence Type")
            .setDesc("How often the event repeats")
            .addDropdown(dropdown => dropdown
                .addOption('annual', 'Annual (Every Year)')
                .addOption('monthly_position', 'Monthly (Same Day Each Month)')
                .addOption('weekly_dayIndex', 'Weekly (Every N Weeks)')
                .addOption('custom', 'Custom')
                .setValue(this.formData.recurrenceType)
                .onChange(value => {
                    this.formData.recurrenceType = value as any;
                    this.updateRecurrenceOptions();
                }));

        // Weekly-specific options
        const weeklyContainer = section.createDiv({ cls: "sm-event-editor__weekly-options" });

        new Setting(weeklyContainer)
            .setName("Repeat Every N Weeks")
            .addText(text => text
                .setPlaceholder("1")
                .setValue(String(this.formData.weeklyInterval))
                .onChange(value => {
                    const num = parseInt(value, 10);
                    if (!isNaN(num) && num > 0) {
                        this.formData.weeklyInterval = num;
                    }
                }));

        new Setting(weeklyContainer)
            .setName("Day of Week")
            .setDesc("0 = first day of week, 1 = second, etc.")
            .addText(text => text
                .setPlaceholder("0")
                .setValue(String(this.formData.dayIndex))
                .onChange(value => {
                    const num = parseInt(value, 10);
                    if (!isNaN(num) && num >= 0) {
                        this.formData.dayIndex = num;
                    }
                }));

        (section as any)._weeklyContainer = weeklyContainer;

        this.updateRecurrenceVisibility();
        this.updateRecurrenceOptions();
    }

    private renderActionButtons(container: HTMLElement): void {
        const btnRow = container.createDiv({ cls: "modal-button-container" });

        // Save button
        const saveBtn = btnRow.createEl("button", {
            text: this.options.event ? "Update Event" : "Create Event",
            cls: "mod-cta"
        });
        saveBtn.addEventListener("click", () => this.handleSave());

        // Cancel button
        const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => this.close());
    }

    private updateTimeFieldsVisibility(): void {
        if (!this.timeFieldsContainer) return;

        const timeContainer = this.timeFieldsContainer.querySelector('.sm-event-editor__time-fields') as any;
        if (!timeContainer) return;

        const display = this.formData.allDay ? 'none' : 'block';
        timeContainer.style.display = display;
    }

    private updateRecurrenceVisibility(): void {
        if (!this.recurrenceContainer) return;

        const display = this.formData.eventKind === 'recurring' ? 'block' : 'none';
        this.recurrenceContainer.style.display = display;
    }

    private updateRecurrenceOptions(): void {
        if (!this.recurrenceContainer) return;

        const weeklyContainer = (this.recurrenceContainer as any)._weeklyContainer as HTMLElement;
        if (!weeklyContainer) return;

        const display = this.formData.recurrenceType === 'weekly_dayIndex' ? 'block' : 'none';
        weeklyContainer.style.display = display;
    }

    private validateForm(): string | null {
        // Title is required
        if (!this.formData.title.trim()) {
            return "Event title is required";
        }

        // Validate date components
        const monthObj = this.options.schema.months.find(m => m.id === this.formData.monthId);
        if (!monthObj) {
            return "Invalid month selected";
        }

        if (this.formData.day < 1 || this.formData.day > monthObj.length) {
            return `Day must be between 1 and ${monthObj.length} for ${monthObj.name}`;
        }

        if (!this.formData.allDay) {
            if (this.formData.hour < 0 || this.formData.hour >= (this.options.schema.hoursPerDay ?? 24)) {
                return `Hour must be between 0 and ${(this.options.schema.hoursPerDay ?? 24) - 1}`;
            }

            if (this.formData.minute < 0 || this.formData.minute >= (this.options.schema.minutesPerHour ?? 60)) {
                return `Minute must be between 0 and ${(this.options.schema.minutesPerHour ?? 60) - 1}`;
            }
        }

        return null;
    }

    private buildEventObject(): CalendarEvent {
        const timestamp: CalendarTimestamp = {
            calendarId: this.options.schema.id,
            year: this.formData.year,
            monthId: this.formData.monthId,
            day: this.formData.day,
            hour: this.formData.allDay ? undefined : this.formData.hour,
            minute: this.formData.allDay ? undefined : this.formData.minute,
            precision: this.formData.allDay ? 'day' : 'minute',
        };

        const baseEvent = {
            id: this.formData.id,
            calendarId: this.options.schema.id,
            title: this.formData.title.trim(),
            description: this.formData.description.trim() || undefined,
            category: this.formData.category.trim() || undefined,
            tags: this.formData.tags.length > 0 ? this.formData.tags : undefined,
            priority: this.formData.priority,
            date: timestamp,
            allDay: this.formData.allDay,
        };

        if (this.formData.eventKind === 'single') {
            return {
                ...baseEvent,
                kind: 'single',
                timePrecision: timestamp.precision,
                startTime: this.formData.allDay ? undefined : {
                    hour: this.formData.hour,
                    minute: this.formData.minute,
                },
            };
        } else {
            // Build repeat rule based on recurrence type
            let rule: RepeatRule;

            switch (this.formData.recurrenceType) {
                case 'annual':
                    // Calculate day of year for annual recurrence
                    const dayOfYear = this.calculateDayOfYear(timestamp);
                    rule = {
                        type: 'annual_offset',
                        offsetDayOfYear: dayOfYear,
                    };
                    break;
                case 'monthly_position':
                    rule = {
                        type: 'monthly_position',
                        monthId: this.formData.monthId,
                        day: this.formData.day,
                    };
                    break;
                case 'weekly_dayIndex':
                    rule = {
                        type: 'weekly_dayIndex',
                        dayIndex: this.formData.dayIndex,
                        interval: this.formData.weeklyInterval,
                    };
                    break;
                case 'custom':
                default:
                    rule = {
                        type: 'custom',
                        customRuleId: 'user-defined',
                    };
                    break;
            }

            return {
                ...baseEvent,
                kind: 'recurring',
                rule,
                timePolicy: this.formData.allDay ? 'all_day' : 'fixed',
                startTime: this.formData.allDay ? undefined : {
                    hour: this.formData.hour,
                    minute: this.formData.minute,
                },
            };
        }
    }

    private calculateDayOfYear(timestamp: CalendarTimestamp): number {
        let dayOfYear = 0;
        const schema = this.options.schema;

        for (const month of schema.months) {
            if (month.id === timestamp.monthId) {
                dayOfYear += timestamp.day;
                break;
            }
            dayOfYear += month.length;
        }

        return dayOfYear;
    }

    private handleSave(): void {
        // Validate form
        const error = this.validateForm();
        if (error) {
            new Notice(error);
            return;
        }

        try {
            // Build event object
            const event = this.buildEventObject();

            logger.info("[almanac] Event saved", {
                eventId: event.id,
                kind: event.kind,
                title: event.title,
            });

            // Call callback
            if (this.options.onSave) {
                this.options.onSave(event);
            }

            new Notice(`Event "${event.title}" ${this.options.event ? 'updated' : 'created'}`);
            this.close();
        } catch (error) {
            logger.error("[almanac] Failed to save event", { error });
            new Notice("Failed to save event. Check console for details.");
        }
    }

    onClose(): void {
        this.contentEl.removeClass("sm-almanac-event-editor");
        this.contentEl.empty();
    }
}

/**
 * Opens the event editor modal
 *
 * @param app - Obsidian App instance
 * @param options - Editor options (event to edit, save callback)
 */
export function openEventEditor(app: App, options: EventEditorModalOptions): void {
    const modal = new EventEditorModal(app, options);
    modal.open();
}
