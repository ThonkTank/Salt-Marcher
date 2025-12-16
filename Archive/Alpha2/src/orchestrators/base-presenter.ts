/**
 * Base Presenter
 *
 * Abstract base class for presenters with render callback pattern.
 * Eliminates duplicate setOnRender/updateView implementations.
 * Provides subscription management for service cleanup.
 *
 * @module orchestrators/base-presenter
 */

export type RenderCallback<S> = (state: S) => void;

/** Unsubscribe function returned by service subscriptions */
export type Unsubscribe = () => void;

/** Interface for services that support subscription */
export interface Subscribable<T> {
	subscribe(callback: (state: T) => void): Unsubscribe;
}

/**
 * Abstract base class for presenters managing view state and callbacks.
 *
 * @example
 * class MyPresenter extends BasePresenter<MyState, MyCallbacks> {
 *     private state: MyState = { ... };
 *
 *     getCallbacks(): MyCallbacks {
 *         return { onClick: () => this.handleClick() };
 *     }
 *
 *     async initialize(): Promise<void> {
 *         // Subscribe to services with automatic cleanup
 *         this.subscribeToService(this.cameraService, (camera) => {
 *             this.state.camera = camera;
 *             this.updateView(this.state);
 *         });
 *         await this.loadData();
 *         this.updateView(this.state);
 *     }
 *
 *     getState(): Readonly<MyState> {
 *         return this.state;
 *     }
 * }
 */
export abstract class BasePresenter<S, C> {
	protected onRender: RenderCallback<S> | null = null;
	private subscriptions: Unsubscribe[] = [];

	/**
	 * Set render callback (called by View).
	 * View registers this to receive state updates.
	 */
	setOnRender(callback: RenderCallback<S>): void {
		this.onRender = callback;
	}

	/**
	 * Get callbacks for View events.
	 * Returns an object mapping event names to handler methods.
	 */
	abstract getCallbacks(): C;

	/**
	 * Initialize presenter.
	 * Called after View setup to load initial data.
	 */
	abstract initialize(): Promise<void>;

	/**
	 * Get current state (readonly).
	 * View uses this to access state without mutation.
	 */
	abstract getState(): Readonly<S>;

	/**
	 * Cleanup when view is closed.
	 * Cleans up all subscriptions and render callback.
	 * Override to add additional cleanup logic (call super.destroy()).
	 */
	destroy(): void {
		// Unsubscribe from all services
		for (const unsubscribe of this.subscriptions) {
			unsubscribe();
		}
		this.subscriptions = [];
		this.onRender = null;
	}

	/**
	 * Notify view of state change.
	 * Call this after modifying state to trigger re-render.
	 */
	protected updateView(state: S): void {
		this.onRender?.(state);
	}

	/**
	 * Add an unsubscribe function to be called on destroy.
	 * Use this for manual subscription management.
	 */
	protected addSubscription(unsubscribe: Unsubscribe): void {
		this.subscriptions.push(unsubscribe);
	}

	/**
	 * Subscribe to a service and automatically track for cleanup.
	 * Convenience method for common subscription pattern.
	 *
	 * @param service - Service with subscribe method
	 * @param callback - Handler for state updates
	 */
	protected subscribeToService<T>(
		service: Subscribable<T>,
		callback: (state: T) => void
	): void {
		const unsubscribe = service.subscribe(callback);
		this.addSubscription(unsubscribe);
	}
}
