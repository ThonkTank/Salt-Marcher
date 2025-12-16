// src/workmodes/almanac/view/event-editor-modal.ts
// Event editor modal for creating/editing calendar events

import type { App} from "obsidian";
import { Modal, Notice, Setting } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-event-editor');
import { templateRepository } from "../data/template-repository";
import { getTemplateDisplayName, getTopTemplates, getPinnedTemplates, applyTemplateToEventData } from "../helpers/event-templates";
import { createEventPreviewPanel } from "./event-preview-panel";
import { openTemplateManager } from "./template-manager-modal";
import type { CalendarEvent, CalendarSchema, CalendarTimestamp, RepeatRule } from "../helpers";
import type { EventPreviewPanelHandle } from "./event-preview-panel";
import type { EventTemplate } from "../helpers/event-templates";

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
        // Phase 4: Template support
        saveAsTemplate: boolean;
    };

    // UI components for dynamic updates
    private timeFieldsContainer: HTMLElement | null = null;
    private recurrenceContainer: HTMLElement | null = null;
    private previewPanel: EventPreviewPanelHandle | null = null;
    private previewUpdateDebounceTimer: number | null = null;

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
            allDay: existingEvent?.allDay ?? false, // Default: show time fields
            recurrenceType: this.inferRecurrenceType(existingEvent),
            weeklyInterval: 1,
            dayIndex: 0,
            saveAsTemplate: false, // Phase 4: Template support
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

        // Phase 4: Template selector (only for new events, not edits)
        if (!isEditMode) {
            this.renderTemplateSelector(contentEl);
        }

        // Create two-column layout for form + preview
        const mainContainer = contentEl.createDiv({ cls: "sm-event-editor__main-container" });

        // Left column: Form
        const formColumn = mainContainer.createDiv({ cls: "sm-event-editor__form-column" });
        this.renderBasicFields(formColumn);
        this.renderEventKindToggle(formColumn);
        this.renderTimestampFields(formColumn);
        this.renderRecurrenceFields(formColumn);
        this.renderSaveAsTemplateCheckbox(formColumn);
        this.renderActionButtons(formColumn);

        // Right column: Preview Panel
        const previewColumn = mainContainer.createDiv({ cls: "sm-event-editor__preview-column" });
        this.previewPanel = createEventPreviewPanel({
            schema: this.options.schema,
        });
        previewColumn.appendChild(this.previewPanel.root);

        // Initial preview update
        this.updatePreview();
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
                    this.updatePreview();
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
                        this.updatePreview();
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
                    this.updatePreview();
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
                    this.updatePreview();
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
                        this.updatePreview();
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

    private renderTemplateSelector(container: HTMLElement): void {
        const section = container.createDiv({ cls: "sm-event-editor__section sm-event-editor__template-section" });
        section.createEl("h3", { text: "📝 Start from Template" });

        // Load templates
        const allTemplates = templateRepository.loadTemplates();
        const pinnedTemplates = getPinnedTemplates(allTemplates);
        const topTemplates = getTopTemplates(allTemplates, 5);

        // Combine: Pinned + Top (deduplicated)
        const displayTemplates = [
            ...pinnedTemplates,
            ...topTemplates.filter(t => !pinnedTemplates.find(p => p.id === t.id))
        ];

        new Setting(section)
            .setName("Template")
            .setDesc("Select a template to pre-fill event fields")
            .addDropdown(dropdown => {
                dropdown.addOption("", "-- No Template --");

                for (const template of displayTemplates) {
                    dropdown.addOption(template.id, getTemplateDisplayName(template));
                }

                dropdown.onChange(value => {
                    if (value) {
                        this.applyTemplate(value);
                    }
                });
            })
            .addButton(button => button
                .setButtonText("Manage Templates")
                .onClick(() => {
                    openTemplateManager(this.app, {
                        app: this.app,
                        onTemplateSelected: (template) => {
                            this.applyTemplate(template.id);
                        },
                    });
                })
            );
    }

    private applyTemplate(templateId: string): void {
        const template = templateRepository.getTemplateById(templateId);
        if (!template) {
            new Notice("Template not found");
            return;
        }

        // Apply template to form data
        const templateData = applyTemplateToEventData(template, this.formData, {
            overrideTitle: false, // Keep user's title if they've typed one
            applyCategory: true,
            applyTags: true,
            applyPriority: true,
            applyAllDay: true,
            applyEventKind: true,
            applyRecurrence: true,
        });

        // Update form data (careful to preserve date fields)
        this.formData.title = templateData.title as string || this.formData.title;
        this.formData.description = templateData.description as string || this.formData.description;
        this.formData.category = templateData.category as string || this.formData.category;
        this.formData.tags = (templateData.tags as string[]) || this.formData.tags;
        this.formData.priority = (templateData.priority as number) ?? this.formData.priority;
        this.formData.allDay = (templateData.allDay as boolean) ?? this.formData.allDay;
        this.formData.eventKind = (templateData.eventKind as 'single' | 'recurring') || this.formData.eventKind;
        this.formData.recurrenceType = (templateData.recurrenceType as any) || this.formData.recurrenceType;

        // Re-render form to show new values
        this.onOpen();

        // Increment template use count
        templateRepository.incrementUseCount(templateId);

        new Notice(`Applied template: ${template.name}`);
        logger.info("Template applied", {
            templateId,
            templateName: template.name,
        });
    }

    private renderSaveAsTemplateCheckbox(container: HTMLElement): void {
        const section = container.createDiv({ cls: "sm-event-editor__section" });

        new Setting(section)
            .setName("💾 Save as Template")
            .setDesc("Create a reusable template from this event")
            .addToggle(toggle => toggle
                .setValue(this.formData.saveAsTemplate)
                .onChange(value => {
                    this.formData.saveAsTemplate = value;
                }));
    }

    private renderActionButtons(container: HTMLElement): void {
        const btnRow = container.createDiv({ cls: "modal-button-container" });

        // Save & Create Another button (only for new events)
        if (!this.options.event) {
            const saveAndCreateBtn = btnRow.createEl("button", {
                text: "Save & Create Another",
                cls: "mod-cta"
            });
            saveAndCreateBtn.addEventListener("click", () => this.handleSaveAndCreateAnother());
        }

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

            logger.info("Event saved", {
                eventId: event.id,
                kind: event.kind,
                title: event.title,
            });

            // Call callback
            if (this.options.onSave) {
                this.options.onSave(event);
            }

            // Phase 4: Save as Template (if checkbox is enabled)
            if (this.formData.saveAsTemplate) {
                this.saveAsTemplate();
            }

            new Notice(`Event "${event.title}" ${this.options.event ? 'updated' : 'created'}`);
            this.close();
        } catch (error) {
            logger.error("Failed to save event", { error });
            new Notice("Failed to save event. Check console for details.");
        }
    }

    /**
     * Save & Create Another
     *
     * Saves current event, resets form with smart defaults, keeps modal open.
     * Smart defaults: Copy category/tags, reset title, increment date by 1 day.
     */
    private handleSaveAndCreateAnother(): void {
        // Validate form
        const error = this.validateForm();
        if (error) {
            new Notice(error);
            return;
        }

        try {
            // Build and save event
            const event = this.buildEventObject();

            logger.info("Event saved (create another)", {
                eventId: event.id,
                kind: event.kind,
                title: event.title,
            });

            // Call callback
            if (this.options.onSave) {
                this.options.onSave(event);
            }

            // Phase 4: Save as Template (if checkbox is enabled)
            if (this.formData.saveAsTemplate) {
                this.saveAsTemplate();
            }

            new Notice(`Event "${event.title}" created. Create another...`);

            // Smart defaults for next event
            const savedCategory = this.formData.category;
            const savedTags = [...this.formData.tags];
            const savedEventKind = this.formData.eventKind;
            const savedAllDay = this.formData.allDay;
            const savedRecurrenceType = this.formData.recurrenceType;

            // Increment date by 1 day
            const schema = this.options.schema;
            const currentMonth = schema.months.find(m => m.id === this.formData.monthId);
            let newDay = this.formData.day + 1;
            let newMonthId = this.formData.monthId;
            let newYear = this.formData.year;

            if (currentMonth && newDay > currentMonth.length) {
                // Wrap to next month
                newDay = 1;
                const monthIndex = schema.months.findIndex(m => m.id === this.formData.monthId);
                if (monthIndex < schema.months.length - 1) {
                    newMonthId = schema.months[monthIndex + 1].id;
                } else {
                    // Wrap to next year
                    newMonthId = schema.months[0].id;
                    newYear++;
                }
            }

            // Reset form data with smart defaults
            this.formData = {
                id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title: '', // Reset title
                description: '',
                category: savedCategory, // Copy category
                tags: savedTags, // Copy tags
                priority: 0,
                eventKind: savedEventKind, // Copy event kind
                year: newYear,
                monthId: newMonthId,
                day: newDay,
                hour: this.formData.hour,
                minute: this.formData.minute,
                allDay: savedAllDay, // Copy all-day setting
                recurrenceType: savedRecurrenceType, // Copy recurrence type
                weeklyInterval: 1,
                dayIndex: 0,
                saveAsTemplate: false,
            };

            // Re-render modal with new form data
            this.onOpen();

            logger.info("Form reset with smart defaults for next event");
        } catch (error) {
            logger.error("Failed to save event and create another", { error });
            new Notice("Failed to save event. Check console for details.");
        }
    }

    /**
     * Update Preview Panel
     *
     * Debounced update of preview panel with current form data.
     * Debounce: 150ms to avoid excessive updates while typing.
     */
    private updatePreview(): void {
        // Clear existing debounce timer
        if (this.previewUpdateDebounceTimer !== null) {
            window.clearTimeout(this.previewUpdateDebounceTimer);
        }

        // Set new debounce timer
        this.previewUpdateDebounceTimer = window.setTimeout(() => {
            if (!this.previewPanel) return;

            try {
                // Build event object from current form data
                const previewEvent = this.buildEventObject();

                // Update preview panel
                this.previewPanel.update(previewEvent);
            } catch (error) {
                // Silently fail if event is invalid (form not yet complete)
                // This is expected during typing
            }
        }, 150); // 150ms debounce
    }

    /**
     * Save as Template
     *
     * Creates a new custom template from the current event data.
     * Called when saveAsTemplate checkbox is enabled.
     */
    private saveAsTemplate(): void {
        try {
            const templateId = `template_custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const template: EventTemplate = {
                id: templateId,
                name: this.formData.title || "Unnamed Template",
                icon: "📝", // Default icon
                description: `Template created from event on ${new Date().toLocaleDateString()}`,
                isBuiltIn: false,
                // Pre-filled fields from event data
                title: this.formData.title || undefined,
                descriptionText: this.formData.description || undefined,
                category: this.formData.category || undefined,
                tags: this.formData.tags.length > 0 ? this.formData.tags : undefined,
                priority: this.formData.priority,
                allDay: this.formData.allDay,
                eventKind: this.formData.eventKind,
                recurrenceType: this.formData.eventKind === 'recurring' ? this.formData.recurrenceType : undefined,
                weeklyInterval: this.formData.recurrenceType === 'weekly_dayIndex' ? this.formData.weeklyInterval : undefined,
                useCount: 0,
            };

            templateRepository.saveCustomTemplate(template);
            new Notice(`Template "${template.name}" created`);

            logger.info("Template created from event", {
                templateId,
                name: template.name,
            });
        } catch (error) {
            logger.error("Failed to save template", { error });
            new Notice("Failed to save template. Check console for details.");
        }
    }

    onClose(): void {
        // Cleanup
        if (this.previewUpdateDebounceTimer !== null) {
            window.clearTimeout(this.previewUpdateDebounceTimer);
            this.previewUpdateDebounceTimer = null;
        }

        if (this.previewPanel) {
            this.previewPanel.destroy();
            this.previewPanel = null;
        }

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
