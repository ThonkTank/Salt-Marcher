// src/workmodes/almanac/view/event-preview-panel.ts
// Event preview panel for showing live preview in Event Editor modal

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-event-preview');
import { formatTimestamp } from "../helpers";
import type { CalendarEvent, CalendarSchema, CalendarTimestamp } from "../helpers";

export interface EventPreviewPanelOptions {
    /** Calendar schema for date formatting */
    readonly schema: CalendarSchema;
}

export interface EventPreviewPanelHandle {
    /** Root HTML element */
    readonly root: HTMLElement;
    /** Update preview with new event data */
    update(eventData: Partial<CalendarEvent>): void;
    /** Cleanup and destroy */
    destroy(): void;
}

/**
 * Event Preview Panel
 *
 * Displays a live preview of event data in the Event Editor modal.
 * Updates in real-time as form fields change.
 *
 * Preview Layout:
 * ```
 * ┌─────────────────────────────────┐
 * │ Event Preview                   │
 * ├─────────────────────────────────┤
 * │ 🔴 High Priority                │
 * │ Council Meeting                 │
 * │ Political · #urgent #council    │
 * │                                  │
 * │ 📅 15. Kalisar 1024, 09:00      │
 * │ 🔁 Annual (every year)          │
 * │                                  │
 * │ Discuss trade agreements with   │
 * │ the northern guilds...           │
 * └─────────────────────────────────┘
 * ```
 *
 * Features:
 * - Priority indicator with color
 * - Title and metadata (category, tags)
 * - Formatted timestamp and recurrence pattern
 * - Description preview
 * - Handles incomplete data gracefully
 *
 * Usage:
 * ```typescript
 * const previewPanel = createEventPreviewPanel({ schema });
 * modal.contentEl.appendChild(previewPanel.root);
 *
 * // Update preview when form changes
 * previewPanel.update({
 *     title: titleInput.value,
 *     priority: prioritySelect.value,
 *     category: categoryInput.value,
 *     // ... other fields
 * });
 * ```
 */
