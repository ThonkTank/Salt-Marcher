/**
 * UI Style Constants
 *
 * Reusable CSS-in-JS strings for consistent styling.
 * Uses Obsidian CSS variables with fallbacks.
 *
 * @module constants/ui-styles
 */

// ============================================================================
// CSS Variable Values (for property-based assignment)
// ============================================================================

/** Obsidian border color variable with fallback */
export const BORDER_COLOR = 'var(--background-modifier-border, #ddd)';

/** Obsidian muted text color variable with fallback */
export const TEXT_MUTED_COLOR = 'var(--text-muted, #888)';

// ============================================================================
// Text Styles (for cssText assignment)
// ============================================================================

/** Muted/secondary text color as CSS property */
export const MUTED_TEXT = `color: ${TEXT_MUTED_COLOR};`;

// ============================================================================
// Background Styles
// ============================================================================

/** Secondary background for panels */
export const SECONDARY_BG = 'background: var(--background-secondary, #f5f5f5);';

// ============================================================================
// Layout Patterns
// ============================================================================

/** Flexbox row with space-between alignment */
export const FLEX_BETWEEN = 'display: flex; justify-content: space-between; align-items: center;';

// ============================================================================
// Section Styles
// ============================================================================

/** Standard section with bottom border separator */
export const SECTION_STYLE = `margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid ${BORDER_COLOR};`;

/** Small label text style */
export const LABEL_STYLE = `font-size: 0.85em; ${MUTED_TEXT} margin-bottom: 4px;`;

// ============================================================================
// Component Styles
// ============================================================================

/** Side panel container style */
export const PANEL_STYLE = `padding: 12px; ${SECONDARY_BG} border-left: 1px solid ${BORDER_COLOR};`;
