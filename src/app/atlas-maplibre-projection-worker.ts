import type {CRS} from 'maplibre-gl';
import {atlasMetricProjection} from './atlas-maplibre-projection';

// Executed by MapLibre.importScriptInWorkers, after its own worker bootstrap.
const worker = globalThis as unknown as {
  setProjectionHandler(handler: (definition: string) => CRS['projection']): void;
};
if (typeof worker.setProjectionHandler !== 'function') throw new Error('Atlas projection requires a MapLibre worker');
worker.setProjectionHandler(atlasMetricProjection);
