/**
 * Layout Helper Utilities
 *
 * Reusable DOM layout utilities for Obsidian views.
 * Eliminates duplicate layout styling code across views.
 *
 * @module adapters/shared/layout-helpers
 */

// ============================================================================
// Flex Containers
// ============================================================================

/**
 * Creates a flex container with standard overflow handling.
 * Used for main content areas that contain scrollable children.
 *
 * @example
 * const content = createFlexContainer(container, 'my-content');
 */
export function createFlexContainer(
	container: HTMLElement,
	className: string,
	direction: 'row' | 'column' = 'row'
): HTMLElement {
	const content = container.createDiv({ cls: className });
	content.style.display = 'flex';
	content.style.flexDirection = direction;
	content.style.flex = '1';
	content.style.overflow = 'hidden';
	return content;
}

/**
 * Creates an action button group container.
 *
 * @example
 * const actions = createActionGroup(header);
 * actions.createEl('button', { text: 'Save' });
 */
export function createActionGroup(container: HTMLElement, className?: string): HTMLElement {
	const actions = container.createDiv({ cls: className ?? 'action-buttons' });
	actions.style.display = 'flex';
	actions.style.gap = '8px';
	actions.style.alignItems = 'center';
	return actions;
}

// ============================================================================
// Panel Containers
// ============================================================================

/**
 * Styles a container as a map canvas area.
 *
 * @example
 * const mapContainer = content.createDiv({ cls: 'map-container' });
 * styleMapContainer(mapContainer);
 */
export function styleMapContainer(
	container: HTMLElement,
	backgroundColor = '#1e1e1e'
): void {
	container.style.flex = '1';
	container.style.position = 'relative';
	container.style.overflow = 'hidden';
	container.style.backgroundColor = backgroundColor;
}

/**
 * Creates a sidebar panel with border and scrolling.
 *
 * @example
 * const panel = createSidePanel(content, 'tools-panel', 200, 'left');
 */
export function createSidePanel(
	container: HTMLElement,
	className: string,
	width: number,
	side: 'left' | 'right' = 'right'
): HTMLElement {
	const panel = container.createDiv({ cls: className });
	panel.style.width = `${width}px`;
	panel.style.overflowY = 'auto';
	panel.style.backgroundColor = 'var(--background-secondary)';

	if (side === 'left') {
		panel.style.borderRight = '1px solid var(--background-modifier-border)';
	} else {
		panel.style.borderLeft = '1px solid var(--background-modifier-border)';
	}

	return panel;
}

/**
 * Styles a panel with padding and column layout.
 *
 * @example
 * stylePanelContent(toolPanel);
 */
export function stylePanelContent(
	panel: HTMLElement,
	padding = '12px',
	gap = '12px'
): void {
	panel.style.padding = padding;
	panel.style.display = 'flex';
	panel.style.flexDirection = 'column';
	panel.style.gap = gap;
}

// ============================================================================
// Visual Elements
// ============================================================================

/**
 * Creates a horizontal divider.
 *
 * @example
 * createDivider(container);
 */
export function createDivider(container: HTMLElement): HTMLElement {
	const divider = container.createEl('hr');
	divider.style.margin = '4px 0';
	divider.style.border = 'none';
	divider.style.borderTop = '1px solid var(--background-modifier-border)';
	return divider;
}

/**
 * Creates a hint/placeholder message for empty states.
 *
 * @example
 * createEmptyHint(container, 'Click a tile to inspect');
 */
export function createEmptyHint(
	container: HTMLElement,
	message: string,
	className = 'empty-hint'
): HTMLElement {
	const hint = container.createDiv({ cls: className });
	hint.style.color = 'var(--text-muted)';
	hint.style.textAlign = 'center';
	hint.style.padding = '20px 0';
	hint.textContent = message;
	return hint;
}

// ============================================================================
// Grid Layouts
// ============================================================================

/**
 * Creates a responsive grid container.
 *
 * @example
 * const grid = createGrid(container, 2, '12px');
 */
export function createGrid(
	container: HTMLElement,
	columns: number,
	gap = '12px',
	className = 'grid'
): HTMLElement {
	const grid = container.createDiv({ cls: className });
	grid.style.display = 'grid';
	grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
	grid.style.gap = gap;
	return grid;
}

// ============================================================================
// Detail Header
// ============================================================================

/**
 * Creates a detail header with title and action buttons.
 *
 * @example
 * const { header, title, actions } = createDetailHeader(container, 'Creature Name');
 */
export function createDetailHeader(
	container: HTMLElement,
	titleText: string,
	className = 'detail-header'
): { header: HTMLElement; title: HTMLElement; actions: HTMLElement } {
	const header = container.createDiv({ cls: className });
	header.style.display = 'flex';
	header.style.justifyContent = 'space-between';
	header.style.alignItems = 'center';
	header.style.marginBottom = '16px';

	const title = header.createEl('h2');
	title.style.margin = '0';
	title.textContent = titleText;

	const actions = createActionGroup(header);

	return { header, title, actions };
}
