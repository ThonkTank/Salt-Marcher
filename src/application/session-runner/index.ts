/**
 * SessionRunner - Public API
 *
 * Main play view for map display, travel, and session management.
 */

// Types
export { VIEW_TYPE_SESSION_RUNNER } from './types';
export type { RenderState, RenderHint, TravelInfo } from './types';

// ViewModel
export {
  createSessionRunnerViewModel,
  type SessionRunnerViewModel,
  type SessionRunnerViewModelDeps,
} from './viewmodel';

// View
export {
  SessionRunnerView,
  createSessionRunnerViewFactory,
  type SessionRunnerViewDeps,
} from './view';

// Panels (for testing/customization)
export {
  createMapCanvas,
  createControlsPanel,
  type MapCanvasPanel,
  type ControlsPanel,
} from './panels';
