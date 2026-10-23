import type {Map as MapLibreMap} from 'maplibre-gl';
import {metricMapCamera, metricCameraPose, type AtlasMetricRoot, type AtlasMetricPose} from './atlas-metric-space';

type CameraMap = Pick<MapLibreMap, 'jumpTo' | 'setCenterClampedToGround' | 'getCenter' | 'getZoom' | 'getBearing' | 'getPitch' | 'getCenterElevation'>;

/** Atlas terrain lives in Deck. MapLibre's default DEM clamp would replace an
 * explicit focus height with zero each frame when no MapLibre DEM is installed.
 * Validate the entire pose before changing either camera setting. */
export function applyAtlasMapLibreCamera(map: CameraMap, root: AtlasMetricRoot, pose: AtlasMetricPose, exaggeration = 1): void {
  const camera = metricMapCamera(root, pose, exaggeration);
  map.setCenterClampedToGround(false);
  map.jumpTo(camera);
}

/** Keep physical height separate from the display's vertical exaggeration. */
export function readAtlasMapLibreCamera(map: CameraMap, root: AtlasMetricRoot, exaggeration = 1): AtlasMetricPose {
  const center = map.getCenter();
  return metricCameraPose(root, {center: [center.lng, center.lat], zoom: map.getZoom(),
    bearing: map.getBearing(), pitch: map.getPitch(), elevation: map.getCenterElevation()}, exaggeration);
}
