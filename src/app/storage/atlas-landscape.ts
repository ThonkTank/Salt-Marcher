import { createHash, randomUUID } from "node:crypto";
import polygonClipping from "polygon-clipping";
import type { Polygon } from "../contracts";
import {
  bounds,
  hexPolygon,
  HEX_METERS,
  terrainValue,
  type LandscapeRecord,
  type LandscapeBox,
  type LandscapeAction,
} from "../atlas-landscape";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const clip = (polys: Polygon[]) =>
  polys.map((p) =>
    [p.outer, ...p.holes].map((r) =>
      r.map((p) => [p.x, p.y] as [number, number]),
    ),
  );
const unclip = (a: ReturnType<typeof polygonClipping.difference>): Polygon[] =>
  a.map((p) => ({
    outer: p[0]!.map(([x, y]) => ({ x, y })),
    holes: p.slice(1).map((r) => r.map(([x, y]) => ({ x, y }))),
  }));
export function installLandscape(db: any) {
  db.exec(`
 CREATE TABLE IF NOT EXISTS atlas_landscape(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,revision INTEGER NOT NULL,min_x REAL NOT NULL,max_x REAL NOT NULL,min_y REAL NOT NULL,max_y REAL NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE INDEX IF NOT EXISTS landscape_area ON atlas_landscape(campaign_id,min_x,max_x,min_y,max_y);
 CREATE TABLE IF NOT EXISTS atlas_reference_asset(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS atlas_landscape_migration(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id)) STRICT;
 `);
  for (const root of db
    .prepare(
      "SELECT * FROM campaign_atlas WHERE campaign_id NOT IN(SELECT campaign_id FROM atlas_landscape_migration)",
    )
    .all()) {
    const row = db
      .prepare(
        "SELECT * FROM world_record WHERE campaign_id=? AND kind='map' AND id=?",
      )
      .get(root.campaign_id, root.map_id);
    if (!row) continue;
    const map = JSON.parse(row.payload);
    const hadCells = map.cells.length > 0;
    for (const c of map.cells) {
      const { q, r, level, ...values } = c;
      putLandscape(
        db,
        root.campaign_id,
        {
          id: randomUUID(),
          revision: 0,
          kind: "patch",
          name: "Übernommenes Gelände",
          points: [],
          polygons: [hexPolygon(q, r, map.hexMeters * (map.metricVersion===2?3:2) ** level)],
          resolution: map.hexMeters * (map.metricVersion===2?3:2) ** level,
          width: 0,
          values,
        },
        null,
      );
    }
    for (const place of db
      .prepare(
        "SELECT a.*,l.payload FROM atlas_place a JOIN location l ON l.campaign_id=a.campaign_id AND l.id=a.location_id WHERE a.campaign_id=? AND a.map_id=? AND l.trashed=0 AND NOT EXISTS(SELECT 1 FROM city_document c WHERE c.campaign_id=a.campaign_id AND c.location_id=a.location_id)",
      )
      .all(root.campaign_id, root.map_id)) {
      if (
        db
          .prepare(
            "SELECT 1 FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.locationId')=?",
          )
          .get(root.campaign_id, place.location_id)
      )
        continue;
      putLandscape(
        db,
        root.campaign_id,
        {
          id: randomUUID(),
          revision: 0,
          kind: "place",
          name: JSON.parse(place.payload).name,
          points: [
            {
              x: (place.q + place.r / 2) * map.hexMeters,
              y: ((place.r * Math.sqrt(3)) / 2) * map.hexMeters,
            },
          ],
          polygons: [],
          resolution: HEX_METERS,
          width: 0,
          values: {},
          locationId: place.location_id,
        },
        null,
      );
    }
    if (map.hexMeters !== HEX_METERS)
      for (const row of db
        .prepare("SELECT * FROM scene_position WHERE campaign_id=?")
        .all(root.campaign_id)) {
        const p = JSON.parse(row.payload);
        if (p.mapId !== root.map_id || p.outdoor || p.city || p.dungeon)
          continue;
        p.outdoor = {
          x: (p.q + p.r / 2) * map.hexMeters,
          y: ((p.r * Math.sqrt(3)) / 2) * map.hexMeters,
        };
        const payload = JSON.stringify(p);
        db.prepare(
          "UPDATE scene_position SET payload=?,checksum=? WHERE campaign_id=? AND scene_id=?",
        ).run(payload, hash(payload), root.campaign_id, row.scene_id);
      }
    // Preserve exact old footprints. A new grid never resamples existing author work.
    map.cells = [];
    map.hexMeters = HEX_METERS;
    map.metricVersion = 2;
    const payload = JSON.stringify(map);
    db.prepare(
      "UPDATE world_record SET payload=?,checksum=? WHERE campaign_id=? AND kind='map' AND id=?",
    ).run(payload, hash(payload), root.campaign_id, root.map_id);
    if (hadCells) {
      db.prepare("DELETE FROM atlas_command WHERE campaign_id=?").run(
        root.campaign_id,
      );
      db.prepare("UPDATE campaign_atlas SET cursor=0 WHERE campaign_id=?").run(
        root.campaign_id,
      );
    }
    db.prepare("INSERT INTO atlas_landscape_migration VALUES(?)").run(
      root.campaign_id,
    );
  }
}
export function landscapeRegion(
  db: any,
  cam: string,
  box?: LandscapeBox,
  metersPerPixel=0,
): LandscapeRecord[] {
  if (
    box &&
    (!Object.values(box).every(Number.isFinite) ||
      box.width <= 0 ||
      box.height <= 0)
  )
    throw new Error("Ausschnitt prüfen.");
  if(!Number.isFinite(metersPerPixel)||metersPerPixel<0)throw new Error('Darstellungsmaßstab prüfen.');
  const select =
    "SELECT a.payload,l.payload location_payload,l.trashed FROM atlas_landscape a LEFT JOIN location l ON l.campaign_id=a.campaign_id AND l.id=json_extract(a.payload,'$.locationId') WHERE a.campaign_id=?";
  const rows = box
    ? db
        .prepare(
          select +
            " AND a.max_x>=? AND a.min_x<=? AND a.max_y>=? AND a.min_y<=? AND ((a.max_x=a.min_x AND a.max_y=a.min_y) OR a.max_x-a.min_x>=? OR a.max_y-a.min_y>=?) ORDER BY a.rowid",
        )
        .all(cam, box.x, box.x + box.width, box.y, box.y + box.height,metersPerPixel/2,metersPerPixel/2)
    : db.prepare(select + " ORDER BY a.rowid").all(cam);
  return rows
    .filter((r: any) => !r.trashed)
    .map((r: any) => {
      const record = JSON.parse(r.payload);
      if (r.location_payload) record.name = JSON.parse(r.location_payload).name;
      return record;
    });
}
export function putLandscape(
  db: any,
  cam: string,
  r: LandscapeRecord,
  expected: number | null,
) {
  if (
    !r ||
    !["patch", "river", "road", "reference", "place"].includes(r.kind) ||
    typeof r.id !== "string" ||
    !r.id ||
    typeof r.name !== "string" ||
    !Array.isArray(r.points) ||
    !Array.isArray(r.polygons) ||
    !Number.isFinite(r.width) ||
    r.width < 0 ||
    !Number.isFinite(r.resolution) ||
    r.resolution <= 0 ||
    !r.values
  )
    throw new Error("Landschaftsdaten prüfen.");
  const pts = [
    ...r.points,
    ...r.polygons.flatMap((p) => [...p.outer, ...p.holes.flat()]),
  ];
  if (
    !pts.length ||
    pts.length > 100000 ||
    pts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    throw new Error("Landschaftsgeometrie prüfen.");
  if (
    (r.kind === "river" || r.kind === "road") &&
    (r.points.length < 2 || r.width <= 0)
  )
    throw new Error("Verlauf braucht zwei Punkte und positive Breite.");
  if (
    r.kind === "patch" &&
    (!r.polygons.length || r.polygons.some((p) => p.outer.length < 3))
  )
    throw new Error("Geländefläche fehlt.");
  if (
    r.values.elevationM !== undefined &&
    !Number.isFinite(r.values.elevationM)
  )
    throw new Error("Höhenwert prüfen.");
  if (
    r.values.climate !== undefined &&
    r.values.climate !== null &&
    !["temperate", "cold", "arid", "tropical"].includes(r.values.climate)
  )
    throw new Error("Klima: temperate, cold, arid oder tropical.");
  if (r.values.terrain !== undefined && !terrainValue(r.values.terrain))
    throw new Error("Geländeart prüfen.");
  if (
    r.kind === "reference" &&
    (!r.assetId ||
      !db
        .prepare(
          "SELECT 1 FROM atlas_reference_asset WHERE campaign_id=? AND id=?",
        )
        .get(cam, r.assetId) ||
      r.width <= 0 ||
      !Number.isFinite(r.angle) ||
      !Number.isFinite(r.opacity) ||
      r.opacity! < 0 ||
      r.opacity! > 1)
  )
    throw new Error("Bildkalibrierung prüfen.");
  const old = db
    .prepare(
      "SELECT revision FROM atlas_landscape WHERE campaign_id=? AND id=?",
    )
    .get(cam, r.id);
  if ((old?.revision ?? null) !== expected)
    throw new Error("Landschaft inzwischen geändert. Neu laden.");
  const b = bounds(r),
    next = {
      ...r,
      order:
        r.order ??
        db
          .prepare(
            "SELECT coalesce(max(json_extract(payload,'$.order')),0)+1 n FROM atlas_landscape WHERE campaign_id=?",
          )
          .get(cam).n,
      revision: (expected ?? 0) + 1,
    };
  db.prepare(
    "INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,min_x=excluded.min_x,max_x=excluded.max_x,min_y=excluded.min_y,max_y=excluded.max_y,payload=excluded.payload",
  ).run(
    cam,
    r.id,
    next.revision,
    b.x,
    b.x + b.width,
    b.y,
    b.y + b.height,
    JSON.stringify(next),
  );
}
export function executeLandscape(db: any, cam: string, a: LandscapeAction) {
  if (a.kind === "landscape-batch") {
    for (const r of a.records)
      putLandscape(db, cam, r.record, r.expectedRevision);
    return;
  }
  if (a.kind === "landscape-put" || a.kind === "landscape-place")
    return putLandscape(db, cam, a.record, a.expectedRevision);
  if (a.kind === "landscape-remove") {
    if (
      db
        .prepare(
          "DELETE FROM atlas_landscape WHERE campaign_id=? AND id=? AND revision=?",
        )
        .run(cam, a.id, a.expectedRevision).changes !== 1
    )
      throw new Error("Landschaft inzwischen geändert.");
    return;
  }
  if (
    ![
      "terrain",
      "elevationM",
      "climate",
      "road",
      "river",
      "label",
      "faction",
      "interrupt",
      "access",
    ].includes(a.field) ||
    !Number.isFinite(a.resolution) ||
    a.resolution <= 0
  )
    throw new Error("Zurücksetzbereich prüfen.");
  const records = landscapeRegion(
    db,
    cam,
    bounds({
      points: [],
      polygons: a.polygons,
      kind: "patch",
      width: 0,
    } as any),
  );
  for (const r of records) {
    if (
      r.kind !== "patch" ||
      r.resolution > a.resolution ||
      r.resolution <= a.resolution / 3 ||
      !Object.hasOwn(r.values, a.field)
    )
      continue;
    const outside = unclip(
        polygonClipping.difference(clip(r.polygons), clip(a.polygons)),
      ),
      inside = unclip(
        polygonClipping.intersection(clip(r.polygons), clip(a.polygons)),
      );
    if (!inside.length) continue;
    db.prepare("DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?").run(
      cam,
      r.id,
    );
    if (outside.length)
      putLandscape(db, cam, { ...r, polygons: outside }, null);
    const values = { ...r.values };
    delete values[a.field];
    if (Object.keys(values).length)
      putLandscape(
        db,
        cam,
        {
          ...r,
          id: outside.length ? randomUUID() : r.id,
          polygons: inside,
          values,
        },
        null,
      );
  }
}
