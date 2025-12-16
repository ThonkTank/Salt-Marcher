/**
 * Base Panel Implementation
 *
 * Abstract base class for sidebar panels that provides common functionality:
 * - Container management with stylePanelContainer
 * - Subscription lifecycle management
 * - Render utilities for common patterns
 *
 * Panels extend this class and implement the abstract hooks.
 */

import type { SidebarPanel, PanelContext } from './base-panel';
import { stylePanelContainer } from '@shared/layout';

// ═══════════════════════════════════════════════════════════════
// Base Panel Abstract Class
// ═══════════════════════════════════════════════════════════════

export abstract class BasePanel implements SidebarPanel {
  // ─────────────────────────────────────────────────────────────
  // Panel Identity (abstract - subclass must define)
  // ─────────────────────────────────────────────────────────────

  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly icon: string;
  abstract readonly priority: number;
  abstract readonly collapsible?: boolean;
  abstract readonly defaultCollapsed?: boolean;

  // ─────────────────────────────────────────────────────────────
  // Protected State
  // ─────────────────────────────────────────────────────────────

  protected container: HTMLElement | null = null;
  private subscriptions: Array<() => void> = [];

  // ─────────────────────────────────────────────────────────────
  // SidebarPanel Lifecycle Implementation
  // ─────────────────────────────────────────────────────────────

  /**
   * Render panel into container.
   * Sets up container styling and calls subclass onRender hook.
   */
  render(container: HTMLElement): void {
    this.container = container;
    this.container.addClass(this.getPanelClass());
    stylePanelContainer(this.container);
    this.onRender();
  }

  /**
   * Update panel with new context.
   * Delegates to subclass onUpdate hook.
   */
  update(context: PanelContext): void {
    this.onUpdate(context);
  }

  /**
   * Dispose panel and cleanup all subscriptions.
   */
  dispose(): void {
    for (const unsub of this.subscriptions) {
      unsub();
    }
    this.subscriptions = [];
  }

  // ─────────────────────────────────────────────────────────────
  // Abstract Hooks (subclass implements)
  // ─────────────────────────────────────────────────────────────

  /**
   * Return CSS class for panel container.
   * @example return 'travel-panel';
   */
  protected abstract getPanelClass(): string;

  /**
   * Called after container is set up.
   * Set up subscriptions and render initial state here.
   */
  protected abstract onRender(): void;

  /**
   * Called when panel context changes.
   * Re-render if needed based on context.
   */
  protected abstract onUpdate(context: PanelContext): void;

  // ─────────────────────────────────────────────────────────────
  // Container Utilities
  // ─────────────────────────────────────────────────────────────

  /**
   * Get container, throwing if not initialized.
   * Use in render methods that require container.
   */
  protected ensureContainer(): HTMLElement {
    if (!this.container) {
      throw new Error(`${this.id}: Container not initialized`);
    }
    return this.container;
  }

  /**
   * Clear container and execute render function.
   * Common pattern for full re-renders.
   */
  protected clearAndRender(renderFn: () => void): void {
    const container = this.ensureContainer();
    container.empty();
    renderFn();
  }

  // ─────────────────────────────────────────────────────────────
  // Subscription Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Register a subscription for automatic cleanup on dispose.
   * @param unsubscribe - Cleanup function returned by subscribe()
   */
  protected registerSubscription(unsubscribe: () => void): void {
    this.subscriptions.push(unsubscribe);
  }

  // ─────────────────────────────────────────────────────────────
  // Render Utilities
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a flex row container with common styling.
   */
  protected createFlexRow(
    parent: HTMLElement,
    className: string,
    options?: { gap?: string; justify?: string; align?: string }
  ): HTMLElement {
    const el = parent.createDiv({ cls: className });
    el.style.display = 'flex';
    el.style.alignItems = options?.align ?? 'center';
    el.style.gap = options?.gap ?? '8px';
    if (options?.justify) el.style.justifyContent = options.justify;
    return el;
  }

  /**
   * Create a flex column container with common styling.
   */
  protected createFlexColumn(
    parent: HTMLElement,
    className: string,
    options?: { gap?: string; align?: string }
  ): HTMLElement {
    const el = parent.createDiv({ cls: className });
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = options?.gap ?? '8px';
    if (options?.align) el.style.alignItems = options.align;
    return el;
  }

  /**
   * Create a status badge element.
   */
  protected createStatusBadge(
    parent: HTMLElement,
    text: string,
    className: string
  ): HTMLElement {
    const el = parent.createDiv({ cls: className });
    el.style.padding = '6px 12px';
    el.style.borderRadius = '4px';
    el.style.backgroundColor = 'var(--background-modifier-hover)';
    el.style.textAlign = 'center';
    el.style.fontWeight = '500';
    el.setText(text);
    return el;
  }
}
