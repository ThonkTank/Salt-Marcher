import { validateLakeBed } from '../atlas/terrain-lake-brush';
import { checkedRow } from './sqlite-connection';
import * as shape from './stored-shapes';
import { terrainValue } from '../atlas/atlas-landscape';
import { validateProminence } from '../atlas/atlas-prominence';
import { validateMask } from '../atlas/land-mask';
import { validateColor } from '../atlas/landscape-brush';
import { validateLine } from '../atlas/landscape-line';
import { validateMapLabelStyle } from '../atlas/map-label-style';
import { validateTerrain } from '../atlas/terrain-height';
import { validateRoute } from '../atlas/terrain-route';
import { validateVegetation } from '../atlas/vegetation';
/** Pure canonical value validation shared by facade reads and the existing writer. */
export function checkedLandscapeValue(value: unknown) {
  const r = shape.atlas_landscape(value);
  if (
    !r.id ||
    !Number.isSafeInteger(r.revision) ||
    r.revision < 0 ||
    r.width < 0 ||
    r.resolution <= 0
  )
    throw new Error('Landschaftsdaten prüfen.');
  validateMapLabelStyle(r.label);
  validateProminence(r.prominence);
  if (r.prominence !== undefined && r.kind !== 'road' && r.kind !== 'river')
    throw new Error('Kartenprominenz gehört zu Straßen und Flüssen.');
  validateVegetation(r);
  validateRoute(r);
  validateMask(r);
  validateTerrain(r);
  validateLakeBed(r);
  validateLine(r);
  validateColor(r);
  const points = [...r.points, ...r.polygons.flatMap((p) => [...p.outer, ...p.holes.flat()])];
  if (
    !points.length ||
    points.length > 100000 ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    throw new Error('Landschaftsgeometrie prüfen.');
  if ((r.kind === 'river' || r.kind === 'road') && (r.points.length < 2 || r.width <= 0))
    throw new Error('Verlauf braucht zwei Punkte und positive Breite.');
  if (r.kind === 'patch' && (!r.polygons.length || r.polygons.some((p) => p.outer.length < 3)))
    throw new Error('Geländefläche fehlt.');
  if (r.values.elevationM !== undefined && !Number.isFinite(r.values.elevationM))
    throw new Error('Höhenwert prüfen.');
  if (
    r.values.climate !== undefined &&
    r.values.climate !== null &&
    !['temperate', 'cold', 'arid', 'tropical'].includes(r.values.climate)
  )
    throw new Error('Klima prüfen.');
  if (r.values.terrain !== undefined && !terrainValue(r.values.terrain))
    throw new Error('Geländeart prüfen.');
  if (
    r.kind === 'reference' &&
    (!r.assetId ||
      r.width <= 0 ||
      !Number.isFinite(r.angle) ||
      !Number.isFinite(r.opacity) ||
      r.opacity! < 0 ||
      r.opacity! > 1)
  )
    throw new Error('Bildkalibrierung prüfen.');
  return r;
}

export function checkedLandscapeRow(value: unknown) {
  const row = checkedRow(value, { id: 'text', revision: 'integer', payload: 'text' });
  const parsed: unknown = JSON.parse(row.payload),
    record = checkedLandscapeValue(parsed);
  if (record.id !== row.id || record.revision !== row.revision || row.revision < 1)
    throw new Error('Landschaftsidentität oder Revision widersprüchlich.');
  return record;
}
