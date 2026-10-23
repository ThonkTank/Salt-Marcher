import * as maplibre from 'maplibre-gl';
import {preloadAtlasMapLibreFonts} from './atlas-maplibre-assets';

export {maplibre};
export {AtlasMapLibreBridge} from './atlas-maplibre-bridge';
export {atlasMetricCRS} from './atlas-maplibre-projection';
export {queryRenderedFeaturesMetricSafe} from './atlas-metric-query';
export {buildAtlasMapLibreSceneModel} from './atlas-maplibre-scene-model';
export {AtlasMapLibreScene} from './atlas-maplibre-scene';
export {metricMapCamera, metricLngLat} from './atlas-metric-space';
export {applyAtlasMapLibreCamera, readAtlasMapLibreCamera} from './atlas-maplibre-camera';
export {atlasMapLibreFontStyle, installAtlasMapLibreSymbols,
  ATLAS_MAPLIBRE_FONT_STACK, ATLAS_MAPLIBRE_MARKER_IMAGE_ID} from './atlas-maplibre-assets';

let setup: {base: string; ready: Promise<void>} | undefined;

/** MapLibre owns one worker pool per renderer realm. Initialize it once before
 * creating a map. Assets are shipped with the app; no CDN or network fallback. */
export function initializeAtlasMapLibre(base = new URL('./', location.href).href): Promise<void> {
  const resolved = new URL(base, location.href);
  if (resolved.protocol !== location.protocol || resolved.host !== location.host ||
    resolved.origin !== location.origin || resolved.username || resolved.password ||
    !['campaign:', 'http:', 'https:'].includes(resolved.protocol))
    throw new Error('Atlas runtime assets must share the application origin');
  if (setup) {
    if (setup.base !== resolved.href) throw new Error('Atlas worker pool already uses a different asset root');
    return setup.ready;
  }
  if (maplibre.getVersion() !== '6.15.0') throw new Error('Unsupported Atlas MapLibre runtime');
  maplibre.setWorkerUrl(new URL('atlas-maplibre-worker.mjs', resolved).href);
  const ready = Promise.all([
    maplibre.importScriptInWorkers(new URL('atlas-maplibre-projection-worker.mjs', resolved).href),
    preloadAtlasMapLibreFonts({base: resolved.href, document})
  ]).then(() => undefined);
  setup = {base: resolved.href, ready};
  return ready;
}
