// dev-tools/ui-measurement/dom-utils.ts
// DOM traversal and selection utilities for UI measurement

/**
 * Find the closest ancestor matching a selector
 */
export function findAncestor(element: HTMLElement, selector: string): HTMLElement | null {
  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    if (current.matches(selector)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Extract label/name from an element using a selector
 */
export function extractLabel(container: HTMLElement, selector: string): string {
  const element = container.querySelector(selector);
  return element?.textContent?.trim() || 'unknown';
}

/**
 * Filter elements by visibility
 */
export function isVisible(element: HTMLElement): boolean {
  return element.offsetParent !== null;
}

/**
 * Get computed style properties for an element
 */
export function getComputedStyles(element: HTMLElement, properties: string[]): Record<string, string> {
  const computed = window.getComputedStyle(element);
  const result: Record<string, string> = {};
  for (const prop of properties) {
    result[prop] = computed.getPropertyValue(prop);
  }
  return result;
}

/**
 * Get bounding box dimensions
 */
export function getDimensions(element: HTMLElement): { width: number; height: number; x: number; y: number } {
  const bbox = element.getBoundingClientRect();
  return {
    width: bbox.width,
    height: bbox.height,
    x: bbox.x,
    y: bbox.y,
  };
}

/**
 * Group elements by their ancestor's label
 */
export function groupByAncestor(
  elements: HTMLElement[],
  ancestorSelector: string,
  labelSelector: string
): Map<string, HTMLElement[]> {
  const groups = new Map<string, HTMLElement[]>();

  for (const element of elements) {
    const ancestor = findAncestor(element, ancestorSelector);
    if (!ancestor) continue;

    const label = extractLabel(ancestor, labelSelector);
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(element);
  }

  return groups;
}

/**
 * Wait for DOM changes (useful for animations)
 */
export function waitForAnimation(duration: number = 600): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, duration));
}
