/**
 * YAML Frontmatter Utils
 *
 * Parse and serialize Markdown files with YAML frontmatter.
 * Uses Obsidian's built-in YAML parser.
 *
 * @module utils/file/yaml-frontmatter
 */

import { parseYaml, stringifyYaml } from 'obsidian';

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed frontmatter document
 */
export type FrontmatterDocument<T> = {
	/** Parsed YAML data */
	data: T;
	/** Markdown body (without frontmatter) */
	body: string;
};

/**
 * Result of parsing with potential errors
 */
export type ParseResult<T> =
	| { success: true; document: FrontmatterDocument<T> }
	| { success: false; error: string };

// ============================================================================
// Constants
// ============================================================================

const FRONTMATTER_DELIMITER = '---';
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

// ============================================================================
// Functions
// ============================================================================

/**
 * Parse a Markdown file with YAML frontmatter.
 *
 * @param content - Raw file content
 * @returns Parsed document or error
 */
export function parseFrontmatter<T>(content: string): ParseResult<T> {
	const match = content.match(FRONTMATTER_REGEX);

	if (!match) {
		// No frontmatter found - treat entire content as body with empty data
		return {
			success: true,
			document: {
				data: {} as T,
				body: content.trim(),
			},
		};
	}

	const [, yamlContent, bodyContent] = match;

	try {
		const data = parseYaml(yamlContent) as T;
		return {
			success: true,
			document: {
				data: data ?? ({} as T),
				body: bodyContent.trim(),
			},
		};
	} catch (e) {
		return {
			success: false,
			error: `Failed to parse YAML: ${e instanceof Error ? e.message : String(e)}`,
		};
	}
}

/**
 * Serialize data and body to a Markdown file with YAML frontmatter.
 *
 * @param data - Data to serialize as YAML frontmatter
 * @param body - Markdown body content
 * @returns Serialized file content
 */
export function serializeFrontmatter<T extends Record<string, unknown>>(
	data: T,
	body: string = ''
): string {
	const yamlContent = stringifyYaml(data).trim();
	const trimmedBody = body.trim();

	if (trimmedBody) {
		return `${FRONTMATTER_DELIMITER}\n${yamlContent}\n${FRONTMATTER_DELIMITER}\n\n${trimmedBody}\n`;
	}

	return `${FRONTMATTER_DELIMITER}\n${yamlContent}\n${FRONTMATTER_DELIMITER}\n`;
}

/**
 * Check if content has valid frontmatter.
 *
 * @param content - Raw file content
 * @returns True if frontmatter is present
 */
export function hasFrontmatter(content: string): boolean {
	return FRONTMATTER_REGEX.test(content);
}

/**
 * Extract just the frontmatter data without parsing the full document.
 * Useful for quick index building.
 *
 * @param content - Raw file content
 * @returns Parsed data or null if invalid
 */
export function extractFrontmatterData<T>(content: string): T | null {
	const result = parseFrontmatter<T>(content);
	return result.success ? result.document.data : null;
}
