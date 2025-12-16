// src/workmodes/almanac/view/inline-editor.ts
// Inline editor component for quick event title editing

import { Notice } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-inline-editor');

export interface InlineEditorOptions {
    /** Initial text value */
    readonly initialValue: string;
    /** Callback when save is confirmed (Enter or blur) */
    readonly onSave: (newValue: string) => Promise<void>;
    /** Optional callback when edit is cancelled (Escape) */
    readonly onCancel?: () => void;
    /** Optional placeholder text */
    readonly placeholder?: string;
    /** Optional validation function */
    readonly validate?: (value: string) => string | null; // Returns error message or null
}

export interface InlineEditorHandle {
    /** Activate inline editing mode (show input) */
    activate(): void;
    /** Deactivate inline editing mode (hide input, restore original) */
    deactivate(): void;
    /** Get current input value */
    getValue(): string;
    /** Cleanup and remove all listeners */
    destroy(): void;
    /** Check if editor is currently active */
    isActive(): boolean;
}

/**
 * Inline Editor
 *
 * Provides click-to-edit functionality for event titles directly in calendar views.
 * Replaces an element's text content with an editable input field.
 *
 * Features:
 * - Enter key → save (async with loading state)
 * - Escape key → cancel
 * - Blur (click outside) → save
 * - Validation support
 * - Error handling with Notice
 * - Optimistic updates
 *
 * Usage:
 * ```typescript
 * const handle = createInlineEditor(titleElement, {
 *     initialValue: event.title,
 *     onSave: async (newTitle) => {
 *         await gateway.saveEvent({ ...event, title: newTitle });
 *     },
 *     onCancel: () => {
 *         console.log('Edit cancelled');
 *     }
 * });
 * handle.activate();
 * ```
 */
export function createInlineEditor(
    element: HTMLElement,
    options: InlineEditorOptions,
): InlineEditorHandle {
    let active = false;
    let saving = false;
    let inputElement: HTMLInputElement | null = null;
    let originalContent: string = element.textContent || '';
    let currentValue = options.initialValue;

    // Event handlers (need to be stored for removal)
    const handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            save();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            cancel();
        }
    };

    const handleBlur = (): void => {
        // Delay blur handler to allow click events to process first
        setTimeout(() => {
            if (active && !saving) {
                save();
            }
        }, 100);
    };

    const handleInput = (event: Event): void => {
        const target = event.target as HTMLInputElement;
        currentValue = target.value;
    };

    function activate(): void {
        if (active) {
            logger.warn("Already active", { element });
            return;
        }

        logger.info("Activating", { initialValue: options.initialValue });
        active = true;

        // Store original content for restore
        originalContent = element.textContent || '';

        // Create input element
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.classList.add('sm-inline-editor');
        inputElement.value = options.initialValue;
        inputElement.placeholder = options.placeholder ?? '';
        currentValue = options.initialValue;

        // Attach event listeners
        inputElement.addEventListener('keydown', handleKeyDown);
        inputElement.addEventListener('blur', handleBlur);
        inputElement.addEventListener('input', handleInput);

        // Replace element content with input
        element.replaceChildren(inputElement);

        // Focus and select all text
        inputElement.focus();
        inputElement.select();
    }

    function deactivate(): void {
        if (!active) return;

        logger.info("Deactivating");
        active = false;

        // Remove event listeners
        if (inputElement) {
            inputElement.removeEventListener('keydown', handleKeyDown);
            inputElement.removeEventListener('blur', handleBlur);
            inputElement.removeEventListener('input', handleInput);
            inputElement = null;
        }

        // Restore original content (or updated value if save succeeded)
        element.textContent = currentValue;
    }

    async function save(): Promise<void> {
        if (!active || saving) return;

        const newValue = currentValue.trim();

        // Check if value changed
        if (newValue === options.initialValue) {
            logger.info("No changes, deactivating");
            deactivate();
            return;
        }

        // Validate if validator provided
        if (options.validate) {
            const error = options.validate(newValue);
            if (error) {
                logger.warn("Validation failed", { error, value: newValue });
                new Notice(`Validation failed: ${error}`);
                return; // Keep editor active for correction
            }
        }

        // Check for empty value
        if (newValue.length === 0) {
            logger.warn("Empty value not allowed");
            new Notice('Title cannot be empty');
            return;
        }

        logger.info("Saving", { newValue });
        saving = true;

        // Show loading state
        if (inputElement) {
            inputElement.classList.add('sm-inline-editor--loading');
            inputElement.disabled = true;
        }

        try {
            await options.onSave(newValue);
            logger.info("Save successful");

            // Update current value to new value (optimistic update)
            currentValue = newValue;

            // Deactivate (will show new value)
            deactivate();
        } catch (error) {
            logger.error("Save failed", { error, newValue });
            new Notice(`Failed to save: ${error instanceof Error ? error.message : String(error)}`);

            // Remove loading state and re-enable input
            if (inputElement) {
                inputElement.classList.remove('sm-inline-editor--loading');
                inputElement.disabled = false;
                inputElement.focus();
            }
        } finally {
            saving = false;
        }
    }

    function cancel(): void {
        logger.info("Cancelling");

        // Restore original value
        currentValue = options.initialValue;

        // Call optional cancel callback
        options.onCancel?.();

        // Deactivate
        deactivate();
    }

    function getValue(): string {
        return currentValue;
    }

    function destroy(): void {
        logger.info("Destroying");

        // Deactivate if active
        if (active) {
            deactivate();
        }

        // Clear references
        inputElement = null;
    }

    function isActive(): boolean {
        return active;
    }

    return {
        activate,
        deactivate,
        getValue,
        destroy,
        isActive,
    };
}
