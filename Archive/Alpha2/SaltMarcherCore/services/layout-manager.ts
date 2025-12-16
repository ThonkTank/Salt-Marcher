/**
 * Layout Manager
 *
 * Manages panel layout configuration for the Session Runner.
 * Handles grid positions, drag-and-drop, and layout persistence.
 *
 * @module SaltMarcherCore/session/layout-manager
 */

import type {
	LayoutConfig,
	LayoutPanelConfig,
	PanelPosition,
} from '../../Shared/schemas/session';

type LayoutChangeCallback = (layout: LayoutConfig) => void;

/**
 * Default layout configuration.
 */
const DEFAULT_LAYOUT: LayoutConfig = {
	id: 'default',
	name: 'Default Layout',
	columns: 3,
	rows: 2,
	panels: [],
};

/**
 * Manages panel layout for the Session Runner.
 */
export class LayoutManager {
	private layout: LayoutConfig = { ...DEFAULT_LAYOUT };
	private changeCallbacks = new Set<LayoutChangeCallback>();
	private savedLayouts = new Map<string, LayoutConfig>();

	/**
	 * Add a panel to the layout.
	 * @param panelId - Panel type ID
	 * @param instanceId - Unique instance ID
	 * @param position - Optional grid position
	 */
	addPanel(panelId: string, instanceId: string, position?: Partial<PanelPosition>): void {
		// Find next available position if not specified
		const pos: PanelPosition = {
			row: position?.row ?? this.findNextRow(),
			col: position?.col ?? 0,
			rowSpan: position?.rowSpan ?? 1,
			colSpan: position?.colSpan ?? 1,
		};

		const panelConfig: LayoutPanelConfig = {
			instanceId,
			panelId,
			position: pos,
		};

		this.layout = {
			...this.layout,
			panels: [...this.layout.panels, panelConfig],
		};

		this.notifyChange();
	}

	/**
	 * Remove a panel from the layout.
	 */
	removePanel(instanceId: string): void {
		this.layout = {
			...this.layout,
			panels: this.layout.panels.filter((p) => p.instanceId !== instanceId),
		};
		this.notifyChange();
	}

	/**
	 * Move a panel to a new position.
	 */
	movePanel(instanceId: string, position: Partial<PanelPosition>): void {
		this.layout = {
			...this.layout,
			panels: this.layout.panels.map((p) =>
				p.instanceId === instanceId
					? { ...p, position: { ...p.position, ...position } }
					: p
			),
		};
		this.notifyChange();
	}

	/**
	 * Swap positions of two panels.
	 */
	swapPanels(instanceId1: string, instanceId2: string): void {
		const panel1 = this.layout.panels.find((p) => p.instanceId === instanceId1);
		const panel2 = this.layout.panels.find((p) => p.instanceId === instanceId2);

		if (!panel1 || !panel2) return;

		const pos1 = { ...panel1.position };
		const pos2 = { ...panel2.position };

		this.layout = {
			...this.layout,
			panels: this.layout.panels.map((p) => {
				if (p.instanceId === instanceId1) {
					return { ...p, position: pos2 };
				}
				if (p.instanceId === instanceId2) {
					return { ...p, position: pos1 };
				}
				return p;
			}),
		};
		this.notifyChange();
	}

	/**
	 * Get the current layout configuration.
	 */
	getLayout(): LayoutConfig {
		return { ...this.layout };
	}

	/**
	 * Set grid dimensions.
	 */
	setGridSize(columns: number, rows: number): void {
		this.layout = {
			...this.layout,
			columns: Math.max(1, columns),
			rows: Math.max(1, rows),
		};
		this.notifyChange();
	}

	/**
	 * Save current layout with a name.
	 * @returns Layout ID
	 */
	saveLayout(name: string): string {
		const id = `layout-${Date.now()}`;
		const savedLayout: LayoutConfig = {
			...this.layout,
			id,
			name,
		};
		this.savedLayouts.set(id, savedLayout);
		return id;
	}

	/**
	 * Load a saved layout.
	 */
	loadLayout(layoutId: string): boolean {
		const saved = this.savedLayouts.get(layoutId);
		if (saved) {
			this.layout = { ...saved };
			this.notifyChange();
			return true;
		}
		return false;
	}

	/**
	 * Get all saved layouts.
	 */
	getSavedLayouts(): Array<{ id: string; name: string }> {
		return Array.from(this.savedLayouts.values()).map((l) => ({
			id: l.id,
			name: l.name,
		}));
	}

	/**
	 * Subscribe to layout changes.
	 * @returns Unsubscribe function
	 */
	onChange(callback: LayoutChangeCallback): () => void {
		this.changeCallbacks.add(callback);
		return () => this.changeCallbacks.delete(callback);
	}

	/**
	 * Export layout state for persistence.
	 */
	toState(): {
		current: LayoutConfig;
		saved: Array<[string, LayoutConfig]>;
	} {
		return {
			current: this.layout,
			saved: Array.from(this.savedLayouts.entries()),
		};
	}

	/**
	 * Import layout state from persistence.
	 */
	fromState(state: {
		current: LayoutConfig;
		saved: Array<[string, LayoutConfig]>;
	}): void {
		this.layout = state.current;
		this.savedLayouts = new Map(state.saved);
		this.notifyChange();
	}

	/**
	 * Reset to default layout.
	 */
	reset(): void {
		this.layout = { ...DEFAULT_LAYOUT };
		this.notifyChange();
	}

	/**
	 * Find the next available row for a new panel.
	 */
	private findNextRow(): number {
		if (this.layout.panels.length === 0) return 0;

		const maxRow = Math.max(
			...this.layout.panels.map((p) => p.position.row + p.position.rowSpan)
		);
		return maxRow < this.layout.rows ? maxRow : 0;
	}

	/**
	 * Notify all change callbacks.
	 */
	private notifyChange(): void {
		const layout = this.getLayout();
		for (const callback of this.changeCallbacks) {
			callback(layout);
		}
	}
}
