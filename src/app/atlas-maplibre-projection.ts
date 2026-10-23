import type {CRS} from 'maplibre-gl';
import {metricProjectionParameters, type AtlasMetricRoot} from './atlas-metric-space';

const PREFIX = 'saltmarcher-meter-plane-v1:';

/** One definition/decoder for the renderer and MapLibre's GeoJSON workers. */
export function atlasMetricProjection(definition: string): CRS['projection'] {
  if (!definition.startsWith(PREFIX)) throw new Error('Unknown Atlas projection definition');
  const encoded = definition.slice(PREFIX.length), units = Number(encoded);
  if (!Number.isFinite(units) || units <= 0 || String(units) !== encoded)
    throw new Error('Invalid Atlas projection scale');
  return {
    forward: ([x, y]) => [x! * units, y! * units],
    inverse: ([x, y]) => [x! / units, y! / units],
  };
}

export function atlasMetricCRS(name: string, root: AtlasMetricRoot): CRS {
  const parameters = metricProjectionParameters(root);
  const definition = PREFIX + String(parameters.unitsPerCoordinate);
  return {name, definition, projection: atlasMetricProjection(definition), tileMatrixSet: parameters.tileMatrixSet};
}
