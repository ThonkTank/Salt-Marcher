/**
 * Base Item View
 *
 * Abstract base class for Obsidian ItemViews with Presenter pattern.
 * Eliminates duplicate initialization and cleanup code across views.
 *
 * @module adapters/shared/base-view
 */

import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { BasePresenter } from '../../orchestrators/base-presenter';
import { initializeViewContainer } from './view-setup';

/**
 * Abstract base class for views using the Presenter pattern.
 *
 * Handles common boilerplate:
 * - Container initialization
 * - Presenter lifecycle (create, connect, destroy)
 * - Callback wiring
 *
 * Subclasses implement:
 * - getViewType(), getDisplayText(), getIcon() - Obsidian requirements
 * - getContainerClass() - CSS class for container
 * - createLayout(container) - DOM structure
 * - createPresenter() - Presenter instantiation
 * - render(state) - State-to-DOM updates
 * - cleanupDomRefs() - Nullify DOM references (optional)
 *
 * @example
 * class MyView extends BaseItemView<MyState, MyCallbacks> {
 *     getViewType() { return 'my-view'; }
 *     getDisplayText() { return 'My View'; }
 *     getIcon() { return 'star'; }
 *     getContainerClass() { return 'my-view-container'; }
 *
 *     createLayout(container: HTMLElement) {
 *         this.headerEl = container.createDiv();
 *     }
 *
 *     createPresenter() {
 *         return new MyPresenter();
 *     }
 *
 *     render(state: MyState) {
 *         // Update DOM from state
 *     }
 * }
 */
export abstract class BaseItemView<S, C> extends ItemView {
	protected presenter: BasePresenter<S, C> | null = null;
	protected callbacks: C | null = null;
	protected lastState: S | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	// ========================================================================
	// Abstract Methods - Subclasses Must Implement
	// ========================================================================

	/** CSS class for the view container */
	protected abstract getContainerClass(): string;

	/** Create DOM structure */
	protected abstract createLayout(container: HTMLElement): void;

	/** Create and return the presenter instance */
	protected abstract createPresenter(): BasePresenter<S, C>;

	/** Render state to DOM */
	protected abstract render(state: S): void;

	// ========================================================================
	// Optional Overrides
	// ========================================================================

	/**
	 * Called after presenter is initialized.
	 * Override for additional setup (e.g., event listeners).
	 */
	protected onPresenterReady(): void {
		// Default: no-op
	}

	/**
	 * Cleanup DOM references.
	 * Override to nullify view-specific DOM refs.
	 */
	protected cleanupDomRefs(): void {
		// Default: no-op
	}

	// ========================================================================
	// Lifecycle - Final Implementation
	// ========================================================================

	async onOpen(): Promise<void> {
		// 1. Initialize container
		const container = initializeViewContainer(this, {
			className: this.getContainerClass(),
		});

		// 2. Create DOM layout
		this.createLayout(container);

		// 3. Create and connect presenter
		this.presenter = this.createPresenter();
		this.presenter.setOnRender((state) => {
			this.lastState = state;
			this.render(state);
		});
		this.callbacks = this.presenter.getCallbacks();

		// 4. Allow subclass setup
		this.onPresenterReady();

		// 5. Initialize presenter (loads data, triggers first render)
		await this.presenter.initialize();
	}

	async onClose(): Promise<void> {
		// 1. Destroy presenter (cleans up subscriptions)
		this.presenter?.destroy();

		// 2. Clear references
		this.presenter = null;
		this.callbacks = null;
		this.lastState = null;

		// 3. Subclass cleanup
		this.cleanupDomRefs();
	}
}
