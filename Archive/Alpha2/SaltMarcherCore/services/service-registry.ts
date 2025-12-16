/**
 * Service Registry
 *
 * Manages registration and lifecycle of session services.
 * Extension plugins register their services here.
 *
 * @module SaltMarcherCore/session/service-registry
 */

import type { ISessionService } from '../../Shared/schemas/session';
import type { EventBus } from './event-bus';

type ServiceReadyCallback = (serviceId: string) => void;

/**
 * Registry for session services.
 * Handles registration, lookup, and lifecycle management.
 */
export class ServiceRegistry {
	private services = new Map<string, ISessionService>();
	private readyCallbacks = new Set<ServiceReadyCallback>();
	private eventBus: EventBus | null = null;

	/**
	 * Set the event bus for service communication.
	 * Must be called before registering services.
	 */
	setEventBus(eventBus: EventBus): void {
		this.eventBus = eventBus;
	}

	/**
	 * Register a service.
	 * @param service - Service implementing ISessionService
	 */
	register(service: ISessionService): void {
		if (this.services.has(service.id)) {
			console.warn(`[ServiceRegistry] Service '${service.id}' already registered, replacing`);
			this.unregister(service.id);
		}

		// Wire up event emitter
		if (this.eventBus) {
			service.setEventEmitter((type, data) => {
				this.eventBus!.emit(type, service.id, data);
			});

			// Subscribe to events the service wants
			// (Services handle their own event subscriptions via handleEvent)
		}

		this.services.set(service.id, service);

		// Notify listeners
		for (const callback of this.readyCallbacks) {
			callback(service.id);
		}

		console.log(`[ServiceRegistry] Registered service: ${service.id}`);
	}

	/**
	 * Unregister a service.
	 */
	unregister(id: string): void {
		const service = this.services.get(id);
		if (service) {
			service.destroy();
			this.services.delete(id);
			console.log(`[ServiceRegistry] Unregistered service: ${id}`);
		}
	}

	/**
	 * Get a service by ID.
	 */
	get<T extends ISessionService>(id: string): T | undefined {
		return this.services.get(id) as T | undefined;
	}

	/**
	 * Get all registered services.
	 */
	getAll(): ISessionService[] {
		return Array.from(this.services.values());
	}

	/**
	 * Get all registered service IDs.
	 */
	getRegisteredIds(): string[] {
		return Array.from(this.services.keys());
	}

	/**
	 * Subscribe to service registration events.
	 * @returns Unsubscribe function
	 */
	onServiceReady(callback: ServiceReadyCallback): () => void {
		this.readyCallbacks.add(callback);
		return () => this.readyCallbacks.delete(callback);
	}

	/**
	 * Initialize all registered services.
	 */
	async initializeAll(): Promise<void> {
		const services = this.getAll();
		await Promise.all(services.map((s) => s.initialize()));
	}

	/**
	 * Destroy all registered services.
	 */
	destroyAll(): void {
		for (const service of this.services.values()) {
			service.destroy();
		}
		this.services.clear();
		this.readyCallbacks.clear();
	}
}
