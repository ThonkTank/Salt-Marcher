/**
 * Cartographer Workmode - Public API
 *
 * Visual hex map editor for the SaltMarcher plugin.
 *
 * @example
 * ```typescript
 * import { CARTOGRAPHER_VIEW_TYPE, createCartographerViewFactory } from '@/application/cartographer';
 *
 * // In plugin onload()
 * const viewFactory = createCartographerViewFactory(geographyService, eventBus);
 * this.registerView(CARTOGRAPHER_VIEW_TYPE, viewFactory);
 *
 * // Add ribbon icon
 * this.addRibbonIcon('map', 'Open Cartographer', () => {
 *   this.app.workspace.getLeaf(true).setViewState({
 *     type: CARTOGRAPHER_VIEW_TYPE,
 *   });
 * });
 * ```
 */

// View
export {
  CARTOGRAPHER_VIEW_TYPE,
  CartographerView,
  createCartographerViewFactory,
} from './view';

// ViewModel
export {
  CartographerViewModel,
  createCartographerViewModel,
} from './viewmodel';

// Types
export type {
  ToolMode,
  ToolType,
  FalloffType,
  BrushMode,
  BrushSettings,
  CameraState,
  CartographerState,
  RenderHint,
  StateListener,
  ToolInfo,
} from './types';

export {
  INITIAL_STATE,
  DEFAULT_BRUSH_SETTINGS,
  DEFAULT_CAMERA,
  TOOLS,
  getToolInfo,
} from './types';

// Services (for advanced usage)
export {
  UndoService,
  createUndoService,
  BrushService,
  createBrushService,
} from './services';

// Panels (for customization)
export {
  HexCanvas,
  createHexCanvas,
  Toolbar,
  createToolbar,
  ToolPanel,
  createToolPanel,
  showNewMapDialog,
  showOpenMapDialog,
  showDeleteMapDialog,
  showUnsavedChangesDialog,
} from './panels';

// Utils (for advanced usage)
export {
  calculateFalloff,
  getFalloffTypes,
  getFalloffLabel,
  applyBrushValue,
  applyBrushIntValue,
  getBrushModes,
  getBrushModeLabel,
  getBrushCoords,
  getBrushCoordsFiltered,
  hitTestHex,
  hitTestHexBounded,
  screenToWorld,
  worldToScreen,
  zoomAtPoint,
  clampZoom,
} from './utils';
