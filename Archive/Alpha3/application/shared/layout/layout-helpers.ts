/**
 * Layout Helper Utilities
 *
 * Reusable DOM layout utilities for Obsidian views.
 * Applies inline styles for consistent flex layouts.
 *
 * @module core/utils/layout/layout-helpers
 */

/**
 * Style top bar / header element with flex layout and border.
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
  el.style.flexShrink = '0';
}

/**
 * Create a flex container (row or column).
 *
 * @param container - Parent element
 * @param className - CSS class to add
 * @param direction - Flex direction ('row' or 'column')
 * @returns The created flex container
 */
export function createFlexContainer(
  container: HTMLElement,
  className: string,
  direction: 'row' | 'column' = 'row'
): HTMLElement {
  const el = container.createDiv({ cls: className });
  el.style.display = 'flex';
  el.style.flexDirection = direction;
  el.style.flex = '1';
  el.style.overflow = 'hidden';
  // Critical: min-height/min-width 0 allows flex children to shrink below content size
  el.style.minHeight = '0';
  el.style.minWidth = '0';
  return el;
}

/**
 * Style an element as a map/canvas container.
 * Takes remaining space with relative positioning for overlays.
 *
 * @param el - The element to style
 */
export function styleMapContainer(el: HTMLElement): void {
  el.style.flex = '1';
  el.style.position = 'relative';
  el.style.overflow = 'hidden';
  el.style.minWidth = '0';
  el.style.minHeight = '0';
}

/**
 * Create a side panel with fixed width and scrolling.
 *
 * @param container - Parent element
 * @param className - CSS class to add
 * @param width - Fixed width in pixels
 * @param side - Which side ('left' or 'right')
 * @returns The created panel element
 */
export function createSidePanel(
  container: HTMLElement,
  className: string,
  width: number,
  side: 'left' | 'right' = 'right'
): HTMLElement {
  const panel = container.createDiv({ cls: className });
  panel.style.width = `${width}px`;
  panel.style.flexShrink = '0';
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
 * Style a panel content container with padding and flex column layout.
 * Use for sidebar panel content areas.
 *
 * @param el - The element to style
 */
export function stylePanelContainer(el: HTMLElement): void {
  el.style.padding = '12px';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.gap = '12px';
}
