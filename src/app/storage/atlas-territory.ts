import {
  applyTerritory,
  defaultRegionLayers,
  validateLayer,
  validateTerritory,
  type AtlasRegionLayer,
} from "../atlas-territory";
import { putLandscape } from "./atlas-landscape";
import type { LandscapeAction, LandscapeRecord } from "../atlas-landscape";
export function readRegionLayers(db: any, cam: string): AtlasRegionLayer[] {
  const layers = new Map(defaultRegionLayers.map((l) => [l.id, { ...l }]));
  for (const r of db
    .prepare(
      "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.kind')='region-layer'",
    )
    .all(cam)) {
    const l = JSON.parse(r.payload).regionLayer;
    validateLayer(l);
    layers.set(l.id, l);
  }
  return [...layers.values()].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
}
export function executeTerritory(
  db: any,
  cam: string,
  a: Extract<
    LandscapeAction,
    {
      kind:
        | "landscape-territory"
        | "landscape-region-layer"
        | "landscape-territory-delete";
    }
  >,
) {
  if (a.kind === "landscape-region-layer") {
    if (a.record.kind !== "region-layer") throw Error("Regionsebene erwartet.");
    const l = a.record.regionLayer!;
    validateLayer(l);
    if (a.record.id !== "region-layer:" + l.id)
      throw Error("Ebenenkennung geändert.");
    const layers = readRegionLayers(db, cam);
    if (!layers.some((v) => v.id === l.id) && layers.length >= 64)
      throw Error("Höchstens 64 Regionsebenen.");
    putLandscape(db, cam, a.record, a.expectedRevision);
    return;
  }
  const id = a.kind === "landscape-territory-delete" ? a.id : a.record.id;
  const records: LandscapeRecord[] = db
    .prepare(
      "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.kind')='territory'",
    )
    .all(cam)
    .map((r: any) => JSON.parse(r.payload));
  const old = records.find((r) => r.id === id);
  if ((old?.revision ?? null) !== a.expectedRevision)
    throw Error("Region inzwischen geändert. Neu laden.");
  if (a.kind === "landscape-territory-delete") {
    if (
      !old ||
      !Number.isSafeInteger(a.expectedRevision) ||
      a.expectedRevision < 1
    )
      throw Error("Region fehlt oder Versionskennung ist ungültig.");
    if (records.some((r) => r.territory!.parentId === id))
      throw Error("Untergebiete zuerst umhängen oder löschen.");
    db.prepare("DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?").run(
      cam,
      id,
    );
    return;
  }
  validateTerritory(a.record);
  if (
    !readRegionLayers(db, cam).some((l) => l.id === a.record.territory!.layerId)
  )
    throw Error("Regionsebene fehlt.");
  for (const r of applyTerritory(records, a.record))
    putLandscape(
      db,
      cam,
      r,
      records.find((x) => x.id === r.id)?.revision ?? null,
    );
}
