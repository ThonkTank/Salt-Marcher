// src/workmodes/almanac/view/quick-add-input.ts
// Quick-add event input component with live preview

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-quick-add-input');
import { QuickAddParser, type QuickAddParseResult } from '../helpers/quick-add-parser';
import type { CalendarTimestamp } from '../helpers';

export interface QuickAddInputOptions {
    currentTimestamp: CalendarTimestamp;
    onCreateEvent: (result: QuickAddParseResult) => Promise<void>;
    onOpenAdvanced: (result: QuickAddParseResult) => void;
}

export interface QuickAddInputHandle {
    root: HTMLElement;
    show(): void;
    hide(): void;
    toggle(): void;
    cleanup(): void;
}

/**
 * Quick-Add Input Component
 *
 * Provides inline event creation with smart parsing:
 * - Natural language date/time parsing
 * - Category and priority extraction
 * - Live preview of parsed values
 * - Enter to create, Escape to cancel
 * - "Advanced" button opens full editor
 *
 * Example inputs:
 * - "Dragon attack tomorrow 2pm #encounter !high"
 * - "Council meeting in 3 days #session"
 * - "Festival next week #festival @celebration"
 */
export function createQuickAddInput(options: QuickAddInputOptions): QuickAddInputHandle {
    const containerEl = document.createElement('div');
    containerEl.className = 'sm-quick-add-input';
    containerEl.style.display = 'none';

    // Convert calendar timestamp to Date for parser
    const currentDate = new Date(
        options.currentTimestamp.year,
        0, // January
        1
    );
    // Add days for month
    // Note: This is a simplified conversion - in production you'd use calendar schema
    currentDate.setMonth(0); // Start from January
    currentDate.setDate(options.currentTimestamp.day);

    const parser = new QuickAddParser(currentDate);
    let isVisible = false;

    // Input field
    const inputEl = containerEl.createEl('input', {
        cls: 'sm-quick-add-input__field',
        attr: {
            placeholder: 'e.g., "Dragon attack tomorrow 2pm #encounter !high"',
            'aria-label': 'Quick add event'
        }
    });

    // Preview area
    const previewEl = containerEl.createEl('div', {
        cls: 'sm-quick-add-input__preview'
    });

    // Buttons
    const buttonsEl = containerEl.createEl('div', {
        cls: 'sm-quick-add-input__buttons'
    });

    const cancelBtn = buttonsEl.createEl('button', {
        text: 'Cancel',
        cls: 'sm-quick-add-input__button is-cancel'
    });

    const advancedBtn = buttonsEl.createEl('button', {
        text: 'Advanced',
        cls: 'sm-quick-add-input__button is-advanced'
    });

    const createBtn = buttonsEl.createEl('button', {
        text: 'Create (↵)',
        cls: 'sm-quick-add-input__button is-create'
    });

    function updatePreview(): void {
        const input = inputEl.value.trim();
        previewEl.empty();

        if (!input) {
            return;
        }

        const result = parser.parse(input);

        if (result.parseErrors && result.parseErrors.length > 0) {
            previewEl.createEl('div', {
                cls: 'sm-quick-add-input__error',
                text: result.parseErrors.join(', ')
            });
            return;
        }

        previewEl.createEl('div', {
            cls: 'sm-quick-add-input__preview-label',
            text: 'Parsed as:'
        });

        // Title
        if (result.title) {
            const titleEl = previewEl.createEl('div', {
                cls: 'sm-quick-add-input__preview-item'
            });
            titleEl.createEl('strong', { text: 'Title: ' });
            titleEl.appendText(result.title);
        }

        // Date
        if (result.date) {
            const dateEl = previewEl.createEl('div', {
                cls: 'sm-quick-add-input__preview-item'
            });
            dateEl.createEl('span', { text: '📅 ' });
            const dateStr = result.date.toLocaleDateString();
            const timeStr = result.time
                ? `${result.time.hour.toString().padStart(2, '0')}:${result.time.minute.toString().padStart(2, '0')}`
                : 'All day';
            dateEl.appendText(`${dateStr} ${timeStr}`);
        }

        // Category
        if (result.category) {
            const catEl = previewEl.createEl('div', {
                cls: 'sm-quick-add-input__preview-item'
            });
            const icon = getCategoryIcon(result.category);
            catEl.createEl('span', { text: `${icon} ` });
            catEl.appendText(result.category);
        }

        // Priority
        if (result.priority) {
            const priEl = previewEl.createEl('div', {
                cls: 'sm-quick-add-input__preview-item'
            });
            const icon = getPriorityIcon(result.priority);
            priEl.createEl('span', { text: `${icon} ` });
            priEl.appendText(`${result.priority} priority`);
        }

        // Tags
        if (result.tags && result.tags.length > 0) {
            const tagsEl = previewEl.createEl('div', {
                cls: 'sm-quick-add-input__preview-item'
            });
            tagsEl.createEl('span', { text: '🏷️ ' });
            tagsEl.appendText(result.tags.join(', '));
        }
    }

    async function handleCreate(): Promise<void> {
        const input = inputEl.value.trim();
        if (!input) return;

        const result = parser.parse(input);
        if (result.parseErrors && result.parseErrors.length > 0) {
            return; // Don't create if errors
        }

        try {
            await options.onCreateEvent(result);
            inputEl.value = '';
            hide();
        } catch (error) {
            logger.error('Failed to create event:', error);
            previewEl.empty();
            previewEl.createEl('div', {
                cls: 'sm-quick-add-input__error',
                text: 'Failed to create event. See console for details.'
            });
        }
    }

    function handleAdvanced(): void {
        const input = inputEl.value.trim();
        const result = parser.parse(input);
        hide();
        options.onOpenAdvanced(result);
    }

    function handleKeydown(e: KeyboardEvent): void {
        if (e.key === 'Enter') {
            e.preventDefault();
            void handleCreate();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            hide();
        }
    }

    function show(): void {
        isVisible = true;
        containerEl.style.display = 'block';
        inputEl.value = '';
        inputEl.focus();
        updatePreview();
    }

    function hide(): void {
        isVisible = false;
        containerEl.style.display = 'none';
    }

    function toggle(): void {
        if (isVisible) {
            hide();
        } else {
            show();
        }
    }

    function cleanup(): void {
        containerEl.remove();
    }

    // Event listeners
    inputEl.addEventListener('input', updatePreview);
    inputEl.addEventListener('keydown', handleKeydown);
    cancelBtn.addEventListener('click', hide);
    advancedBtn.addEventListener('click', handleAdvanced);
    createBtn.addEventListener('click', () => void handleCreate());

    return {
        root: containerEl,
        show,
        hide,
        toggle,
        cleanup
    };
}

function getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
        'encounter': '⚔️',
        'session': '☀️',
        'faction': '📜',
        'weather': '⛈️',
        'festival': '🎭',
        'ritual': '🔮',
        'travel': '🗺️'
    };
    return icons[category] || '📅';
}

function getPriorityIcon(priority: string): string {
    const icons: Record<string, string> = {
        'urgent': '🔥',
        'high': '⚠️',
        'normal': 'ℹ️',
        'low': '💤'
    };
    return icons[priority] || 'ℹ️';
}
