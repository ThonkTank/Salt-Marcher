/**
 * Session Runner Presenter
 *
 * Manages state and callbacks for the Session Runner View.
 * Handles edit mode, panel management, and layout coordination.
 *
 * @module SaltMarcherCore/orchestrators/session-runner-presenter
 */

import { BasePresenter } from '../../Shared/base-presenter';
import type { LayoutConfig, PanelContext } from '../../Shared/schemas/session';
import type { SessionEventType } from '../../Shared/schemas/events';
import type { PanelRegistry, PanelDefinition } from '../services/panel-registry';
import type { LayoutManager } from '../services/layout-manager';
import type { EventBus } from '../services/event-bus';
import type { ServiceRegistry } from '../services/service-registry';

// ============================================================================
// Types
// ============================================================================

export interface SessionRunnerState {
	editMode: boolean;
	layout: LayoutConfig;
	availablePanels: PanelDefinition[];
	panelPickerVisible: boolean;
}

export interface SessionRunnerCallbacks {
	toggleEditMode: () => void;
	togglePanelPicker: () => void;
	addPanel: (panelId: string) => void;
	removePanel: (instanceId: string) => void;
}

// ============================================================================
// Presenter
// ============================================================================

export class SessionRunnerPresenter extends BasePresenter<
	SessionRunnerState,
	SessionRunnerCallbacks
> {
	private state: SessionRunnerState;

	constructor(
		private panelRegistry: PanelRegistry,
		private layoutManager: LayoutManager,
		private eventBus: EventBus,
		private serviceRegistry: ServiceRegistry
	) {
		super();
		this.state = {
			editMode: false,
			layout: layoutManager.getLayout(),
			availablePanels: panelRegistry.getAvailable(),
			panelPickerVisible: false,
		};
	}

	// ========================================================================
	// BasePresenter Implementation
	// ========================================================================

	async initialize(): Promise<void> {
		// Subscribe to layout changes
		this.addSubscription(
			this.layoutManager.onChange((layout) => {
				this.state = { ...this.state, layout };
				this.updateView(this.state);
			})
		);

		// Subscribe to panel registration
		this.addSubscription(
			this.panelRegistry.onPanelReady(() => {
				this.state = {
					...this.state,
					availablePanels: this.panelRegistry.getAvailable(),
				};
				this.updateView(this.state);
			})
		);

		// Initial render
		this.updateView(this.state);
	}

	getState(): Readonly<SessionRunnerState> {
		return this.state;
	}

	getCallbacks(): SessionRunnerCallbacks {
		return {
			toggleEditMode: () => this.toggleEditMode(),
			togglePanelPicker: () => this.togglePanelPicker(),
			addPanel: (panelId) => this.addPanel(panelId),
			removePanel: (instanceId) => this.removePanel(instanceId),
		};
	}

	// ========================================================================
	// Panel Context (for rendering panels)
	// ========================================================================

	createPanelContext(): PanelContext {
		return {
			getService: <T>(id: string) => {
				return this.serviceRegistry.get(id) as T | undefined;
			},
			onEvent: <T>(type: SessionEventType, handler: (data: T) => void) => {
				return this.eventBus.on(type, (event) => handler(event.data as T));
			},
			emitAction: (serviceId: string, action: string, payload?: unknown) => {
				console.log(`[PanelContext] Action: ${serviceId}.${action}`, payload);
			},
		};
	}

	// ========================================================================
	// State Mutations
	// ========================================================================

	private toggleEditMode(): void {
		this.state = {
			...this.state,
			editMode: !this.state.editMode,
			panelPickerVisible: false, // Close picker when exiting edit mode
		};
		this.updateView(this.state);
	}

	private togglePanelPicker(): void {
		this.state = {
			...this.state,
			panelPickerVisible: !this.state.panelPickerVisible,
		};
		this.updateView(this.state);
	}

	private addPanel(panelId: string): void {
		const instanceId = `${panelId}-${Date.now()}`;
		const panel = this.panelRegistry.create(panelId, instanceId);

		if (panel) {
			this.layoutManager.addPanel(panelId, instanceId);
		}

		// Close picker after adding
		this.state = { ...this.state, panelPickerVisible: false };
		this.updateView(this.state);
	}

	private removePanel(instanceId: string): void {
		this.layoutManager.removePanel(instanceId);
		this.panelRegistry.destroyInstance(instanceId);
	}
}
