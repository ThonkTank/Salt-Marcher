/**
 * Base Modal Pattern
 *
 * Provides a reusable abstract base class for plugin modals with lifecycle management.
 * Eliminates boilerplate code for:
 * - Modal setup (title, styling, sizing)
 * - Content rendering (abstract method)
 * - Lifecycle hooks (onAfterOpen, onBeforeClose)
 * - Focus management
 * - Error handling
 *
 * Usage:
 * ```typescript
 * export class MyModal extends BasePluginModal<MyOptions> {
 *     protected async renderContent(): Promise<HTMLElement> {
 *         const container = document.createElement('div');
 *         // Build UI
 *         return container;
 *     }
 *
 *     protected onAfterOpen(): void {
 *         // Focus first input, attach event listeners, etc.
 *     }
 *
 *     protected onBeforeClose(): void {
 *         // Cleanup event listeners, abort async operations, etc.
 *     }
 * }
 * ```
 */

import type { App } from 'obsidian';
import { Modal } from 'obsidian';
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('ui-base-modal');

export interface ModalConfig {
    /** Modal title (displayed as h2) */
    title: string;
    /** CSS class(es) to apply to contentEl */
    className: string;
    /** Optional width (CSS value, e.g., "600px", "80%") */
    width?: string;
    /** Optional height (CSS value, e.g., "400px", "80vh") */
    height?: string;
    /** Focus selector after render (e.g., "input[type='text']") */
    focusSelector?: string;
}

/**
 * Abstract base class for plugin modals.
 *
 * Subclasses must implement renderContent() and can optionally override
 * onAfterOpen() and onBeforeClose() for custom lifecycle behavior.
 */
export abstract class BasePluginModal<TOptions = any> extends Modal {
    protected options: TOptions;
    protected config: ModalConfig;

    constructor(app: App, options: TOptions, config: ModalConfig) {
        super(app);
        this.options = options;
        this.config = config;
    }

    /**
     * Opens the modal and renders content.
     * Handles all standard modal setup:
     * - Emptying content element
     * - Adding CSS classes
     * - Rendering title
     * - Setting width/height
     * - Calling renderContent()
     * - Calling onAfterOpen() hook
     * - Managing focus
     */
    async onOpen(): Promise<void> {
        const { contentEl } = this;

        // Clear any previous content
        contentEl.empty();

        // Add configuration classes
        contentEl.addClass(this.config.className);

        // Apply sizing if specified
        if (this.config.width) {
            contentEl.style.width = this.config.width;
        }
        if (this.config.height) {
            contentEl.style.height = this.config.height;
        }

        // Render title
        if (this.config.title) {
            contentEl.createEl('h2', {
                text: this.config.title,
                cls: 'modal-title'
            });
        }

        try {
            // Render subclass-specific content
            const content = await this.renderContent();
            contentEl.appendChild(content);

            // Allow subclasses to perform post-render setup
            // Use queueMicrotask to ensure DOM is fully rendered
            queueMicrotask(() => {
                this.onAfterOpen();

                // Auto-focus if selector specified
                if (this.config.focusSelector) {
                    const focusEl = contentEl.querySelector(this.config.focusSelector);
                    if (focusEl instanceof HTMLElement) {
                        focusEl.focus();
                    }
                }
            });
        } catch (error) {
            logger.error('Failed to render content', error);
            const message = error instanceof Error ? error.message : String(error);
            contentEl.createEl('p', {
                text: `Error rendering modal: ${message}`,
                cls: 'modal-error'
            });
        }
    }

    /**
     * Closes the modal and cleans up resources.
     * Calls onBeforeClose() hook before cleanup.
     */
    onClose(): void {
        try {
            this.onBeforeClose();
        } catch (error) {
            logger.warn('Error in onBeforeClose hook', error);
        }

        // Clear content
        const { contentEl } = this;
        contentEl.empty();
    }

    /**
     * Abstract method: Subclasses must implement content rendering.
     * Should return an HTMLElement containing the modal's UI.
     *
     * The returned element is appended to contentEl after the title.
     */
    protected abstract renderContent(): HTMLElement | Promise<HTMLElement>;

    /**
     * Optional lifecycle hook: Called after content is rendered and appended to DOM.
     * Use for:
     * - Setting up event listeners
     * - Focusing initial inputs
     * - Triggering animations
     * - Loading additional data
     *
     * Override in subclasses as needed.
     */
    protected onAfterOpen(): void {
        // Default: no-op. Override in subclasses.
    }

    /**
     * Optional lifecycle hook: Called when modal is closing, before cleanup.
     * Use for:
     * - Removing event listeners
     * - Aborting async operations
     * - Saving state
     * - Logging
     *
     * Override in subclasses as needed.
     *
     * Note: Exceptions in this method are caught and logged (non-fatal).
     */
    protected onBeforeClose(): void {
        // Default: no-op. Override in subclasses.
    }
}
