/**
 * Salt Marcher Core Plugin
 *
 * Core framework for the Salt Marcher ecosystem.
 * Provides Session Runner and Library frameworks.
 * Exposes SaltMarcherAPI for extension plugins.
 *
 * @module SaltMarcherCore
 */

import { Plugin } from 'obsidian';
import { EventBus } from './services/event-bus';
import { ServiceRegistry } from './services/service-registry';
import { PanelRegistry } from './services/panel-registry';
import { LayoutManager } from './services/layout-manager';
import { SessionRunnerView, SESSION_RUNNER_VIEW_TYPE } from './adapters/session-runner-view';
import { LibraryStore } from './adapters/library-store';
import { LibraryView, LIBRARY_VIEW_TYPE } from './adapters/library-view';
import { createAPI, type SaltMarcherAPI } from './api';

// ============================================================================
// Plugin Class
// ============================================================================

export default class SaltMarcherCorePlugin extends Plugin {
	// Core Services
	private eventBus!: EventBus;
	private serviceRegistry!: ServiceRegistry;
	private panelRegistry!: PanelRegistry;
	private layoutManager!: LayoutManager;
	private libraryStore!: LibraryStore;

	// ========================================================================
	// Plugin Lifecycle
	// ========================================================================

	async onload(): Promise<void> {
		console.log('[SaltMarcherCore] Loading...');

		// Initialize core services
		this.initializeCoreServices();

		// Expose public API
		this.exposeAPI();

		// Register views
		this.registerViews();

		// Add commands
		this.addCommands();

		// Add ribbon icons
		this.addRibbonIcons();

		console.log('[SaltMarcherCore] Ready. API available at window.SaltMarcherAPI');
	}

	async onunload(): Promise<void> {
		console.log('[SaltMarcherCore] Unloading...');

		// Remove API from window
		delete window.SaltMarcherAPI;

		// Cleanup
		this.serviceRegistry.destroyAll();
		this.panelRegistry.destroyAll();
		this.eventBus.clear();

		console.log('[SaltMarcherCore] Unloaded');
	}

	// ========================================================================
	// Initialization
	// ========================================================================

	private initializeCoreServices(): void {
		this.eventBus = new EventBus();
		this.serviceRegistry = new ServiceRegistry();
		this.panelRegistry = new PanelRegistry();
		this.layoutManager = new LayoutManager();
		this.libraryStore = new LibraryStore(this.app.vault, 'SaltMarcher');

		// Wire up event bus to service registry
		this.serviceRegistry.setEventBus(this.eventBus);
	}

	private exposeAPI(): void {
		const api = createAPI(
			this.eventBus,
			this.serviceRegistry,
			this.panelRegistry,
			this.libraryStore
		);

		window.SaltMarcherAPI = api;
	}

	private registerViews(): void {
		// Session Runner View
		this.registerView(SESSION_RUNNER_VIEW_TYPE, (leaf) => {
			return new SessionRunnerView(
				leaf,
				this.panelRegistry,
				this.layoutManager,
				this.eventBus,
				this.serviceRegistry
			);
		});

		// Library View
		this.registerView(LIBRARY_VIEW_TYPE, (leaf) => {
			return new LibraryView(leaf, this.libraryStore);
		});
	}

	private addCommands(): void {
		// Open Session Runner
		this.addCommand({
			id: 'open-session-runner',
			name: 'Open Session Runner',
			callback: () => this.activateView(SESSION_RUNNER_VIEW_TYPE),
		});

		// Open Library
		this.addCommand({
			id: 'open-library',
			name: 'Open Library',
			callback: () => this.activateView(LIBRARY_VIEW_TYPE),
		});
	}

	private addRibbonIcons(): void {
		// Session Runner ribbon icon
		this.addRibbonIcon('layout-dashboard', 'Session Runner', () => {
			this.activateView(SESSION_RUNNER_VIEW_TYPE);
		});

		// Library ribbon icon
		this.addRibbonIcon('book-open', 'Library', () => {
			this.activateView(LIBRARY_VIEW_TYPE);
		});
	}

	// ========================================================================
	// View Activation
	// ========================================================================

	private async activateView(viewType: string): Promise<void> {
		const { workspace } = this.app;

		// Check if view is already open
		let leaf = workspace.getLeavesOfType(viewType)[0];

		if (!leaf) {
			// Create new leaf in right sidebar
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({
					type: viewType,
					active: true,
				});
				leaf = rightLeaf;
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}
}
