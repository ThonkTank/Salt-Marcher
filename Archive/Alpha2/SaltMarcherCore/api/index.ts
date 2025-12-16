/**
 * Public API
 *
 * SaltMarcherAPI exposed via window for extension plugins.
 * This is the ONLY interface extensions should use to interact with Core.
 *
 * @module SaltMarcherCore/api
 */

import type { ISessionService, ISessionPanel } from '../../Shared/schemas/session';
import type { SessionEvent, SessionEventType } from '../../Shared/schemas/events';
import type { ILibraryStore } from '../../Shared/schemas/library';
import type { EventBus } from '../services/event-bus';
import type { ServiceRegistry } from '../services/service-registry';
import type { PanelRegistry } from '../services/panel-registry';

// ============================================================================
// API Interface
// ============================================================================

/**
 * Public API for SaltMarcher extension plugins.
 * Exposed on window.SaltMarcherAPI.
 */
export interface SaltMarcherAPI {
	/** API version for compatibility checking */
	readonly version: string;

	// ========================================================================
	// Service Management
	// ========================================================================

	/**
	 * Register a session service.
	 * Extension plugins call this in their onload().
	 */
	registerService(service: ISessionService): void;

	/**
	 * Unregister a session service.
	 * Extension plugins call this in their onunload().
	 */
	unregisterService(serviceId: string): void;

	/**
	 * Get a registered service by ID.
	 * Returns undefined if not found.
	 */
	getService<T>(serviceId: string): T | undefined;

	// ========================================================================
	// Panel Management
	// ========================================================================

	/**
	 * Register a UI panel.
	 * Extension plugins call this to add panels to the Session Runner.
	 */
	registerPanel(panel: ISessionPanel): void;

	/**
	 * Unregister a UI panel.
	 */
	unregisterPanel(panelId: string): void;

	// ========================================================================
	// Event Bus
	// ========================================================================

	/**
	 * Emit an event to the event bus.
	 * Other services/panels can subscribe to these events.
	 */
	emit<T>(type: SessionEventType, source: string, data: T): void;

	/**
	 * Subscribe to events of a specific type.
	 * @returns Unsubscribe function
	 */
	on<T>(type: SessionEventType, handler: (event: SessionEvent<T>) => void): () => void;

	// ========================================================================
	// Library Access
	// ========================================================================

	/**
	 * Get the library store for data management.
	 */
	getLibraryStore(): ILibraryStore;
}

// ============================================================================
// API Factory
// ============================================================================

/**
 * Create the public API object.
 * Called by SaltMarcherCore plugin on load.
 */
export function createAPI(
	eventBus: EventBus,
	serviceRegistry: ServiceRegistry,
	panelRegistry: PanelRegistry,
	libraryStore: ILibraryStore
): SaltMarcherAPI {
	return {
		version: '1.0.0',

		// Service Management
		registerService: (service) => serviceRegistry.register(service),
		unregisterService: (id) => serviceRegistry.unregister(id),
		getService: <T>(id: string) => serviceRegistry.get(id) as T | undefined,

		// Panel Management
		registerPanel: (panel) => panelRegistry.register(panel),
		unregisterPanel: (id) => panelRegistry.unregister(id),

		// Event Bus
		emit: (type, source, data) => eventBus.emit(type, source, data),
		on: (type, handler) => eventBus.on(type, handler),

		// Library
		getLibraryStore: () => libraryStore,
	};
}

// ============================================================================
// Global Type Declaration
// ============================================================================

declare global {
	interface Window {
		SaltMarcherAPI?: SaltMarcherAPI;
	}
}
