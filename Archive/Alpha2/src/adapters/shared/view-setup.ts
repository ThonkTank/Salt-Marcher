/**
 * View Setup Utilities
 *
 * Shared initialization patterns for Obsidian ItemViews.
 * Eliminates duplicate container setup code across views.
 *
 * @module adapters/shared/view-setup
 */

import type { ItemView } from 'obsidian';

export interface ViewSetupOptions {
	/** CSS class to add to container */
	className: string;
}

/**
 * Initialize view container with standard flex layout.
 * Clears existing content and applies consistent styling.
 *
 * @param view - The Obsidian ItemView
 * @param options - Configuration options
 * @returns The container element ready for layout creation
 */
export function initializeViewContainer(
	view: ItemView,
	options: ViewSetupOptions
): HTMLElement {
	const container = view.containerEl.children[1] as HTMLElement;
	container.empty();
	container.addClass(options.className);
	container.style.display = 'flex';
	container.style.flexDirection = 'column';
	container.style.height = '100%';
	return container;
}

/**
 * Apply standard header/top bar styling.
 * Consistent look across all plugin views.
 *
 * @param el - The header element to style
 */
export function styleTopBar(el: HTMLElement): void {
	el.style.display = 'flex';
	el.style.justifyContent = 'space-between';
	el.style.alignItems = 'center';
	el.style.padding = '8px 12px';
	el.style.borderBottom = '1px solid var(--background-modifier-border)';
	el.style.backgroundColor = 'var(--background-secondary)';
}
