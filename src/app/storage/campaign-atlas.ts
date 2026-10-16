import { dungeonGeometry } from "./dungeon-play";
import { poseSpace } from "../spatial-3d";
import { inside } from "../drawing-model";
import { createHash, randomUUID } from "node:crypto";
import type { AtlasBinding, AtlasCommand } from "../campaign-atlas-contracts";
import type { AtlasMap } from "../world-contracts";
const hash = (v: string) => createHash("sha256").update(v).digest("hex"),
  json = JSON.stringify;
export function installCampaignAtlas(db: any) {
  db.exec(`
 CREATE TABLE IF NOT EXISTS atlas_import_source(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,source TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS campaign_atlas(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id),map_id TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,cursor INTEGER NOT NULL DEFAULT 0) STRICT;
 CREATE TABLE IF NOT EXISTS atlas_binding(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,kind TEXT NOT NULL,owner_id TEXT NOT NULL,parent TEXT NOT NULL,parent_id TEXT,x REAL NOT NULL,y REAL NOT NULL,angle REAL NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(campaign_id,id),UNIQUE(campaign_id,kind,owner_id)) STRICT;
 CREATE TABLE IF NOT EXISTS atlas_command(campaign_id TEXT NOT NULL REFERENCES campaign(id),ordinal INTEGER NOT NULL,command_id TEXT NOT NULL,label TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(campaign_id,ordinal)) STRICT;
 CREATE TABLE IF NOT EXISTS atlas_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,fingerprint TEXT NOT NULL) STRICT;
 `);
}
export function createCampaignAtlas(db: any, cam: string) {
  const id = randomUUID(),
    m: AtlasMap = {
      id,
      revision: 1,
      name: "Atlas",
      hexMeters: 4828.032,
      metricVersion: 2,
      climate: "temperate",
      seed: cam,
      cells: [],
    },
    payload = json(m);
  db.prepare("INSERT INTO world_record VALUES(?,?,?,?,?,?)").run(
    cam,
    "map",
    id,
    1,
    payload,
    hash(payload),
  );
  db.prepare("INSERT INTO campaign_atlas(campaign_id,map_id) VALUES(?,?)").run(
    cam,
    id,
  );
}
export function atlasRoot(db: any, cam: string) {
  const root = db
    .prepare("SELECT * FROM campaign_atlas WHERE campaign_id=?")
    .get(cam);
  if (!root)
    throw new Error(
      "Dieser alte Testbestand besitzt noch keinen gemeinsamen Atlas. Neue Kampagne anlegen.",
    );
  return root;
}
export function atlasBindings(db: any, cam: string): AtlasBinding[] {
  return db
    .prepare("SELECT * FROM atlas_binding WHERE campaign_id=? ORDER BY rowid")
    .all(cam)
    .map((r: any) => ({
      id: r.id,
      kind: r.kind,
      ownerId: r.owner_id,
      parent: r.parent,
      parentId: r.parent_id,
      x: r.x,
      y: r.y,
      angle: r.angle,
      revision: r.revision,
    }));
}
export function bindAtlas(
  db: any,
  cam: string,
  b: AtlasBinding,
  expected: number | null,
) {
  if (
    !b ||
    !["city", "dungeon", "location"].includes(b.kind) ||
    !["world", "building"].includes(b.parent) ||
    !b.id ||
    !b.ownerId ||
    ![b.x, b.y, b.angle].every(Number.isFinite)
  )
    throw new Error("Räumliche Einordnung prüfen.");
  const old = db
    .prepare("SELECT revision,kind,owner_id FROM atlas_binding WHERE campaign_id=? AND id=?")
    .get(cam, b.id);
  if(old&&(old.kind!==b.kind||old.owner_id!==b.ownerId))throw new Error("Räumliche Identität kann nicht ersetzt werden.");
  if ((old?.revision ?? null) !== expected)
    throw new Error("Räumliche Einordnung inzwischen geändert.");
  const owner = db
    .prepare(
      b.kind === "city"
        ? "SELECT id FROM city_document WHERE campaign_id=? AND id=?"
        : b.kind==="location" ? "SELECT id FROM location WHERE campaign_id=? AND id=? AND trashed=0" : "SELECT id FROM scope WHERE campaign_id=? AND id=?",
    )
    .get(cam, b.ownerId);
  if (!owner) throw new Error("Räumliches Objekt fehlt.");
  if (
    b.parent === "building" &&
    (b.kind !== "dungeon" ||
      !db
        .prepare(
          "SELECT id FROM city_unit WHERE campaign_id=? AND id=? AND kind='building'",
        )
        .get(cam, b.parentId))
  )
    throw new Error("Gebäude fehlt.");
  db.prepare(
    "INSERT INTO atlas_binding VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET parent=excluded.parent,parent_id=excluded.parent_id,x=excluded.x,y=excluded.y,angle=excluded.angle,revision=excluded.revision",
  ).run(
    cam,
    b.id,
    b.kind,
    b.ownerId,
    b.parent,
    b.parentId,
    b.x,
    b.y,
    b.angle,
    (expected ?? 0) + 1,
  );
}
// Capture only canonical rows written by the existing domain commands. Their own
// old receipts/histories remain immutable; the Atlas exposes one chronological history.
const tracked = [
  "atlas_import_source",
  "scope",
  "room",
  "drawing_floor",
  "drawing_hidden",
  "drawing_profile",
  "drawing_element",
  "dungeon_volume",
  "dungeon_path",
  "dungeon_passage",
  "dungeon_key_content",
  "dungeon_graph_layout",
  "dungeon_trigger_field",
  "city_document",
  "city_unit",
  "world_record",
  "atlas_place",
  "location",
  "location_map",
  "world_note",
  "atlas_binding",
  "atlas_landscape",
  "atlas_entrance",
  "atlas_local_journey",
  "npc_position",
  "npc_dungeon_position",
  "scene_position",
  "world_journey",
  "dungeon_journey",
];
interface Delta {
  table: string;
  key: Record<string, unknown>;
  before: any;
  after: any;
  guard: string;
}
const initialized = new WeakSet<object>();
function captureSetup(db: any) {
  if (initialized.has(db)) return;
  db.exec(
    "CREATE TEMP TABLE atlas_capture(campaign_id TEXT); CREATE TEMP TABLE atlas_delta(table_name TEXT,key_json TEXT,before_json TEXT,after_json TEXT);",
  );
  for (const table of tracked) {
    const cols = db.prepare("PRAGMA table_info(" + table + ")").all();
    if (!cols.length) continue;
    const pk = cols
      .filter((c: any) => c.pk)
      .sort((a: any, b: any) => a.pk - b.pk);
    const object = (prefix: string, fields: any[]) =>
      "json_object(" +
      fields
        .flatMap((c: any) => ["'" + c.name + "'", prefix + '."' + c.name + '"'])
        .join(",") +
      ")";
    // INSERT OR REPLACE does not emit DELETE triggers with SQLite's default
    // recursive_triggers setting. Capture the existing row before INSERT too.
    // Use the same row on both sides so INSERT OR IGNORE remains a no-op.
    const prior =
        "(SELECT " +
        object("prior", cols) +
        " FROM main." +
        table +
        " AS prior WHERE " +
        pk
          .map((c: any) => 'prior."' + c.name + '"=NEW."' + c.name + '"')
          .join(" AND ") +
        ")",
      insertFilter =
        table === "world_record"
          ? " AND NEW.kind IN ('map','place-presentation')"
          : "";
    db.exec(
      `CREATE TEMP TRIGGER atlas_${table}_prior BEFORE INSERT ON main.${table} WHEN EXISTS(SELECT 1 FROM atlas_capture WHERE campaign_id=NEW.campaign_id)${insertFilter} BEGIN INSERT INTO atlas_delta VALUES('${table}',${object("NEW", pk)},${prior},${prior}); END;`,
    );
    for (const op of ["INSERT", "UPDATE", "DELETE"]) {
      const ref = op === "DELETE" ? "OLD" : "NEW",
        filter =
          table === "world_record"
            ? " AND " + ref + ".kind IN ('map','place-presentation')"
            : "";
      db.exec(
        `CREATE TEMP TRIGGER atlas_${table}_${op} AFTER ${op} ON main.${table} WHEN EXISTS(SELECT 1 FROM atlas_capture WHERE campaign_id=${ref}.campaign_id)${filter} BEGIN INSERT INTO atlas_delta VALUES('${table}',${object(ref, pk)},${op === "INSERT" ? "NULL" : object("OLD", cols)},${op === "DELETE" ? "NULL" : object("NEW", cols)}); END;`,
      );
    }
  }
  initialized.add(db);
}
function currentRow(db: any, d: Pick<Delta, "table" | "key">) {
  return (
    db
      .prepare(
        "SELECT * FROM " +
          d.table +
          " WHERE " +
          Object.keys(d.key)
            .map((k) => k + "=?")
            .join(" AND "),
      )
      .get(...Object.values(d.key)) ?? null
  );
}
function fp(v: any) {
  return hash(json(v));
}
function restore(db: any, d: Delta, row: any) {
  const current = currentRow(db, d);
  if (!row) {
    db.prepare(
      "DELETE FROM " +
        d.table +
        " WHERE " +
        Object.keys(d.key)
          .map((k) => k + "=?")
          .join(" AND "),
    ).run(...Object.values(d.key));
    return;
  }
  const next = { ...row };
  if (d.table.endsWith("_journey") && next.payload) {
    const p = JSON.parse(next.payload);
    if (p.status === "active") {
      p.status = "paused";
      p.reason =
        "Atlasgeometrie rückgenommen. Reise vor Fortsetzung neu prüfen.";
      next.payload = json(p);
      if (next.checksum) next.checksum = hash(next.payload);
      if (next.status) next.status = "paused";
    }
  }
  if (typeof next.revision === "number") {
    next.revision = Math.max(current?.revision ?? 0, row.revision) + 1;
    if (next.payload) {
      const p = JSON.parse(next.payload);
      if (typeof p.revision === "number") {
        p.revision = next.revision;
        next.payload = json(p);
        if (next.checksum) next.checksum = hash(next.payload);
      }
    }
  }
  if (next.payload && typeof next.revision !== "number") {
    const p = JSON.parse(next.payload);
    if (typeof p.revision === "number") {
      const old = current?.payload ? JSON.parse(current.payload) : null;
      p.revision = Math.max(p.revision, old?.revision ?? 0) + 1;
      next.payload = json(p);
      if (next.checksum) next.checksum = hash(next.payload);
    }
  }
  const cols = Object.keys(next),
    nonKeys = cols.filter((k) => !Object.hasOwn(d.key, k));
  db.prepare(
    "INSERT INTO " +
      d.table +
      "(" +
      cols.join(",") +
      ") VALUES(" +
      cols.map(() => "?").join(",") +
      ") ON CONFLICT(" +
      Object.keys(d.key).join(",") +
      ") DO UPDATE SET " +
      nonKeys.map((k) => k + "=excluded." + k).join(","),
  ).run(...cols.map((k) => next[k]));
}
export function atlasHistoryState(db: any, cam: string) {
  const root = atlasRoot(db, cam),
    max =
      db
        .prepare("SELECT max(ordinal) n FROM atlas_command WHERE campaign_id=?")
        .get(cam).n ?? 0;
  return { canUndo: root.cursor > 0, canRedo: root.cursor < max };
}
function history(db: any, cam: string, direction: "undo" | "redo") {
  const root = atlasRoot(db, cam),
    ordinal = direction === "undo" ? root.cursor : root.cursor + 1,
    row = db
      .prepare("SELECT * FROM atlas_command WHERE campaign_id=? AND ordinal=?")
      .get(cam, ordinal);
  if (!row) throw new Error("Keine weitere Atlasänderung.");
  const changes: Delta[] = JSON.parse(row.payload);
  for (const d of changes)
    if (fp(currentRow(db, d)) !== d.guard)
      throw new Error(
        "Spätere Änderung an " +
          d.table +
          " verhindert die gemeinsame Rücknahme.",
      );
  db.pragma("defer_foreign_keys=ON");
  for (const d of direction === "undo" ? [...changes].reverse() : changes)
    restore(db, d, direction === "undo" ? d.before : d.after);
  const cursor = direction === "undo" ? ordinal - 1 : ordinal;
  db.prepare("UPDATE campaign_atlas SET cursor=? WHERE campaign_id=?").run(
    cursor,
    cam,
  );
  // Rebase only the next touching command in either direction after revision increments.
  for (const d of changes) {
    const guard = fp(currentRow(db, d));
    for (const [sign, order] of [
      ["<=", "DESC"],
      [">", "ASC"],
    ]) {
      for (const candidate of db
        .prepare(
          "SELECT ordinal,payload FROM atlas_command WHERE campaign_id=? AND ordinal " +
            sign +
            "? ORDER BY ordinal " +
            order,
        )
        .all(cam, cursor)) {
        const items: Delta[] = JSON.parse(candidate.payload),
          target = items.find(
            (x) => x.table === d.table && json(x.key) === json(d.key),
          );
        if (!target) continue;
        target.guard = guard;
        db.prepare(
          "UPDATE atlas_command SET payload=? WHERE campaign_id=? AND ordinal=?",
        ).run(json(items), cam, candidate.ordinal);
        break;
      }
    }
  }
}
function checkPositions(db: any, cam: string) {
  const geometry = dungeonGeometry(db, cam);
  const rooms = new Map<string, any>(
    db
      .prepare("SELECT * FROM room WHERE campaign_id=?")
      .all(cam)
      .map((r: any) => [r.id, r]),
  );
  const check = (p: any) => {
    if (!p) return;
    const r = rooms.get(p.roomId);
    if (
      !r ||
      r.scope_id !== p.scopeId ||
      r.floor_id !== p.floorId ||
      !inside(p, JSON.parse(r.payload).polygons) ||
      !poseSpace(
        geometry,
        {
          ...p,
          z:
            p.z ??
            geometry.floors.find(
              (f) => f.scopeId === p.scopeId && f.id === p.floorId,
            )?.elevation ??
            0,
        },
        p.movement ?? "walk",
      )
    )
      throw new Error(
        "Änderung würde eine Gruppe oder einen NPC außerhalb ihres Raums zurücklassen. Position zuerst klären.",
      );
  };
  for (const r of db
    .prepare("SELECT payload FROM scene_position WHERE campaign_id=?")
    .all(cam))
    check(JSON.parse(r.payload).dungeon);
  for (const r of db
    .prepare("SELECT payload FROM npc_dungeon_position WHERE campaign_id=?")
    .all(cam))
    check(JSON.parse(r.payload));
  for (const r of db
    .prepare("SELECT payload FROM atlas_entrance WHERE campaign_id=?")
    .all(cam)) {
    const e = JSON.parse(r.payload);
    check({
      ...e.inside,
      scopeId: e.scopeId,
      floorId: e.floorId,
      roomId: e.roomId,
    });
  }
}
export function executeAtlasWrite(
  db: any,
  c: AtlasCommand,
  apply: () => unknown,
  after?: () => void,
): unknown {
  captureSetup(db);
  return db
    .transaction(() => {
      const fingerprint = fp(c.action),
        old = db
          .prepare("SELECT * FROM atlas_receipt WHERE command_id=?")
          .get(c.commandId);
      if (old) {
        if (old.campaign_id !== c.campaignId || old.fingerprint !== fingerprint)
          throw new Error("Atlasbefehlskennung anders verwendet.");
        return null;
      }
      atlasRoot(db, c.campaignId);
      let result: unknown;
      if (c.action.kind === "undo" || c.action.kind === "redo") {
        history(db, c.campaignId, c.action.kind);
        checkPositions(db, c.campaignId);
      } else {
        db.prepare("DELETE FROM atlas_delta").run();
        db.prepare("INSERT INTO atlas_capture VALUES(?)").run(c.campaignId);
        try {
          result = apply();
          after?.();
          checkPositions(db, c.campaignId);
        } finally {
          db.prepare("DELETE FROM atlas_capture").run();
        }
        const changes = new Map<string, Delta>();
        for (const row of db
          .prepare("SELECT * FROM atlas_delta ORDER BY rowid")
          .all()) {
          const key = row.table_name + ":" + row.key_json,
            old = changes.get(key),
            after = row.after_json ? JSON.parse(row.after_json) : null;
          changes.set(key, {
            table: row.table_name,
            key: JSON.parse(row.key_json),
            before: old
              ? old.before
              : row.before_json
                ? JSON.parse(row.before_json)
                : null,
            after,
            guard: fp(after),
          });
        }
        const meaningful = [...changes.values()].filter(
          (d) => fp(d.before) !== fp(d.after),
        );
        if (meaningful.length) {
          const root = atlasRoot(db, c.campaignId);
          db.prepare(
            "DELETE FROM atlas_command WHERE campaign_id=? AND ordinal>?",
          ).run(c.campaignId, root.cursor);
          db.prepare("INSERT INTO atlas_command VALUES(?,?,?,?,?)").run(
            c.campaignId,
            root.cursor + 1,
            c.commandId,
            c.action.kind,
            json(meaningful),
          );
          db.prepare(
            "UPDATE campaign_atlas SET cursor=cursor+1 WHERE campaign_id=?",
          ).run(c.campaignId);
        }
        db.prepare("DELETE FROM atlas_delta").run();
      }
      db.prepare(
        "UPDATE campaign_atlas SET revision=revision+1 WHERE campaign_id=?",
      ).run(c.campaignId);
      db.prepare("INSERT INTO atlas_receipt VALUES(?,?,?)").run(
        c.commandId,
        c.campaignId,
        fingerprint,
      );
      return result;
    })
    .immediate();
}

