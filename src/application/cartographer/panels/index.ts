/**
 * Cartographer Panels
 *
 * Panels are implemented in subsequent tasks:
 * - #2502: Tool-Palette Panel (terrain, elevation, feature brushes)
 * - #2564: Layer-Control Panel (visibility, lock toggles) ✅
 * - #2517: Map-Canvas Panel (hex/grid rendering)
 */

// Layer-Control Panel (#2564)
export {
  createLayerControlPanel,
  type LayerControlPanel,
  type LayerControlPanelCallbacks,
} from './layer-control';
