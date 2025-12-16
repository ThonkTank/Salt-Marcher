/**
 * Salt Marcher Protocol Handler
 *
 * Purpose: Handle salt-marcher:// protocol links for entity navigation
 * Location: src/services/protocol/salt-marcher-protocol.ts
 *
 * **Features:**
 * - Register salt-marcher:// custom protocol
 * - Handle entity links with type-aware routing
 * - Open entities in appropriate views
 * - Support cross-entity references
 * - Deep linking within application
 *
 * **Protocol Format:**
 * - salt-marcher://entity/{type}/{id} - Direct entity reference
 * - salt-marcher://view/{workmode}/{path} - View navigation
 * - salt-marcher://action/{command} - Action triggering
 *
 * **Usage:**
 * ```typescript
 * const handler = new SaltMarcherProtocolHandler(app);
 * await handler.initialize();
 *
 * // Now clicking links like [Dragon](salt-marcher://entity/creature/1) works
 * ```
 */

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('salt-marcher-protocol');

/**
 * Protocol link types
 */
export type SaltMarcherLinkType = "entity" | "view" | "action";

/**
 * Parsed protocol link
 */
export interface ParsedProtocolLink {
	/** Link type */
	type: SaltMarcherLinkType;
	/** Entity type (for entity links) */
	entityType?: string;
	/** Entity ID (for entity links) */
	entityId?: string | number;
	/** Workmode (for view links) */
	workmode?: string;
	/** Path within workmode (for view links) */
	path?: string;
	/** Command/action name */
	command?: string;
	/** Additional parameters */
	params?: Record<string, string>;
}

/**
 * Handler for entity link clicks
 */
export type EntityLinkHandler = (
	entityType: string,
	entityId: string | number
) => Promise<void>;

/**
 * Salt Marcher Protocol Handler
 *
 * Manages custom protocol links and entity navigation
 */
export class SaltMarcherProtocolHandler {
	private entityLinkHandlers = new Map<string, EntityLinkHandler>();
	private viewLinkHandlers = new Map<string, (path: string) => Promise<void>>();
	private actionHandlers = new Map<string, (params: Record<string, string>) => Promise<void>>();
	private initialized = false;

	constructor(private readonly app: App) {}

	/**
	 * Initialize protocol handler
	 *
	 * Registers with Obsidian and sets up link handlers
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			// Register protocol handler with Obsidian
			this.registerProtocolHandler();

			// Setup default handlers
			this.setupDefaultHandlers();

			this.initialized = true;
			logger.debug("Initialized");
		} catch (err) {
			logger.error("Initialization failed:", err);
			throw err;
		}
	}

	/**
	 * Register custom protocol with Obsidian
	 */
	private registerProtocolHandler(): void {
		// Register the custom protocol scheme
		// Note: Obsidian's protocol API may vary by version
		// This implementation uses duck-typing for compatibility
		const protocol = (this.app as any).protocol;
		if (protocol && typeof protocol.registerStringCommand === "function") {
			protocol.registerStringCommand(
				"salt-marcher",
				(path: string) => this.handleProtocolLink(path)
			);
			logger.debug("Protocol registered");
		} else {
			logger.debug("Protocol API not available in this Obsidian version");
		}
	}

	/**
	 * Setup default link handlers for common entity types
	 */
	private setupDefaultHandlers(): void {
		// Creature handler
		this.registerEntityLinkHandler("creature", async (id) => {
			logger.debug(`Opening creature ${id}`);
			// Implementation would open the creature view
			// For now, just log the action
		});

		// Spell handler
		this.registerEntityLinkHandler("spell", async (id) => {
			logger.debug(`Opening spell ${id}`);
		});

		// Item handler
		this.registerEntityLinkHandler("item", async (id) => {
			logger.debug(`Opening item ${id}`);
		});

		// NPC handler
		this.registerEntityLinkHandler("npc", async (id) => {
			logger.debug(`Opening NPC ${id}`);
		});

		// Faction handler
		this.registerEntityLinkHandler("faction", async (id) => {
			logger.debug(`Opening faction ${id}`);
		});

		// Location handler
		this.registerEntityLinkHandler("location", async (id) => {
			logger.debug(`Opening location ${id}`);
		});
	}

	/**
	 * Handle protocol link invocation
	 *
	 * @param path - Protocol path (e.g., "entity/creature/1")
	 */
	private async handleProtocolLink(path: string): Promise<void> {
		try {
			const link = this.parseProtocolLink(path);
			if (!link) {
				logger.warn(`Invalid protocol link: ${path}`);
				return;
			}

			switch (link.type) {
				case "entity":
					await this.handleEntityLink(link.entityType!, link.entityId!);
					break;
				case "view":
					await this.handleViewLink(link.workmode!, link.path!);
					break;
				case "action":
					await this.handleActionLink(link.command!, link.params ?? {});
					break;
			}
		} catch (err) {
			logger.error(`Error handling protocol link:`, err);
		}
	}

	/**
	 * Handle entity link
	 *
	 * @param entityType - Entity type (creature, spell, etc.)
	 * @param entityId - Entity ID
	 */
	private async handleEntityLink(entityType: string, entityId: string | number): Promise<void> {
		const handler = this.entityLinkHandlers.get(entityType);
		if (handler) {
			await handler(entityType, entityId);
		} else {
			logger.warn(`No handler for entity type: ${entityType}`);
		}
	}

