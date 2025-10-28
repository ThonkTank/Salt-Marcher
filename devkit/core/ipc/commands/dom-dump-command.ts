// devkit/core/ipc/commands/dom-dump-command.ts
// Command to dump DOM structure as ASCII tree for better debugging

import { App } from 'obsidian';
import type { CommandHandler } from '../../../../src/app/ipc-server';
import { logger } from '../../../../src/app/plugin-logger';

interface DOMNodeInfo {
  tag: string;
  classes: string[];
  text?: string;
  attrs?: Record<string, string>;
  children: DOMNodeInfo[];
}

/**
 * Convert DOM element to structured info
 */
function elementToInfo(element: Element, maxDepth: number, currentDepth = 0): DOMNodeInfo {
  const info: DOMNodeInfo = {
    tag: element.tagName.toLowerCase(),
    classes: Array.from(element.classList),
    children: [],
  };

  // Add interesting attributes
  const attrs: Record<string, string> = {};
  if (element.hasAttribute('placeholder')) attrs.placeholder = element.getAttribute('placeholder')!;
  if (element.hasAttribute('type')) attrs.type = element.getAttribute('type')!;
  if (element.hasAttribute('value') && element instanceof HTMLInputElement) {
    attrs.value = element.value;
  }
  if (element.hasAttribute('aria-expanded')) attrs['aria-expanded'] = element.getAttribute('aria-expanded')!;
  if (element.hasAttribute('title')) attrs.title = element.getAttribute('title')!;

  if (Object.keys(attrs).length > 0) {
    info.attrs = attrs;
  }

  // Get text content (only direct text, not from children)
  const directText = Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent?.trim())
    .filter(text => text && text.length > 0 && text.length < 50)
    .join(' ');

  if (directText) {
    info.text = directText;
  }

  // Recursively process children (up to maxDepth)
  if (currentDepth < maxDepth) {
    Array.from(element.children).forEach(child => {
      info.children.push(elementToInfo(child, maxDepth, currentDepth + 1));
    });
  }

  return info;
}

/**
 * Convert DOM info to ASCII tree
 */
function infoToASCII(info: DOMNodeInfo, prefix = '', isLast = true): string[] {
  const lines: string[] = [];

  // Current node line
  const connector = isLast ? '└─ ' : '├─ ';
  const nodePrefix = prefix + connector;

  let nodeLine = `${nodePrefix}<${info.tag}>`;

  // Add classes
  if (info.classes.length > 0) {
    const classList = info.classes.map(c => `.${c}`).join('');
    nodeLine += ` ${classList}`;
  }

  // Add attributes
  if (info.attrs) {
    const attrStr = Object.entries(info.attrs)
      .map(([key, val]) => `${key}="${val}"`)
      .join(' ');
    nodeLine += ` [${attrStr}]`;
  }

  // Add text
  if (info.text) {
    nodeLine += ` "${info.text}"`;
  }

  lines.push(nodeLine);

  // Process children
  const childPrefix = prefix + (isLast ? '   ' : '│  ');
  info.children.forEach((child, index) => {
    const childIsLast = index === info.children.length - 1;
    const childLines = infoToASCII(child, childPrefix, childIsLast);
    lines.push(...childLines);
  });

  return lines;
}

/**
 * Dump DOM structure as ASCII tree
 */
export const dumpDOM: CommandHandler = async (app: App, args: string[]) => {
  const [selector = '.sm-cc-entry-list', maxDepthStr = '5'] = args;
  const maxDepth = parseInt(maxDepthStr, 10);

  logger.log('[IPC-CMD] Dumping DOM structure:', { selector, maxDepth });

  const element = document.querySelector(selector);
  if (!element) {
    return {
      success: false,
      error: `Element not found: ${selector}`,
    };
  }

  try {
    // Convert DOM to structured info
    const info = elementToInfo(element, maxDepth);

    // Convert to ASCII tree
    const lines = infoToASCII(info);
    const ascii = lines.join('\n');

    logger.log('[IPC-CMD] DOM structure:\n' + ascii);

    return {
      success: true,
      selector,
      maxDepth,
      ascii,
      info, // Also return structured data for programmatic use
    };
  } catch (error) {
    logger.error('[IPC-CMD] DOM dump failed:', error);
    return { success: false, error: String(error) };
  }
};
