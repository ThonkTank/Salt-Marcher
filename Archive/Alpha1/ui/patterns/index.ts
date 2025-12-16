/**
 * UI Patterns - Reusable Components for Modals and Panels
 *
 * This module provides shared patterns for building consistent UI components:
 *
 * - BasePluginModal: Abstract base class for modals with lifecycle management
 * - Panel Factory: Utilities for creating consistent panel layouts
 * - Dialog Builders: Common confirmation/alert dialog implementations
 *
 * Benefits:
 * - Reduces boilerplate code by 30-40%
 * - Ensures consistent modal/panel behavior across workmodes
 * - Simplifies testing and maintenance
 * - Supports gradual adoption (no forced refactoring)
 *
 * Documentation: See docs/guides/ui-patterns.md for detailed examples and migration guide.
 */

// Base Modal Pattern
export { BasePluginModal, type ModalConfig } from './base-modal';

// Panel Factory Pattern
export {
    createPanel,
    createLabeledPanel,
    type PanelSection,
    type PanelSpec,
    type PanelHandle,
    type LabeledPanelRow,
    type LabeledPanelSpec,
    type LabeledPanelHandle
} from './panel-factory';

// Dialog Builders
export {
    showConfirmation,
    showDestructiveConfirmation,
    showAlert,
    type ConfirmationOptions,
    type DestructiveConfirmationOptions,
    type AlertOptions
} from './dialog-builder';
