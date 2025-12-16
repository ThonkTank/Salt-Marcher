/**
 * Base Tool View
 *
 * Abstract base class for Obsidian ItemViews with common lifecycle patterns.
 * Provides automatic subscription/component cleanup and RenderHint dispatch.
 *
 * Features:
 * - Automatic subscription cleanup on close
 * - Automatic component disposal on close
 * - RenderHint dispatch system with override hooks
 * - Reuses existing layout utilities
 *
 * @module core/utils/view/base-tool-view
 */

import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { initializeViewContainer } from '@shared/layout';
import type { RenderHint } from '@core/types/render';
import type { CoordKey } from '@core/schemas/hex-geometry';

// ═══════════════════════════════════════════════════════════════
// Disposable Component Interface
// ═══════════════════════════════════════════════════════════════

/**
 * Interface for components that can be disposed.
 * Components registered with registerComponent() will be automatically
 * disposed when the view closes.
 */
export interface DisposableComponent {
  dispose(): void;
}

// ═══════════════════════════════════════════════════════════════
// Base Tool View
// ═══════════════════════════════════════════════════════════════

/**
 * Abstract base class for tool views (Cartographer, SessionRunner, etc.)
 *
 * Provides:
 * - Standard ItemView lifecycle implementation
 * - Subscription management with auto-cleanup
 * - Component management with auto-disposal
 * - RenderHint dispatch system
 *
 * @example
 * ```typescript
 * class MyView extends BaseToolView<MyState, MyViewModel> {
 *   protected readonly viewType = 'my-view';
 *   protected readonly displayText = 'My View';
 *   protected readonly iconName = 'icon';
 *   protected viewModel!: MyViewModel;
 *
 *   protected getContainerClass() { return 'my-container'; }
 *   protected onCreateViewModel() { this.viewModel = createMyViewModel(); }
 *   protected createLayout(container) { ... }
 *   protected setupSubscriptions() {
 *     this.registerSubscription(this.viewModel.subscribe(state => this.onStateChange(state)));
 *   }
 *   protected onRenderFull(state) { ... }
 * }
 * ```
 */
export abstract class BaseToolView<TState, TViewModel> extends ItemView {
  // ─────────────────────────────────────────────────────────────
  // Abstract Properties (subclass must define)
  // ─────────────────────────────────────────────────────────────

  /** View type identifier for Obsidian */
  protected abstract readonly viewType: string;

  /** Display text for tab/header */
  protected abstract readonly displayText: string;

  /** Icon name (Lucide icon) */
  protected abstract readonly iconName: string;

  /** ViewModel instance - subclass sets in onCreateViewModel() */
  protected abstract viewModel: TViewModel;

  // ─────────────────────────────────────────────────────────────
  // Protected State
  // ─────────────────────────────────────────────────────────────

  /** Registered components for auto-disposal */
  protected components: DisposableComponent[] = [];

  /** Registered subscriptions for auto-cleanup */
  private subscriptions: Array<() => void> = [];

  // ─────────────────────────────────────────────────────────────
  // ItemView Implementation
  // ─────────────────────────────────────────────────────────────

  getViewType(): string {
    return this.viewType;
  }

  getDisplayText(): string {
    return this.displayText;
  }

  getIcon(): string {
    return this.iconName;
  }

  /**
   * Called when view is opened.
   * Initializes container, creates ViewModel, layout, and subscriptions.
   */
  async onOpen(): Promise<void> {
    // Initialize container with layout utilities
    const container = initializeViewContainer(this, this.getContainerClass());

    // Create ViewModel (subclass implements)
    this.onCreateViewModel();

    // Create layout (subclass implements)
    this.createLayout(container);

    // Setup subscriptions (subclass implements)
    this.setupSubscriptions();

    // Optional async initialization
    await this.onInitialize();
  }

  /**
   * Called when view is closed.
   * Automatically cleans up subscriptions and components.
   */
  async onClose(): Promise<void> {
    // Cleanup subscriptions
    for (const unsub of this.subscriptions) {
      unsub();
    }
    this.subscriptions = [];

    // Cleanup components
    for (const component of this.components) {
      component.dispose();
    }
    this.components = [];

    // Subclass cleanup hook
    this.onDispose();
  }

