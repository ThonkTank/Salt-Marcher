import { createHash } from 'node:crypto';
// Free-form, metric property regions for current continuous-terrain test worlds.
// No cell coordinates, cell ownership, or regular terrain grid is generated.
export function continuousTerrainPatch(id, x, y, resolution, values, index = 0) {
  const angle = ((index * 0.618033988749895) % 1) * Math.PI * 2;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const outline = [
    [-0.53, -0.18],
    [-0.4, -0.5],
    [-0.1, -0.38],
    [0.21, -0.52],
    [0.52, -0.13],
    [0.44, 0.25],
    [0.14, 0.55],
    [-0.24, 0.42],
    [-0.51, 0.19],
  ];
  return {
    id,
    revision: 0,
    kind: 'patch',
    name: 'Geländefläche ' + index,
    points: [],
    polygons: [
      {
        outer: outline.map(([a, b]) => ({
          x: x + (a * cos - b * sin) * resolution,
          y: y + (a * sin + b * cos) * resolution,
        })),
        holes: [],
      },
    ],
    resolution,
    width: 0,
    values,
    propertyOnly: true,
  };
}

// Explicit rebuild of a disposable historical fixture, never a product migration.
export function rebuildContinuousFixture(db) {
  const rows = db
    .prepare(
      "SELECT campaign_id,id,payload FROM atlas_landscape WHERE json_extract(payload,'$.sourceCell') IS NOT NULL ORDER BY campaign_id,id",
    )
    .all();
  const update = db.prepare(
    'UPDATE atlas_landscape SET min_x=?,max_x=?,min_y=?,max_y=?,payload=? WHERE campaign_id=? AND id=?',
  );
  db.transaction(() => {
    for (const [i, row] of rows.entries()) {
      const record = JSON.parse(row.payload),
        points = record.polygons.flatMap((p) => p.outer);
      const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
      const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
      const patch = {
        ...record,
        ...continuousTerrainPatch(record.id, x, y, record.resolution, record.values, i),
        revision: record.revision,
      };
      delete patch.sourceCell;
      const outline = patch.polygons[0].outer;
      update.run(
        Math.min(...outline.map((p) => p.x)),
        Math.max(...outline.map((p) => p.x)),
        Math.min(...outline.map((p) => p.y)),
        Math.max(...outline.map((p) => p.y)),
        JSON.stringify(patch),
        row.campaign_id,
        row.id,
      );
    }
    // The travel grid's metric remains available, but it is not a terrain source.
    for (const row of db
      .prepare("SELECT campaign_id,id,payload FROM world_record WHERE kind='map'")
      .all()) {
      const map = JSON.parse(row.payload);
      map.cells = [];
      const payload = JSON.stringify(map);
      db.prepare(
        "UPDATE world_record SET payload=?,checksum=? WHERE campaign_id=? AND kind='map' AND id=?",
      ).run(payload, createHash('sha256').update(payload).digest('hex'), row.campaign_id, row.id);
    }
  })();
  return rows.length;
}
