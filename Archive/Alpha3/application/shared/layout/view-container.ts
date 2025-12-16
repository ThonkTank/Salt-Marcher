/**
 * View Container Layout Utilities
 *
 * Shared layout utilities for Obsidian ItemViews.
 * Applies inline styles for consistent flex layouts.
 *
 * @module core/utils/layout/view-container
 */

import type { ItemView } from 'obsidian';

/**
 * Initialize view container with standard flex column layout.
 * Clears existing content and applies flex layout styles.
 *
 * @param view - The Obsidian ItemView
 * @param className - CSS class to add to container
 * @returns The container element ready for layout creation
 */
export function initializeViewContainer(
  view: ItemView,
  className: string
): HTMLElement {
  const container = view.containerEl.children[1] as HTMLElement;
  container.empty();
  container.addClass(className);
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.height = '100%';
  container.style.overflow = 'hidden';
  return container;
}
