/**
 * DetailView Types
 *
 * Types and constants for the DetailView component.
 * DetailView is a companion view to SessionRunner that displays
 * contextual information in the right sidebar.
 */

import type { RenderHint } from '@core/types/render';

// ═══════════════════════════════════════════════════════════════
// View Type Constants
// ═══════════════════════════════════════════════════════════════

/** Obsidian view type identifier */
export const DETAIL_VIEW_TYPE = 'salt-marcher-detail-view';

// ═══════════════════════════════════════════════════════════════
// View State
// ═══════════════════════════════════════════════════════════════

/**
 * DetailView state (minimal - no domain state ownership)
 *
 * DetailView does not own any domain state. It receives context
 * via EventBus from SessionRunner and displays it.
 */
export interface DetailViewState {
  /** Render hint for optimized updates */
  renderHint: RenderHint;
}
