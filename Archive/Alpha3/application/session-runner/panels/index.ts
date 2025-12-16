/**
 * Panels - Public API
 *
 * Modular sidebar panel system for SessionRunner.
 */

// Base interfaces and types
export type {
  SidebarPanel,
  PanelContext,
  PanelRegistry,
  PanelState,
  PanelsState,
  PanelConfig,
} from './base-panel';
export { createDefaultContext } from './base-panel';

// Container
export { SidebarContainer } from './sidebar-container';

// Built-in panels
export { TravelPanel, type TravelPanelCallbacks } from './travel';
export { CalendarPanel, type CalendarPanelCallbacks } from './calendar';
// Note: EncounterPanel has moved to detail-view/panels/encounter
