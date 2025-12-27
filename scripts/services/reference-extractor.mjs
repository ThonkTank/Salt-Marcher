/**
 * Reference Extractor Service
 *
 * Extracts "Lies auch" references from documentation files.
 *
 * KANONISCHES FORMAT (einziges erlaubtes):
 *   > **Lies auch:** [Link](path), [Link](path)
 *
 * Deprecated formats generate warnings:
 *   - *Siehe auch: [Link](path) | [Link](path)*
 *   - → Siehe auch: [Link](path)
 */

import { dirname, resolve, normalize } from 'path';

// EINZIGES erlaubtes Pattern
const CANONICAL_PATTERN = /^>\s*\*\*Lies auch:\*\*\s*(.+)/gm;

// Deprecated Patterns (erzeugen Warnungen)
const DEPRECATED_PATTERNS = [
  { pattern: /\*Siehe auch:\s*.+\*/g, name: 'Italics-Format (*Siehe auch: ...*)' },
  { pattern: /→\s*Siehe auch:\s*.+/g, name: 'Arrow-Format (→ Siehe auch: ...)' }
];

// Pattern to extract markdown links: [text](path)
const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Resolves a relative path against a document's directory
 */
function resolvePath(relativePath, docPath) {
  const docDir = dirname(docPath);
  const absolutePath = resolve(docDir, relativePath);
  return normalize(absolutePath);
}

/**
 * Extracts all markdown links from a reference line
 */
function extractLinks(line, docPath) {
  const links = [];
  let match;

  LINK_PATTERN.lastIndex = 0;
  while ((match = LINK_PATTERN.exec(line)) !== null) {
    const [, text, relativePath] = match;

    // Skip external URLs and anchors
    if (relativePath.startsWith('http') || relativePath.startsWith('#')) {
      continue;
    }

    // Remove any anchor from the path
    const pathWithoutAnchor = relativePath.split('#')[0];

    if (pathWithoutAnchor) {
      links.push({
        path: resolvePath(pathWithoutAnchor, docPath),
        text: text.trim()
      });
    }
  }

  return links;
}

/**
 * Extracts references from a document using the canonical format.
 * Returns warnings for deprecated formats.
 *
 * @param {string} docContent - The content of the documentation file
 * @param {string} docPath - The absolute path of the documentation file
 * @returns {{ refs: Array<{path: string, text: string}>, warnings: string[] }}
 */
export function extractReferences(docContent, docPath) {
  const refs = [];
  const warnings = [];

  // 1. Extract canonical format
  let match;
  CANONICAL_PATTERN.lastIndex = 0;
  while ((match = CANONICAL_PATTERN.exec(docContent)) !== null) {
    const links = extractLinks(match[1], docPath);
    refs.push(...links);
  }

  // 2. Check for deprecated formats → warnings
  for (const { pattern, name } of DEPRECATED_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(docContent)) {
      warnings.push(`${docPath}: Verwendet deprecated ${name}`);
    }
  }

  return { refs, warnings };
}

/**
 * Deduplicates an array of references by path
 */
export function deduplicateRefs(refs) {
  const seen = new Set();
  const unique = [];

  for (const ref of refs) {
    if (!seen.has(ref.path)) {
      seen.add(ref.path);
      unique.push(ref);
    }
  }

  return unique;
}
