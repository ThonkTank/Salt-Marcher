/**
 * Sidebar Container
 *
 * Container component that manages and renders all sidebar panels.
 * Handles panel registration, ordering, collapse state, and updates.
 */

import { setIcon } from 'obsidian';
import type {
  SidebarPanel,
  PanelContext,
  PanelRegistry,
  PanelState,
  PanelsState,
} from './base-panel';
import { createDefaultContext } from './base-panel';

// ═══════════════════════════════════════════════════════════════
// CSS Classes
// ═══════════════════════════════════════════════════════════════

const CSS = {
  container: 'session-runner-sidebar',
  section: 'sidebar-panel-section',
  sectionCollapsed: 'sidebar-panel-section--collapsed',
  header: 'sidebar-panel-header',
  headerIcon: 'sidebar-panel-header-icon',
  headerTitle: 'sidebar-panel-header-title',
  headerChevron: 'sidebar-panel-header-chevron',
  content: 'sidebar-panel-content',
  contentHidden: 'sidebar-panel-content--hidden',
} as const;

// ═══════════════════════════════════════════════════════════════
// Sidebar Container
// ═══════════════════════════════════════════════════════════════

export class SidebarContainer implements PanelRegistry {
  private readonly container: HTMLElement;
  private readonly panels: Map<string, SidebarPanel> = new Map();
  private readonly panelElements: Map<string, HTMLElement> = new Map();
  private readonly collapseState: Map<string, boolean> = new Map();
  private context: PanelContext;
  private onStateChange?: (state: PanelsState) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.addClass(CSS.container);
    this.context = createDefaultContext();
  }

  // ─────────────────────────────────────────────────────────────
  // PanelRegistry Implementation
  // ─────────────────────────────────────────────────────────────

  register(panel: SidebarPanel): void {
    if (this.panels.has(panel.id)) {
      console.warn(`Panel ${panel.id} already registered, replacing`);
      this.unregister(panel.id);
    }

    this.panels.set(panel.id, panel);

    // Set default collapse state
    const isCollapsed = this.collapseState.get(panel.id) ?? panel.defaultCollapsed ?? false;
    this.collapseState.set(panel.id, isCollapsed);

    this.renderAll();
  }

  unregister(panelId: string): void {
    const panel = this.panels.get(panelId);
    if (panel) {
      panel.dispose();
      this.panels.delete(panelId);
      this.panelElements.delete(panelId);
      this.renderAll();
    }
  }

  getAll(): SidebarPanel[] {
    return Array.from(this.panels.values()).sort((a, b) => a.priority - b.priority);
  }

  getById(id: string): SidebarPanel | undefined {
    return this.panels.get(id);
  }

  has(panelId: string): boolean {
    return this.panels.has(panelId);
  }

  // ─────────────────────────────────────────────────────────────
  // Context Updates
  // ─────────────────────────────────────────────────────────────

  /**
   * Update all panels with new context
   */
  updateAll(context: PanelContext): void {
    this.context = context;
    for (const panel of this.panels.values()) {
      panel.update(context);
    }
  }

  /**
   * Update specific panel by ID
   */
  updatePanel(panelId: string): void {
    const panel = this.panels.get(panelId);
    if (panel) {
      panel.update(this.context);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Collapse State
  // ─────────────────────────────────────────────────────────────

  /**
   * Toggle panel collapse state
   */
  toggleCollapse(panelId: string): void {
    const current = this.collapseState.get(panelId) ?? false;
    this.setCollapsed(panelId, !current);
  }

  /**
   * Set panel collapse state
   */
  setCollapsed(panelId: string, collapsed: boolean): void {
    this.collapseState.set(panelId, collapsed);

    // Update UI
    const sectionEl = this.panelElements.get(panelId);
    if (sectionEl) {
      const contentEl = sectionEl.querySelector(`.${CSS.content}`) as HTMLElement;
      const chevronEl = sectionEl.querySelector(`.${CSS.headerChevron}`) as HTMLElement;

      if (collapsed) {
        sectionEl.addClass(CSS.sectionCollapsed);
        contentEl?.addClass(CSS.contentHidden);
        if (contentEl) contentEl.style.display = 'none';
        if (chevronEl) setIcon(chevronEl, 'chevron-right');
      } else {
        sectionEl.removeClass(CSS.sectionCollapsed);
        contentEl?.removeClass(CSS.contentHidden);
        if (contentEl) contentEl.style.display = '';
        if (chevronEl) setIcon(chevronEl, 'chevron-down');
      }
    }

    this.notifyStateChange();
  }

  /**
   * Get collapse state of panel
   */
  isCollapsed(panelId: string): boolean {
    return this.collapseState.get(panelId) ?? false;
  }

  // ─────────────────────────────────────────────────────────────
  // State Persistence
  // ─────────────────────────────────────────────────────────────

  /**
   * Set callback for state changes (for persistence)
   */
  onStateChanged(callback: (state: PanelsState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Get current panels state
   */
  getState(): PanelsState {
    const panels: PanelState[] = [];
    for (const [id, collapsed] of this.collapseState) {
      panels.push({ id, collapsed });
    }
    return { panels };
  }

  /**
   * Restore panels state
   */
  restoreState(state: PanelsState): void {
    for (const panelState of state.panels) {
      this.collapseState.set(panelState.id, panelState.collapsed);
    }
    this.renderAll();
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────

  /**
   * Render all panels (sorted by priority)
   */
  private renderAll(): void {
    this.container.empty();
    this.panelElements.clear();

    const sortedPanels = this.getAll();

    for (const panel of sortedPanels) {
      const sectionEl = this.renderPanelSection(panel);
      this.panelElements.set(panel.id, sectionEl);
      this.container.appendChild(sectionEl);
    }
  }

  /**
   * Render single panel section
   */
  private renderPanelSection(panel: SidebarPanel): HTMLElement {
    const isCollapsed = this.collapseState.get(panel.id) ?? false;
    const isCollapsible = panel.collapsible !== false;

    // Section container
    const section = createDiv({
      cls: [CSS.section, isCollapsed ? CSS.sectionCollapsed : ''].filter(Boolean),
    });
    section.setAttribute('data-panel-id', panel.id);
    section.style.borderBottom = '1px solid var(--background-modifier-border)';

    // Header
    const header = section.createDiv({ cls: CSS.header });
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.padding = '8px 12px';
    header.style.backgroundColor = 'var(--background-secondary-alt)';
    header.style.gap = '8px';

    // Icon
    const iconEl = header.createSpan({ cls: CSS.headerIcon });
    iconEl.style.display = 'flex';
    iconEl.style.alignItems = 'center';
    setIcon(iconEl, panel.icon);

    // Title
    const titleEl = header.createSpan({ cls: CSS.headerTitle, text: panel.displayName });
    titleEl.style.flex = '1';
    titleEl.style.fontWeight = '500';

    // Chevron (if collapsible)
    if (isCollapsible) {
      const chevronEl = header.createSpan({ cls: CSS.headerChevron });
      chevronEl.style.display = 'flex';
      chevronEl.style.alignItems = 'center';
      chevronEl.style.color = 'var(--text-muted)';
      setIcon(chevronEl, isCollapsed ? 'chevron-right' : 'chevron-down');

      // Click handler
      header.addEventListener('click', () => {
        this.toggleCollapse(panel.id);
      });
      header.style.cursor = 'pointer';
    }

    // Content
    const content = section.createDiv({
      cls: [CSS.content, isCollapsed ? CSS.contentHidden : ''].filter(Boolean),
    });
    if (isCollapsed) {
      content.style.display = 'none';
    }

    // Let panel render its content
    panel.render(content);

    // Initial update with current context
    panel.update(this.context);

    return section;
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  /**
   * Dispose all panels and cleanup
   */
  dispose(): void {
    for (const panel of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
    this.panelElements.clear();
    this.collapseState.clear();
    this.container.empty();
  }
}