	/**
	 * Handle view link
	 *
	 * @param workmode - Workmode name (library, cartographer, etc.)
	 * @param path - Path within workmode
	 */
	private async handleViewLink(workmode: string, path: string): Promise<void> {
		const handler = this.viewLinkHandlers.get(workmode);
		if (handler) {
			await handler(path);
		} else {
			logger.warn(`No handler for workmode: ${workmode}`);
		}
	}

	/**
	 * Handle action link
	 *
	 * @param command - Action command
	 * @param params - Action parameters
	 */
	private async handleActionLink(command: string, params: Record<string, string>): Promise<void> {
		const handler = this.actionHandlers.get(command);
		if (handler) {
			await handler(params);
		} else {
			logger.warn(`No handler for action: ${command}`);
		}
	}

	/**
	 * Register handler for entity type link
	 *
	 * @param entityType - Entity type
	 * @param handler - Link handler function
	 */
	registerEntityLinkHandler(entityType: string, handler: EntityLinkHandler): void {
		this.entityLinkHandlers.set(entityType, handler);
		logger.debug(`Registered entity handler: ${entityType}`);
	}

	/**
	 * Register handler for workmode view link
	 *
	 * @param workmode - Workmode name
	 * @param handler - View handler function
	 */
	registerViewLinkHandler(workmode: string, handler: (path: string) => Promise<void>): void {
		this.viewLinkHandlers.set(workmode, handler);
		logger.debug(`Registered view handler: ${workmode}`);
	}

	/**
	 * Register handler for action link
	 *
	 * @param command - Action command
	 * @param handler - Action handler function
	 */
	registerActionHandler(
		command: string,
		handler: (params: Record<string, string>) => Promise<void>
	): void {
		this.actionHandlers.set(command, handler);
		logger.debug(`Registered action handler: ${command}`);
	}

	/**
	 * Create entity link URL
	 *
	 * @param entityType - Entity type
	 * @param entityId - Entity ID
	 * @returns salt-marcher protocol URL
	 */
	createEntityLink(entityType: string, entityId: string | number): string {
		return `salt-marcher://entity/${entityType}/${entityId}`;
	}

	/**
	 * Create view link URL
	 *
	 * @param workmode - Workmode name
	 * @param path - Path within workmode
	 * @returns salt-marcher protocol URL
	 */
	createViewLink(workmode: string, path: string): string {
		const encodedPath = encodeURIComponent(path);
		return `salt-marcher://view/${workmode}/${encodedPath}`;
	}

	/**
	 * Create action link URL
	 *
	 * @param command - Action command
	 * @param params - Action parameters
	 * @returns salt-marcher protocol URL
	 */
	createActionLink(command: string, params?: Record<string, string>): string {
		let url = `salt-marcher://action/${command}`;
		if (params) {
			const queryParts: string[] = [];
			for (const key in params) {
				if (Object.prototype.hasOwnProperty.call(params, key)) {
					const value = params[key];
					queryParts.push(
						`${encodeURIComponent(key)}=${encodeURIComponent(value)}`
					);
				}
			}
			if (queryParts.length > 0) {
				url += `?${queryParts.join("&")}`;
			}
		}
		return url;
	}

	/**
	 * Parse protocol link
	 *
	 * @param path - Protocol path
	 * @returns Parsed protocol link or null
	 */
	parseProtocolLink(path: string): ParsedProtocolLink | null {
		// Entity links: entity/{type}/{id}
		const entityMatch = path.match(/^entity\/([^/]+)\/(.+)$/);
		if (entityMatch) {
			const [, entityType, entityIdStr] = entityMatch;
			const entityId = isNaN(Number(entityIdStr)) ? entityIdStr : Number(entityIdStr);
			return { type: "entity", entityType, entityId };
		}

		// View links: view/{workmode}/{path}
		const viewMatch = path.match(/^view\/([^/]+)\/(.+)$/);
		if (viewMatch) {
			const [, workmode, pathPart] = viewMatch;
			const decodedPath = decodeURIComponent(pathPart);
			return { type: "view", workmode, path: decodedPath };
		}

		// Action links: action/{command}?params
		const actionMatch = path.match(/^action\/([^/?]+)(\?(.+))?$/);
		if (actionMatch) {
			const [, command, , queryString] = actionMatch;
			const params: Record<string, string> = {};

			if (queryString) {
				// Manual parsing to avoid URLSearchParams iterator issues
				const pairs = queryString.split("&");
				for (const pair of pairs) {
					const [key, value] = pair.split("=");
					if (key) {
						params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : "";
					}
				}
			}

			return { type: "action", command, params };
		}

		return null;
	}

	/**
	 * Generate markdown link
	 *
	 * @param text - Link text
	 * @param url - URL (can be salt-marcher protocol or regular)
	 * @returns Markdown link
	 */
	createMarkdownLink(text: string, url: string): string {
		return `[${text}](${url})`;
	}

	/**
	 * Generate markdown link to entity
	 *
	 * @param text - Link text
	 * @param entityType - Entity type
	 * @param entityId - Entity ID
	 * @returns Markdown link using protocol
	 */
	createMarkdownEntityLink(text: string, entityType: string, entityId: string | number): string {
		const url = this.createEntityLink(entityType, entityId);
		return this.createMarkdownLink(text, url);
	}

	/**
	 * Cleanup protocol handler
	 */
	async cleanup(): Promise<void> {
		this.entityLinkHandlers.clear();
		this.viewLinkHandlers.clear();
		this.actionHandlers.clear();
		this.initialized = false;
		logger.debug("Cleaned up");
	}
}
