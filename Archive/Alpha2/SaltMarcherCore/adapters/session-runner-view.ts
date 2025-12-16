/**
 * Session Runner View
 *
 * Obsidian ItemView for the Session Runner.
 * Displays registered panels in a configurable grid layout.
 * Supports edit mode for drag-and-drop panel arrangement.
 *
 * @module SaltMarcherCore/adapters/session-runner-view
 */

import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { LayoutConfig, LayoutPanelConfig } from '../../Shared/schemas/session';
import type { PanelRegistry } from '../services/panel-registry';
import type { LayoutManager } from '../services/layout-manager';
import type { EventBus } from '../services/event-bus';
import type { ServiceRegistry } from '../services/service-registry';
import {
	SessionRunnerPresenter,
	type SessionRunnerState,
	type SessionRunnerCallbacks,
} from '../orchestrators/session-runner-presenter';

// ============================================================================
// Constants
// ============================================================================

export const SESSION_RUNNER_VIEW_TYPE = 'salt-marcher-session-runner';

// ============================================================================
// Session Runner View
// ============================================================================

export class SessionRunnerView extends ItemView {
	private presenter: SessionRunnerPresenter;
	private callbacks: SessionRunnerCallbacks | null = null;

	// DOM Elements
	private containerEl_: HTMLElement | null = null;
	private headerEl: HTMLElement | null = null;
	private gridEl: HTMLElement | null = null;
	private panelPickerEl: HTMLElement | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		panelRegistry: PanelRegistry,
		layoutManager: LayoutManager,
		eventBus: EventBus,
		serviceRegistry: ServiceRegistry
	) {
		super(leaf);
		this.presenter = new SessionRunnerPresenter(
			panelRegistry,
			layoutManager,
			eventBus,
			serviceRegistry
		);
	}

	// ========================================================================
	// Obsidian ItemView Implementation
	// ========================================================================

	getViewType(): string {
		return SESSION_RUNNER_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Session Runner';
	}

	getIcon(): string {
		return 'layout-dashboard';
	}

	async onOpen(): Promise<void> {
		this.containerEl_ = this.containerEl.children[1] as HTMLElement;
		this.containerEl_.empty();
		this.containerEl_.addClass('session-runner-container');

		// Create static layout elements
		this.createLayout();

		// Connect to presenter
		this.presenter.setOnRender((state) => this.render(state));
		this.callbacks = this.presenter.getCallbacks();

		// Initialize presenter (triggers first render)
		await this.presenter.initialize();
	}

	async onClose(): Promise<void> {
		this.presenter.destroy();
		this.containerEl_ = null;
		this.headerEl = null;
		this.gridEl = null;
		this.panelPickerEl = null;
	}

	// ========================================================================
	// Layout Creation (Static Structure)
	// ========================================================================

	private createLayout(): void {
		if (!this.containerEl_) return;

		// Header
		this.headerEl = this.containerEl_.createDiv({ cls: 'session-runner-header' });
		this.styleHeader(this.headerEl);

		// Grid container
		this.gridEl = this.containerEl_.createDiv({ cls: 'session-runner-grid' });
		this.styleGrid(this.gridEl);

		// Panel picker (hidden by default)
		this.panelPickerEl = this.containerEl_.createDiv({ cls: 'session-runner-picker' });
		this.panelPickerEl.style.display = 'none';
		this.stylePanelPicker(this.panelPickerEl);
	}

	private styleHeader(el: HTMLElement): void {
		el.style.display = 'flex';
		el.style.justifyContent = 'space-between';
		el.style.alignItems = 'center';
		el.style.padding = '8px 16px';
		el.style.borderBottom = '1px solid var(--background-modifier-border)';
	}

	private styleGrid(el: HTMLElement): void {
		el.style.display = 'grid';
		el.style.flex = '1';
		el.style.gap = '8px';
		el.style.padding = '8px';
		el.style.overflow = 'auto';
	}

	private stylePanelPicker(el: HTMLElement): void {
		el.style.position = 'absolute';
		el.style.top = '50px';
		el.style.right = '16px';
		el.style.width = '200px';
		el.style.backgroundColor = 'var(--background-primary)';
		el.style.border = '1px solid var(--background-modifier-border)';
		el.style.borderRadius = '8px';
		el.style.padding = '8px';
		el.style.zIndex = '100';
		el.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
	}

	// ========================================================================
	// Rendering (Driven by Presenter State)
	// ========================================================================

	private render(state: SessionRunnerState): void {
		this.renderHeader(state);
		this.renderGrid(state.layout, state.editMode);
		this.renderPanelPicker(state);
	}

	private renderHeader(state: SessionRunnerState): void {
		if (!this.headerEl || !this.callbacks) return;
		this.headerEl.empty();

		// Title
		const titleEl = this.headerEl.createDiv({ cls: 'session-runner-title' });
		titleEl.textContent = 'Session Runner';
		titleEl.style.fontWeight = '600';

		// Actions
		const actionsEl = this.headerEl.createDiv({ cls: 'session-runner-actions' });
		actionsEl.style.display = 'flex';
		actionsEl.style.gap = '8px';

		// Edit mode toggle
		const editBtn = actionsEl.createEl('button', {
			text: state.editMode ? 'Done' : 'Edit Layout',
		});
		editBtn.addEventListener('click', this.callbacks.toggleEditMode);

		// Add panel button (only in edit mode)
		if (state.editMode) {
			const addBtn = actionsEl.createEl('button', { text: '+ Add Panel' });
			addBtn.addEventListener('click', this.callbacks.togglePanelPicker);
		}
	}

	private renderGrid(layout: LayoutConfig, editMode: boolean): void {
		if (!this.gridEl) return;
		this.gridEl.empty();

		// Set grid template
		this.gridEl.style.gridTemplateColumns = `repeat(${layout.columns}, 1fr)`;
		this.gridEl.style.gridTemplateRows = `repeat(${layout.rows}, 1fr)`;

		if (layout.panels.length === 0) {
			this.renderEmptyState(editMode);
			return;
		}

		// Render each panel
		for (const panelConfig of layout.panels) {
			this.renderPanelCell(panelConfig, editMode);
		}
	}

	private renderEmptyState(editMode: boolean): void {
		if (!this.gridEl) return;

		const emptyEl = this.gridEl.createDiv({ cls: 'session-runner-empty' });
		emptyEl.style.gridColumn = '1 / -1';
		emptyEl.style.gridRow = '1 / -1';
		emptyEl.style.display = 'flex';
		emptyEl.style.flexDirection = 'column';
		emptyEl.style.alignItems = 'center';
		emptyEl.style.justifyContent = 'center';
		emptyEl.style.color = 'var(--text-muted)';
		emptyEl.style.gap = '16px';

		emptyEl.createDiv({ text: 'No panels yet' });

		const hint = emptyEl.createDiv();
		hint.textContent = editMode
			? 'Click "Add Panel" to add panels'
			: 'Click "Edit Layout" to add panels';
		hint.style.fontSize = '0.9em';
	}

	private renderPanelCell(config: LayoutPanelConfig, editMode: boolean): void {
		if (!this.gridEl || !this.callbacks) return;

		const cellEl = this.gridEl.createDiv({ cls: 'session-runner-panel-cell' });
		cellEl.style.gridColumn = `${config.position.col + 1} / span ${config.position.colSpan}`;
		cellEl.style.gridRow = `${config.position.row + 1} / span ${config.position.rowSpan}`;
		cellEl.style.border = '1px solid var(--background-modifier-border)';
		cellEl.style.borderRadius = '8px';
		cellEl.style.overflow = 'hidden';
		cellEl.style.display = 'flex';
		cellEl.style.flexDirection = 'column';

		// Panel header (in edit mode)
		if (editMode) {
			const headerEl = cellEl.createDiv({ cls: 'panel-cell-header' });
			headerEl.style.display = 'flex';
			headerEl.style.justifyContent = 'space-between';
			headerEl.style.alignItems = 'center';
			headerEl.style.padding = '4px 8px';
			headerEl.style.backgroundColor = 'var(--background-secondary)';
			headerEl.style.cursor = 'move';

			headerEl.createSpan({ text: config.panelId });

			const removeBtn = headerEl.createEl('button', { text: '×' });
			removeBtn.style.padding = '0 4px';
			const instanceId = config.instanceId;
			removeBtn.addEventListener('click', () => {
				this.callbacks?.removePanel(instanceId);
			});
		}

		// Panel content
		const contentEl = cellEl.createDiv({ cls: 'panel-cell-content' });
		contentEl.style.flex = '1';
		contentEl.style.overflow = 'auto';

		// Render the panel using presenter's context
		const panel = this.presenter['panelRegistry'].getInstance(config.instanceId);
		if (panel) {
			const context = this.presenter.createPanelContext();
			panel.render(contentEl, context);
		} else {
			contentEl.createDiv({ text: `Panel "${config.panelId}" not available` });
			contentEl.style.padding = '16px';
			contentEl.style.color = 'var(--text-muted)';
		}
	}

	private renderPanelPicker(state: SessionRunnerState): void {
		if (!this.panelPickerEl || !this.callbacks) return;

		// Toggle visibility
		this.panelPickerEl.style.display = state.panelPickerVisible ? 'block' : 'none';

		if (!state.panelPickerVisible) return;

		this.panelPickerEl.empty();

		if (state.availablePanels.length === 0) {
			const emptyEl = this.panelPickerEl.createDiv();
			emptyEl.textContent = 'No panels available';
			emptyEl.style.color = 'var(--text-muted)';
			emptyEl.style.textAlign = 'center';
			emptyEl.style.padding = '16px';
			return;
		}

		// Header
		const headerEl = this.panelPickerEl.createDiv();
		headerEl.textContent = 'Add Panel';
		headerEl.style.fontWeight = '600';
		headerEl.style.marginBottom = '8px';

		// Panel list
		for (const panel of state.availablePanels) {
			const itemEl = this.panelPickerEl.createDiv({ cls: 'panel-picker-item' });
			itemEl.style.padding = '8px';
			itemEl.style.cursor = 'pointer';
			itemEl.style.borderRadius = '4px';

			itemEl.textContent = panel.name;

			itemEl.addEventListener('mouseenter', () => {
				itemEl.style.backgroundColor = 'var(--background-modifier-hover)';
			});
			itemEl.addEventListener('mouseleave', () => {
				itemEl.style.backgroundColor = '';
			});

			const panelId = panel.id;
			itemEl.addEventListener('click', () => {
				this.callbacks?.addPanel(panelId);
			});
		}
	}
}
