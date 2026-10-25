import {
  defaultTerritoryLayers,
  validateTerritoryLayer,
  validateTerritory,
  territoryBounds,
  territoryStroke,
  territoryVertex,
  polygonArea,
  type TerritoryState,
  type TerritoryAction,
  type AtlasTerritory,
  type AtlasTerritoryLayer,
} from '../atlas-territories';
import { subtractPolygons, intersectPolygons } from '../landscape-brush';
import type { LandscapeBox } from '../atlas-landscape';
export function installTerritories(db: any) {
  db.exec(`
 CREATE TABLE IF NOT EXISTS atlas_territory_layer(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS atlas_territory(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,revision INTEGER NOT NULL,min_x REAL NOT NULL,max_x REAL NOT NULL,min_y REAL NOT NULL,max_y REAL NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE INDEX IF NOT EXISTS territory_area ON atlas_territory(campaign_id,min_x,max_x,min_y,max_y);
 `);
}
export function readTerritories(db: any, cam: string, box?: LandscapeBox): TerritoryState {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name='atlas_territory'").get())
    return { layers: defaultTerritoryLayers(), territories: [] };
  const saved = db
    .prepare('SELECT payload FROM atlas_territory_layer WHERE campaign_id=?')
    .all(cam)
    .map((r: any) => JSON.parse(r.payload)) as AtlasTerritoryLayer[];
  const layers = [
    ...defaultTerritoryLayers().map((l) => saved.find((s) => s.id === l.id) ?? l),
    ...saved.filter((l) => !['geography', 'politics'].includes(l.id)),
  ].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  if (
    box &&
    (![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
      box.width <= 0 ||
      box.height <= 0)
  )
    throw Error('Regionsausschnitt prüfen.');
  const rows = db
    .prepare(
      'SELECT * FROM atlas_territory WHERE campaign_id=?' +
        (box ? ' AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=?' : '') +
        ' ORDER BY id',
    )
    .iterate(cam, ...(box ? [box.x, box.x + box.width, box.y, box.y + box.height] : []));
  const territories: AtlasTerritory[] = [];
  let bytes = 0;
  for (const row of rows) {
    bytes += Buffer.byteLength(row.payload);
    if (bytes > 8 * 1024 * 1024) throw Error('Regionsausschnitt zu groß. Weiter hineinzoomen.');
    const t = JSON.parse(row.payload) as AtlasTerritory;
    const b = territoryBounds(t.polygons);
    if (
      t.id !== row.id ||
      t.revision !== row.revision ||
      b.x !== row.min_x ||
      b.x + b.width !== row.max_x ||
      b.y !== row.min_y ||
      b.y + b.height !== row.max_y
    )
      throw Error('Regionsspeicher widerspricht seiner Geometrie.');
    if (t.locationId) {
      const location = db
        .prepare('SELECT payload,trashed FROM location WHERE campaign_id=? AND id=?')
        .get(cam, t.locationId);
      if (location && !location.trashed) t.name = JSON.parse(location.payload).name;
    }
    territories.push(t);
  }
  return { layers, territories };
}
function put(db: any, cam: string, t: AtlasTerritory) {
  const b = territoryBounds(t.polygons);
  db.prepare(
    'INSERT INTO atlas_territory VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,min_x=excluded.min_x,max_x=excluded.max_x,min_y=excluded.min_y,max_y=excluded.max_y,payload=excluded.payload',
  ).run(cam, t.id, t.revision, b.x, b.x + b.width, b.y, b.y + b.height, JSON.stringify(t));
}
export function executeTerritory(db: any, cam: string, a: TerritoryAction) {
  const state = readTerritories(db, cam);
  if (a.kind === 'territory-layer') {
    validateTerritoryLayer(a.layer);
    const old = state.layers.find((l) => l.id === a.layer.id),
      revision = old?.revision || null;
    if (revision !== a.expectedRevision) throw Error('Regionsebene inzwischen geändert.');
    if (
      state.territories.some(
        (t) => t.layerId === a.layer.id && !a.layer.types.some((k) => k.id === t.typeId),
      )
    )
      throw Error('Ein verwendeter Regionstyp darf nicht entfernt werden.');
    const next = { ...a.layer, revision: (revision ?? 0) + 1 };
    db.prepare(
      'INSERT INTO atlas_territory_layer VALUES(?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload',
    ).run(cam, next.id, next.revision, JSON.stringify(next));
    return;
  }
  const id = a.kind === 'territory-put' ? a.territory.id : a.id,
    old = state.territories.find((t) => t.id === id);
  if ((old?.revision ?? null) !== a.expectedRevision) throw Error('Region inzwischen geändert.');
  if (a.kind === 'territory-remove') {
    if (state.territories.some((t) => t.parentId === id))
      throw Error('Unterregionen zuerst neu zuordnen.');
    db.prepare('DELETE FROM atlas_territory WHERE campaign_id=? AND id=?').run(cam, id);
    return;
  }
  let changes: AtlasTerritory[];
  if (a.kind === 'territory-put') {
    const t = structuredClone(a.territory);
    if (
      t.locationId &&
      !db
        .prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0')
        .get(cam, t.locationId)
    )
      throw Error('Verknüpfter Ort fehlt.');
    const next = {
      ...state,
      territories: [...state.territories.filter((x) => x.id !== id), t],
    };
    validateTerritory(t, next);
    if (
      state.territories.some(
        (s) =>
          s.id !== id &&
          s.layerId === t.layerId &&
          s.parentId === t.parentId &&
          polygonArea(intersectPolygons(s.polygons, t.polygons)) > 1e-5,
      )
    )
      throw Error('Gemeinsame Grenzen mit dem Regionenpinsel bearbeiten.');
    for (const child of next.territories) validateTerritory(child, next);
    changes = [t];
  } else {
    if (!old) throw Error('Region fehlt.');
    if (a.kind === 'territory-stroke')
      changes = territoryStroke(state, id, a.points, a.radius, a.operation);
    else {
      changes = territoryVertex(state, id, a);
    }
  }
  for (const t of changes)
    put(db, cam, {
      ...t,
      revision: (state.territories.find((o) => o.id === t.id)?.revision ?? 0) + 1,
    });
}
export function validateTerritories(db: any) {
  for (const table of ['atlas_territory', 'atlas_territory_layer'])
    if (!db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(table))
      throw Error('Regionsspeicher fehlt.');
  for (const { id } of db.prepare('SELECT id FROM campaign').iterate()) {
    const state = readTerritories(db, id);
    state.layers.forEach(validateTerritoryLayer);
    for (const t of state.territories) {
      validateTerritory(t, state);
      if (
        t.locationId &&
        !db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?').get(id, t.locationId)
      )
        throw Error('Regionsort fehlt.');
      for (const sibling of state.territories)
        if (
          sibling.id > t.id &&
          sibling.layerId === t.layerId &&
          sibling.parentId === t.parentId &&
          polygonArea(intersectPolygons(t.polygons, sibling.polygons)) > 1e-5
        )
          throw Error('Regionsflächen überschneiden sich.');
      if (t.parentId) {
        const p = state.territories.find((p) => p.id === t.parentId)!;
        if (polygonArea(subtractPolygons(t.polygons, p.polygons)) > 1e-5)
          throw Error('Regionszugehörigkeit beschädigt.');
      }
    }
  }
}