export function createEventPreviewPanel(
    options: EventPreviewPanelOptions,
): EventPreviewPanelHandle {
    const root = document.createElement('div');
    root.classList.add('sm-event-preview-panel');

    // Create header
    const header = document.createElement('div');
    header.classList.add('sm-event-preview-panel__header');
    header.textContent = 'Event Preview';
    root.appendChild(header);

    // Create card container
    const card = document.createElement('div');
    card.classList.add('sm-event-preview-panel__card');
    root.appendChild(card);

    // Initial empty state
    updatePreview({});

    function updatePreview(eventData: Partial<CalendarEvent>): void {
        logger.info("Updating preview", { eventData });

        // Clear card
        card.replaceChildren();

        // Priority indicator + label
        const priorityRow = document.createElement('div');
        priorityRow.classList.add('sm-event-preview-panel__priority');

        const priorityIndicator = document.createElement('span');
        priorityIndicator.classList.add('sm-event-preview-panel__priority-indicator');

        const priority = eventData.priority ?? 5;
        const priorityColor = getPriorityColor(priority);
        const priorityLabel = getPriorityLabel(priority);

        priorityIndicator.style.backgroundColor = priorityColor;
        card.style.borderLeftColor = priorityColor;

        const priorityText = document.createElement('span');
        priorityText.classList.add('sm-event-preview-panel__priority-text');
        priorityText.textContent = priorityLabel;

        priorityRow.appendChild(priorityIndicator);
        priorityRow.appendChild(priorityText);
        card.appendChild(priorityRow);

        // Title
        const title = document.createElement('div');
        title.classList.add('sm-event-preview-panel__title');
        title.textContent = eventData.title || '(No title)';
        card.appendChild(title);

        // Metadata row (category + tags)
        if (eventData.category || (eventData.tags && eventData.tags.length > 0)) {
            const metadata = document.createElement('div');
            metadata.classList.add('sm-event-preview-panel__metadata');

            if (eventData.category) {
                const categorySpan = document.createElement('span');
                categorySpan.textContent = eventData.category;
                metadata.appendChild(categorySpan);
            }

            if (eventData.tags && eventData.tags.length > 0) {
                for (const tag of eventData.tags) {
                    const tagSpan = document.createElement('span');
                    tagSpan.classList.add('sm-event-preview-panel__tag');
                    tagSpan.textContent = `#${tag}`;
                    metadata.appendChild(tagSpan);
                }
            }

            card.appendChild(metadata);
        }

        // Date/Time row
        if (eventData.date) {
            const dateRow = document.createElement('div');
            dateRow.classList.add('sm-event-preview-panel__date');

            const dateIcon = document.createElement('span');
            dateIcon.textContent = '📅 ';
            dateRow.appendChild(dateIcon);

            const dateText = document.createElement('span');
            const formattedDate = formatEventDate(eventData.date, options.schema, eventData.allDay ?? false);
            dateText.textContent = formattedDate;
            dateRow.appendChild(dateText);

            card.appendChild(dateRow);
        }

        // Recurrence row
        if (eventData.kind === 'recurring' && eventData.rule) {
            const recurrenceRow = document.createElement('div');
            recurrenceRow.classList.add('sm-event-preview-panel__recurrence');

            const recurrenceIcon = document.createElement('span');
            recurrenceIcon.textContent = '🔁 ';
            recurrenceRow.appendChild(recurrenceIcon);

            const recurrenceText = document.createElement('span');
            recurrenceText.textContent = formatRecurrencePattern(eventData.rule.type);
            recurrenceRow.appendChild(recurrenceText);

            card.appendChild(recurrenceRow);
        }

        // Description
        if (eventData.description && eventData.description.trim().length > 0) {
            const description = document.createElement('div');
            description.classList.add('sm-event-preview-panel__description');
            description.textContent = eventData.description;
            card.appendChild(description);
        }

        // Empty state if no data
        if (!eventData.title && !eventData.date && !eventData.description) {
            const emptyState = document.createElement('div');
            emptyState.classList.add('sm-event-preview-panel__empty');
            emptyState.textContent = 'Fill in the form to see a preview';
            card.replaceChildren(emptyState);
        }
    }

    function destroy(): void {
        logger.info("Destroying");
        root.remove();
    }

    return {
        root,
        update: updatePreview,
        destroy,
    };
}

/**
 * Get priority color based on priority value
 */
function getPriorityColor(priority: number): string {
    if (priority >= 9) return '#EF4444'; // Urgent (red-500)
    if (priority >= 7) return '#F59E0B'; // High (amber-500)
    if (priority >= 4) return '#3B82F6'; // Normal (blue-500)
    return '#6B7280'; // Low (gray-500)
}

/**
 * Get priority label based on priority value
 */
function getPriorityLabel(priority: number): string {
    if (priority >= 9) return 'Urgent Priority';
    if (priority >= 7) return 'High Priority';
    if (priority >= 4) return 'Normal Priority';
    return 'Low Priority';
}

/**
 * Format event date with time (or all-day indicator)
 */
function formatEventDate(date: CalendarTimestamp, schema: CalendarSchema, allDay: boolean): string {
    if (allDay) {
        // Format without time
        const monthName = schema.months.find(m => m.id === date.monthId)?.name ?? date.monthId;
        return `${date.day}. ${monthName} ${date.year} (All-day)`;
    } else {
        // Format with time
        return formatTimestamp(schema, date);
    }
}

/**
 * Format recurrence pattern for display
 */
function formatRecurrencePattern(ruleType: string): string {
    switch (ruleType) {
        case 'annual':
        case 'annual_offset':
            return 'Annual (every year)';
        case 'monthly_position':
            return 'Monthly (same position)';
        case 'weekly_dayIndex':
            return 'Weekly (same weekday)';
        case 'custom':
            return 'Custom recurrence';
        default:
            return 'Recurring event';
    }
}
