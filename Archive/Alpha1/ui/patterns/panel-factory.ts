/**
 * Panel Factory Pattern
 *
 * Provides utilities for creating consistent, reusable panel layouts.
 * Eliminates boilerplate for:
 * - Panel structure (root, sections, collapsible sections)
 * - Title rendering
 * - Section content management
 * - UI element references
 * - Cleanup and lifecycle management
 *
 * Usage:
 * ```typescript
 * const panel = createPanel(container, {
 *     rootClass: 'my-panel',
 *     title: 'Settings',
 *     sections: [
 *         {
 *             title: 'General',
 *             content: (container) => {
 *                 container.createEl('label', { text: 'Name:' });
 *                 container.createEl('input', { type: 'text' });
 *             }
 *         },
 *         {
 *             title: 'Advanced',
 *             collapsible: true,
 *             defaultExpanded: false,
 *             content: (container) => {
 *                 container.createEl('label', { text: 'Advanced Option:' });
 *                 container.createEl('input', { type: 'checkbox' });
 *             }
 *         }
 *     ],
 *     buildUI: (root) => ({
 *         nameInput: root.querySelector('input[type="text"]') as HTMLInputElement,
 *         advancedCheckbox: root.querySelector('input[type="checkbox"]') as HTMLInputElement,
 *     })
 * });
 *
 * // Use panel
 * panel.ui.nameInput.value = 'New Name';
 *
 * // Cleanup
 * panel.destroy();
 * ```
 */

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('ui-panel-factory');

export interface PanelSection {
    /** Section title (displayed as h4) */
    title?: string;
    /** Whether section can be collapsed */
    collapsible?: boolean;
    /** Whether section starts expanded (default: true) */
    defaultExpanded?: boolean;
    /** CSS class(es) to apply to section container */
    className?: string;
    /** Callback to build section content */
    content: (container: HTMLElement) => void;
}

export interface PanelSpec<TUI extends Record<string, any> = any> {
    /** CSS class(es) for root element */
    rootClass: string;
    /** Optional panel title (displayed as h3) */
    title?: string;
    /** Optional sections to create */
    sections?: PanelSection[];
    /** Optional callback to build UI references after rendering */
    buildUI?: (root: HTMLElement) => TUI;
}

export interface PanelHandle<TUI extends Record<string, any> = any> {
    /** Root element of the panel */
    root: HTMLElement;
    /** UI element references (from buildUI callback) */
    ui: TUI;
    /** Optional callback to update panel data */
    setData?: (data: any) => void;
    /** Cleanup function - removes panel from DOM and releases resources */
    destroy: () => void;
}

/**
 * Creates a panel with optional sections and returns a handle for interaction.
 *
 * @param container Parent element to append panel to
 * @param spec Panel specification with layout and callbacks
 * @returns Panel handle with root, ui references, and destroy callback
 */
export function createPanel<TUI extends Record<string, any> = any>(
    container: HTMLElement,
    spec: PanelSpec<TUI>
): PanelHandle<TUI> {
    try {
        // Create root element
        const root = container.createDiv({ cls: spec.rootClass });

        // Add title if specified
        if (spec.title) {
            root.createEl('h3', {
                text: spec.title,
                cls: 'panel-title'
            });
        }

        // Build sections if specified
        if (spec.sections && spec.sections.length > 0) {
            for (const section of spec.sections) {
                createPanelSection(root, section);
            }
        }

        // Build UI references
        const ui = spec.buildUI ? spec.buildUI(root) : ({} as TUI);

        // Return panel handle
        return {
            root,
            ui,
            destroy() {
                try {
                    root.remove();
                } catch (error) {
                    logger.warn('Error during cleanup', error);
                }
            }
        };
    } catch (error) {
        logger.error('Failed to create panel', error);
        throw error;
    }
}

/**
 * Creates a panel section within a container.
 * Handles collapsible sections with toggle functionality.
 *
 * @internal
 */
function createPanelSection(container: HTMLElement, section: PanelSection): void {
    const sectionEl = container.createDiv({
        cls: ['panel-section', section.className].filter(Boolean).join(' ')
    });

    if (section.title) {
        const isCollapsible = section.collapsible === true;
        const isExpanded = section.defaultExpanded !== false;

        // Create header
        const header = sectionEl.createEl('h4', {
            text: section.title,
            cls: isCollapsible ? 'section-header collapsible' : 'section-header'
        });

        // Create content container
        const content = sectionEl.createDiv({ cls: 'section-content' });

        // Initial visibility state
        if (!isExpanded) {
            content.style.display = 'none';
            header.addClass('collapsed');
        }

        // Add collapse/expand toggle if collapsible
        if (isCollapsible) {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                const isCurrentlyHidden = content.style.display === 'none';
                content.style.display = isCurrentlyHidden ? '' : 'none';
                header.toggleClass('collapsed', !isCurrentlyHidden);
            });
        }

        // Build section content
        section.content(content);
    } else {
        // No title: build content directly in section
        section.content(sectionEl);
    }
}

/**
 * Creates a simple two-column layout panel with labels and controls.
 *
 * Useful for settings panels, inspectors, etc.
 *
 * Example:
 * ```typescript
 * const panel = createLabeledPanel(container, {
 *     rootClass: 'settings-panel',
 *     title: 'Settings',
 *     rows: [
 *         {
 *             label: 'Name:',
 *             build: (cell) => {
 *                 const input = cell.createEl('input', { type: 'text' });
 *                 return { input };
 *             }
 *         },
 *         {
 *             label: 'Enabled:',
 *             build: (cell) => {
 *                 const checkbox = cell.createEl('input', { type: 'checkbox' });
 *                 return { checkbox };
 *             }
 *         }
 *     ]
 * });
 * ```
 */
export interface LabeledPanelRow<TUI extends Record<string, any> = any> {
    label: string;
    build: (cell: HTMLElement) => TUI;
}

export interface LabeledPanelSpec<TUI extends Record<string, any> = any> {
    rootClass: string;
    title?: string;
    rows: LabeledPanelRow<TUI>[];
}

export interface LabeledPanelHandle<TUI extends Record<string, any> = any> {
    root: HTMLElement;
    ui: TUI[];
    destroy: () => void;
}

/**
 * Creates a labeled two-column panel (similar to Obsidian Settings).
 */
export function createLabeledPanel<TUI extends Record<string, any> = any>(
    container: HTMLElement,
    spec: LabeledPanelSpec<TUI>
): LabeledPanelHandle<TUI> {
    const root = container.createDiv({ cls: spec.rootClass });

    if (spec.title) {
        root.createEl('h3', { text: spec.title, cls: 'panel-title' });
    }

    const ui: TUI[] = [];

    for (const row of spec.rows) {
        const rowEl = root.createDiv({ cls: 'labeled-row' });

        // Label column
        const labelCell = rowEl.createDiv({ cls: 'row-label' });
        labelCell.createEl('label', { text: row.label });

        // Control column
        const controlCell = rowEl.createDiv({ cls: 'row-control' });
        const rowUI = row.build(controlCell);
        ui.push(rowUI);
    }

    return {
        root,
        ui,
        destroy() {
            root.remove();
        }
    };
}