  // ─────────────────────────────────────────────────────────────
  // Abstract Hooks (subclass must implement)
  // ─────────────────────────────────────────────────────────────

  /**
   * Return CSS class for the view container.
   * @example return 'cartographer-container';
   */
  protected abstract getContainerClass(): string;

  /**
   * Create and assign the ViewModel.
   * Called before createLayout().
   */
  protected abstract onCreateViewModel(): void;

  /**
   * Create the view's layout structure.
   * Use layout utilities from @core/utils/layout.
   */
  protected abstract createLayout(container: HTMLElement): void;

  /**
   * Setup subscriptions to ViewModel state changes.
   * Use registerSubscription() for auto-cleanup.
   */
  protected abstract setupSubscriptions(): void;

  // ─────────────────────────────────────────────────────────────
  // Optional Hooks (subclass may override)
  // ─────────────────────────────────────────────────────────────

  /**
   * Optional async initialization after layout is created.
   * Override for async setup like loading data.
   */
  protected async onInitialize(): Promise<void> {
    // Default: no-op
  }

  /**
   * Optional cleanup hook called during onClose().
   * Override for custom cleanup logic.
   */
  protected onDispose(): void {
    // Default: no-op
  }

  // ─────────────────────────────────────────────────────────────
  // RenderHint Dispatch System
  // ─────────────────────────────────────────────────────────────

  /**
   * Handle state change with RenderHint-based dispatch.
   * Override specific onRender* methods in subclass.
   *
   * Call this from your subscription callback:
   * ```typescript
   * this.viewModel.subscribe(state => this.onStateChange(state));
   * ```
   */
  protected onStateChange(state: TState & { renderHint: RenderHint }): void {
    const hint = state.renderHint;

    switch (hint.type) {
      case 'full':
        this.onRenderFull(state);
        break;
      case 'camera':
        this.onRenderCamera(state);
        break;
      case 'tiles':
        this.onRenderTiles(state, (hint as { type: 'tiles'; coords: CoordKey[] }).coords);
        break;
      case 'colors':
        this.onRenderColors(state);
        break;
      case 'brush':
        this.onRenderBrush(state);
        break;
      case 'selection':
        this.onRenderSelection(state);
        break;
      case 'token':
        this.onRenderToken(state);
        break;
      case 'route':
        this.onRenderRoute(state);
        break;
      case 'ui':
        this.onRenderUI(state);
        break;
      case 'none':
        // No render needed
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // RenderHint Handlers (subclass overrides as needed)
  // ─────────────────────────────────────────────────────────────

  /** Called when full re-render is needed */
  protected onRenderFull(_state: TState): void {}

  /** Called when only camera transform changed */
  protected onRenderCamera(_state: TState): void {}

  /** Called when specific tiles changed */
  protected onRenderTiles(_state: TState, _coords: CoordKey[]): void {}

  /** Called when color mode changed (all tiles need color update) */
  protected onRenderColors(_state: TState): void {}

  /** Called when brush preview changed */
  protected onRenderBrush(_state: TState): void {}

  /** Called when selection changed */
  protected onRenderSelection(_state: TState): void {}

  /** Called when token position changed (SessionRunner) */
  protected onRenderToken(_state: TState): void {}

  /** Called when route overlay changed (SessionRunner) */
  protected onRenderRoute(_state: TState): void {}

  /** Called for UI-only updates (no canvas changes) */
  protected onRenderUI(_state: TState): void {}

  // ─────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Register a subscription for automatic cleanup on close.
   *
   * @param unsubscribe - Cleanup function returned by subscribe()
   * @example
   * this.registerSubscription(this.viewModel.subscribe(state => this.onStateChange(state)));
   */
  protected registerSubscription(unsubscribe: () => void): void {
    this.subscriptions.push(unsubscribe);
  }

  /**
   * Register a component for automatic disposal on close.
   * Returns the component for chaining.
   *
   * @param component - Component with dispose() method
   * @returns The same component for convenience
   * @example
   * this.hexCanvas = this.registerComponent(createHexCanvas(container));
   */
  protected registerComponent<T extends DisposableComponent>(component: T): T {
    this.components.push(component);
    return component;
  }
}
