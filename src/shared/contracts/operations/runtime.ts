import { z } from 'zod'
import { svgSymbolFileResultSchema } from '../location-symbol.js'
import { coreProcessStatusSchema, rendererIncidentSchema } from '../runtime.js'
import { runtimeGpuObservationSchema } from '../../qualification/runtime-observation.js'
import { none, read, write } from './registry.js'

export const runtimeOperationDefinitions = {
  'runtime.memory': read(
    'runtime:memory',
    none,
    z.number().int().nonnegative(),
    ['gm', 'qualification']
  ),
  'runtime.gpuObservation': read(
    'runtime:gpu-observation',
    none,
    runtimeGpuObservationSchema,
    ['gm', 'qualification']
  ),
  'runtime.coreStatus': read(
    'runtime:core-status',
    none,
    coreProcessStatusSchema,
    ['gm', 'passive', 'qualification']
  ),
  'runtime.retryCore': write(
    'runtime:retry-core',
    none,
    coreProcessStatusSchema,
    ['gm', 'qualification']
  ),
  'runtime.reportRendererIncident': write(
    'runtime:report-renderer-incident',
    rendererIncidentSchema,
    none,
    ['gm']
  ),
  'runtime.reloadRenderer': write('runtime:reload-renderer', none, none, [
    'gm'
  ]),
  'runtime.pickLocationSymbolFile': write(
    'runtime:pick-location-symbol-file',
    none,
    svgSymbolFileResultSchema,
    ['gm']
  )
} as const
