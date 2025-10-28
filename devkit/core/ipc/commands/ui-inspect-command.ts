// devkit/core/ipc/commands/ui-inspect-command.ts
// Command to inspect UI element layout and computed styles

import { App } from 'obsidian';
import type { CommandHandler } from '../../../../src/app/ipc-server';
import { logger } from '../../../../src/app/plugin-logger';

interface ElementLayout {
  selector: string;
  tag: string;
  classes: string[];
  text?: string;

  // Dimensions
  width: number;
  height: number;

  // Position
  x: number;
  y: number;

  // Computed styles (relevant for layout debugging)
  display: string;
  position: string;
  flex?: string;
  flexDirection?: string;
  flexWrap?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
  padding?: string;
  margin?: string;
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;
  overflow?: string;
  whiteSpace?: string;

  // Children
  children: ElementLayout[];
}

/**
 * Get computed styles for an element
 */
function getLayoutInfo(element: Element, maxDepth: number, currentDepth = 0): ElementLayout {
  const rect = element.getBoundingClientRect();
  const computed = window.getComputedStyle(element);

  const info: ElementLayout = {
    selector: getSelector(element),
    tag: element.tagName.toLowerCase(),
    classes: Array.from(element.classList),
    width: rect.width,
    height: rect.height,
    x: rect.x,
    y: rect.y,
    display: computed.display,
    position: computed.position,
    children: [],
  };

  // Get text content (only direct text)
  const directText = Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent?.trim())
    .filter(text => text && text.length > 0 && text.length < 30)
    .join(' ');

  if (directText) {
    info.text = directText;
  }

  // Add flexbox properties if element is flex container
  if (computed.display.includes('flex')) {
    info.flex = computed.flex;
    info.flexDirection = computed.flexDirection;
    info.flexWrap = computed.flexWrap;
    info.justifyContent = computed.justifyContent;
    info.alignItems = computed.alignItems;
    info.gap = computed.gap;
  }

  // Add size constraints
  if (computed.minWidth !== '0px') info.minWidth = computed.minWidth;
  if (computed.maxWidth !== 'none') info.maxWidth = computed.maxWidth;
  if (computed.minHeight !== '0px') info.minHeight = computed.minHeight;
  if (computed.maxHeight !== 'none') info.maxHeight = computed.maxHeight;

  // Add spacing
  const padding = computed.padding;
  if (padding !== '0px') info.padding = padding;

  const margin = computed.margin;
  if (margin !== '0px') info.margin = margin;

  // Add overflow
  if (computed.overflow !== 'visible') info.overflow = computed.overflow;
  if (computed.whiteSpace !== 'normal') info.whiteSpace = computed.whiteSpace;

  // Recursively get children
  if (currentDepth < maxDepth) {
    Array.from(element.children).forEach(child => {
      info.children.push(getLayoutInfo(child, maxDepth, currentDepth + 1));
    });
  }

  return info;
}

/**
 * Generate a simple selector for an element
 */
function getSelector(element: Element): string {
  const classes = Array.from(element.classList);
  if (classes.length > 0) {
    return `.${classes[0]}`;
  }
  return element.tagName.toLowerCase();
}

/**
 * Format layout info as readable text
 */
function formatLayout(info: ElementLayout, indent = ''): string[] {
  const lines: string[] = [];

  // Element header
  let line = `${indent}${info.tag}`;
  if (info.classes.length > 0) {
    line += ` .${info.classes.join('.')}`;
  }
  if (info.text) {
    line += ` "${info.text}"`;
  }
  lines.push(line);

  // Dimensions
  lines.push(`${indent}  Size: ${Math.round(info.width)}×${Math.round(info.height)}px`);
  lines.push(`${indent}  Position: (${Math.round(info.x)}, ${Math.round(info.y)})`);
  lines.push(`${indent}  Display: ${info.display}`);

  // Flexbox
  if (info.display.includes('flex')) {
    lines.push(`${indent}  Flex: direction=${info.flexDirection}, wrap=${info.flexWrap}`);
    if (info.justifyContent !== 'normal') {
      lines.push(`${indent}        justify=${info.justifyContent}, align=${info.alignItems}`);
    }
    if (info.gap !== 'normal 0px' && info.gap !== '0px') {
      lines.push(`${indent}        gap=${info.gap}`);
    }
  }

  // Constraints
  const constraints: string[] = [];
  if (info.minWidth) constraints.push(`min-w: ${info.minWidth}`);
  if (info.maxWidth) constraints.push(`max-w: ${info.maxWidth}`);
  if (info.minHeight) constraints.push(`min-h: ${info.minHeight}`);
  if (info.maxHeight) constraints.push(`max-h: ${info.maxHeight}`);
  if (constraints.length > 0) {
    lines.push(`${indent}  Constraints: ${constraints.join(', ')}`);
  }

  // Spacing
  if (info.padding && info.padding !== '0px') {
    lines.push(`${indent}  Padding: ${info.padding}`);
  }
  if (info.margin && info.margin !== '0px') {
    lines.push(`${indent}  Margin: ${info.margin}`);
  }

  // Overflow
  if (info.overflow) {
    lines.push(`${indent}  Overflow: ${info.overflow}`);
  }
  if (info.whiteSpace) {
    lines.push(`${indent}  White-space: ${info.whiteSpace}`);
  }

  // Children
  if (info.children.length > 0) {
    lines.push(`${indent}  Children (${info.children.length}):`);
    info.children.forEach(child => {
      lines.push(...formatLayout(child, indent + '    '));
    });
  }

  return lines;
}

/**
 * Inspect UI element layout
 */
export const inspectUI: CommandHandler = async (app: App, args: string[]) => {
  const [selector = '.sm-cc-entry-head', maxDepthStr = '2'] = args;
  const maxDepth = parseInt(maxDepthStr, 10);

  logger.log('[IPC-CMD] Inspecting UI layout:', { selector, maxDepth });

  const element = document.querySelector(selector);
  if (!element) {
    return {
      success: false,
      error: `Element not found: ${selector}`,
    };
  }

  try {
    const layout = getLayoutInfo(element, maxDepth);
    const formatted = formatLayout(layout);
    const report = formatted.join('\n');

    logger.log('[IPC-CMD] UI Layout:\n' + report);

    return {
      success: true,
      selector,
      maxDepth,
      layout,
      report,
    };
  } catch (error) {
    logger.error('[IPC-CMD] UI inspect failed:', error);
    return { success: false, error: String(error) };
  }
};