/** Atlas invariants also apply to snapshots before they are published. */
export function validateCampaignAtlases(db: any) {
  const schema = db.pragma("user_version", { simple: true });
  if (schema < 45) return;
  for (const table of [
    "campaign_atlas",
    "atlas_binding",
    ...(schema>=46?["atlas_landscape","atlas_reference_asset","atlas_landscape_migration"]:[]),
    "atlas_command",
    "atlas_receipt",
    "atlas_import_source",
    "atlas_entrance",
    "atlas_local_journey",
    "atlas_travel_receipt",
  ])
    if (
      !db
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
        .get(table)
    )
      throw new Error("Atlasstore unvollständig: " + table);
  for (const root of db.prepare("SELECT * FROM campaign_atlas").iterate()) {
    const maps = db
      .prepare("SELECT id FROM world_record WHERE campaign_id=? AND kind='map'")
      .all(root.campaign_id);
    if (maps.length !== 1 || maps[0].id !== root.map_id)
      throw new Error("Kampagne besitzt nicht genau eine Atlaswurzel.");
    const count = db
      .prepare("SELECT count(*) n FROM atlas_command WHERE campaign_id=?")
      .get(root.campaign_id).n;
    if (root.cursor < 0 || root.cursor > count)
      throw new Error("Atlashistorie widersprüchlich.");
    for (const b of atlasBindings(db, root.campaign_id)) {
      if (
        ![b.x, b.y, b.angle].every(Number.isFinite) ||
        !["world", "building"].includes(b.parent) || !["city","dungeon","location"].includes(b.kind) || (b.kind!=="dungeon"&&b.parent!=="world")
      )
        throw new Error("Atlasposition ungültig.");
      if (
        !db
          .prepare(
            b.kind === "city"
              ? "SELECT 1 FROM city_document WHERE campaign_id=? AND id=?"
              : b.kind==="location" ? "SELECT 1 FROM location WHERE campaign_id=? AND id=?" : "SELECT 1 FROM scope WHERE campaign_id=? AND id=?",
          )
          .get(root.campaign_id, b.ownerId)
      )
        throw new Error("Räumlicher Eigentümer fehlt.");
      if (
        b.parent === "building" &&
        !db
          .prepare(
            "SELECT 1 FROM city_unit WHERE campaign_id=? AND id=? AND kind='building'",
          )
          .get(root.campaign_id, b.parentId)
      )
        throw new Error("Gebäudeanker fehlt.");
    }
  }
  for (const r of db
    .prepare("SELECT source,checksum FROM atlas_import_source")
    .iterate())
    if (hash(r.source) !== r.checksum)
      throw new Error("Dungeonimport-Original beschädigt.");
}
