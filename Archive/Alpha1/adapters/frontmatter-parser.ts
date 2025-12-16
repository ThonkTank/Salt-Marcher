// src/utils/frontmatter-parser.ts
// Simple YAML frontmatter parser for markdown files

/**
 * Parse result containing frontmatter and body
 */
export interface ParsedFrontmatter {
	/** Parsed frontmatter as object */
	frontmatter: Record<string, any>;
	/** Markdown body content (without frontmatter) */
	body: string;
	/** Raw frontmatter string */
	rawFrontmatter: string;
}

/**
 * Parse markdown content with YAML frontmatter
 *
 * **Format:**
 * ```markdown
 * ---
 * key: value
 * nested:
 *   key: value
 * ---
 *
 * Body content here
 * ```
 *
 * **Usage:**
 * ```typescript
 * const content = await app.vault.read(file);
 * const parsed = parseFrontmatter(content);
 * console.log(parsed.frontmatter.name);
 * console.log(parsed.body);
 * ```
 */
export function parseFrontmatter(content: string): ParsedFrontmatter {
	const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

	if (!match) {
		return {
			frontmatter: {},
			body: content,
			rawFrontmatter: "",
		};
	}

	const rawFrontmatter = match[1];
	const body = match[2];

	// Simple YAML parsing (supports basic key: value pairs)
	const frontmatter: Record<string, any> = {};
	const lines = rawFrontmatter.split("\n");

	for (const line of lines) {
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) continue;

		const key = line.substring(0, colonIndex).trim();
		const value = line.substring(colonIndex + 1).trim();

		if (!key) continue;

		// Parse value
		if (value === "true") {
			frontmatter[key] = true;
		} else if (value === "false") {
			frontmatter[key] = false;
		} else if (!isNaN(Number(value)) && value !== "") {
			frontmatter[key] = Number(value);
		} else if (value.startsWith('"') && value.endsWith('"')) {
			frontmatter[key] = value.slice(1, -1);
		} else if (value.startsWith("[") && value.endsWith("]")) {
			// Simple array parsing
			try {
				frontmatter[key] = JSON.parse(value);
			} catch {
				frontmatter[key] = value;
			}
		} else {
			frontmatter[key] = value;
		}
	}

	return {
		frontmatter,
		body,
		rawFrontmatter,
	};
}

/**
 * Serialize frontmatter and body back to markdown
 *
 * **Usage:**
 * ```typescript
 * const content = serializeFrontmatter({
 *   name: "Dragon",
 *   cr: 10,
 *   attunement: true
 * }, "# Dragon\n\nPowerful creature!");
 * ```
 */
export function serializeFrontmatter(
	frontmatter: Record<string, any>,
	body: string
): string {
	const lines = Object.entries(frontmatter).map(([key, value]) => {
		if (typeof value === "object" && !Array.isArray(value)) {
			return `${key}: ${JSON.stringify(value)}`;
		} else if (Array.isArray(value)) {
			return `${key}: ${JSON.stringify(value)}`;
		} else if (typeof value === "string" && (value.includes(":") || value.includes("\n"))) {
			return `${key}: "${value}"`;
		} else {
			return `${key}: ${value}`;
		}
	});

	return `---\n${lines.join("\n")}\n---\n${body}`;
}
