/**
 * Panel Registry
 *
 * Manages registration and instantiation of session panels.
 * Extension plugins register their UI panels here.
 *
 * @module SaltMarcherCore/session/panel-registry
 */

import type { ISessionPanel, PanelContext } from '../../Shared/schemas/session';

/**
 * Panel definition stored in the registry.
 */
export interface PanelDefinition {
	id: string;
	name: string;
	icon: string;
}

type PanelReadyCallback = (panelId: string) => void;

/**
 * Registry for session panels.
 * Handles registration, instantiation, and lifecycle management.
 */
export class PanelRegistry {
	private panels = new Map<string, ISessionPanel>();
	private instances = new Map<string, ISessionPanel>();
	private readyCallbacks = new Set<PanelReadyCallback>();

	/**
	 * Register a panel.
	 * @param panel - Panel implementing ISessionPanel
	 */
	register(panel: ISessionPanel): void {
		if (this.panels.has(panel.id)) {
			console.warn(`[PanelRegistry] Panel '${panel.id}' already registered, replacing`);
			this.unregister(panel.id);
		}

		this.panels.set(panel.id, panel);

		// Notify listeners
		for (const callback of this.readyCallbacks) {
			callback(panel.id);
		}

		console.log(`[PanelRegistry] Registered panel: ${panel.id}`);
	}

	/**
	 * Unregister a panel.
	 */
	unregister(id: string): void {
		const panel = this.panels.get(id);
		if (panel) {
			// Destroy all instances of this panel
			for (const [instanceId, instance] of this.instances) {
				if (instance.id === id) {
					instance.destroy();
					this.instances.delete(instanceId);
				}
			}
			this.panels.delete(id);
			console.log(`[PanelRegistry] Unregistered panel: ${id}`);
		}
	}

	/**
	 * Create a panel instance.
	 * @param panelId - Panel type ID
	 * @param instanceId - Optional unique instance ID
	 * @returns Panel instance or undefined if panel type not found
	 */
	create(panelId: string, instanceId?: string): ISessionPanel | undefined {
		const panel = this.panels.get(panelId);
		if (!panel) {
			console.warn(`[PanelRegistry] Panel type '${panelId}' not found`);
			return undefined;
		}

		const id = instanceId ?? `${panelId}-${Date.now()}`;
		this.instances.set(id, panel);
		return panel;
	}

	/**
	 * Get a panel instance by instance ID.
	 */
	getInstance(instanceId: string): ISessionPanel | undefined {
		return this.instances.get(instanceId);
	}

	/**
	 * Destroy a panel instance.
	 */
	destroyInstance(instanceId: string): void {
		const instance = this.instances.get(instanceId);
		if (instance) {
			instance.destroy();
			this.instances.delete(instanceId);
		}
	}

	/**
	 * Get all available panel definitions.
	 */
	getAvailable(): PanelDefinition[] {
		return Array.from(this.panels.values()).map((p) => ({
			id: p.id,
			name: p.name,
			icon: p.icon,
		}));
	}

	/**
	 * Subscribe to panel registration events.
	 * @returns Unsubscribe function
	 */
	onPanelReady(callback: PanelReadyCallback): () => void {
		this.readyCallbacks.add(callback);
		return () => this.readyCallbacks.delete(callback);
	}

	/**
	 * Destroy all panel instances.
	 */
	destroyAll(): void {
		for (const instance of this.instances.values()) {
			instance.destroy();
		}
		this.instances.clear();
		this.panels.clear();
		this.readyCallbacks.clear();
	}
}
