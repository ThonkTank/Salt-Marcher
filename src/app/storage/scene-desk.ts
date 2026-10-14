import { createHash } from "node:crypto";
import type {
  DeskRef,
  DeskEntry,
  DeskContent,
  SceneDesk,
} from "../scene-desk-contracts";
import { readLiveScene } from "./live";
import { worldNoteDocument } from "../../features/world/world-notes";
import { checkedLocationDocument } from "../../features/location/location-schema";
import { readCreature, searchCreatures, readEncounterPlan } from "./encounters";
import { readItemDefinition, readItemDefinitions } from "./item-definitions";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function installSceneDesk(db: any) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS scene_desk(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,scene_id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;`,
  );
}
function decoded(r: any) {
  if (!r || hash(r.payload) !== r.checksum)
    throw new Error("Inhalt fehlt oder ist beschädigt.");
  return JSON.parse(r.payload);
}
function checkedRef(ref: DeskRef) {
  if (
    !ref ||
    !["note", "location", "creature", "item", "encounter"].includes(ref.kind) ||
    typeof ref.id !== "string" ||
    !ref.id ||
    ref.id.length > 1000
  )
    throw new Error("Inhaltsverweis ungültig.");
  return ref;
}
export function deskContent(db: any, cam: string, ref: DeskRef): DeskContent {
  checkedRef(ref);
  if (ref.kind === "note") {
    const row = db
        .prepare("SELECT * FROM world_note WHERE campaign_id=? AND id=?")
        .get(cam, ref.id),
      note = worldNoteDocument(decoded(row));
    if (note.id !== row.id || note.revision !== row.revision)
      throw new Error("Notizzuordnung widersprüchlich.");
    return {
      ref,
      title: note.title,
      label: {
        npc: "NPC",
        faction: "Fraktion",
        quest: "Quest",
        rumor: "Gerücht",
        rule: "Regel",
      }[note.kind],
      revision: note.revision,
      note,
      unavailable: !!row.trashed,
    };
  }
  if (ref.kind === "location") {
    const row = db
        .prepare("SELECT * FROM location WHERE campaign_id=? AND id=?")
        .get(cam, ref.id),
      location = checkedLocationDocument(decoded(row));
    if(location.id!==row.id||!Number.isSafeInteger(row.revision)||row.revision<1)
      throw new Error("Ortszuordnung widersprüchlich.");
    return {
      ref,
      title: location.name,
      label: "Ort",
      revision: row.revision,
      location,
      unavailable: !!row.trashed,
    };
  }
  if (ref.kind === "item") {
    const item = readItemDefinition(db, ref.id);
    return {
      ref,
      title: item.name,
      label: "Gegenstand",
      revision: item.revision,
      item,
      unavailable: item.trashed,
    };
  }
  if (ref.kind === "creature") {
    const creature = readCreature(ref.id);
    return {
      ref,
      title: creature.name,
      label: "Kreatur",
      revision: 1,
      creature,
    };
  }
  const encounter = readEncounterPlan(db, cam, ref.id);
  return {
    ref,
    title: encounter.name,
    label: "Encounter",
    revision: encounter.revision,
    encounter,
  };
}
function state(db: any, cam: string, sceneId: string) {
  const row = db
    .prepare("SELECT * FROM scene_desk WHERE campaign_id=? AND scene_id=?")
    .get(cam, sceneId);
  return checkedState(row);
}
function checkedState(row: any) {
  if(row&&(!Number.isSafeInteger(row.revision)||row.revision<1))
    throw new Error("Szenentischrevision beschädigt.");
  const refs: DeskRef[] = row ? decoded(row) : [];
  if (
    !Array.isArray(refs) ||
    refs.length > 100 ||
    new Set(refs.map((r) => r?.kind + ":" + r?.id)).size !== refs.length
  )
    throw new Error("Szenentisch beschädigt.");
  refs.forEach(checkedRef);
  return { revision: row?.revision ?? 0, refs };
}
export function validateSceneDesk(db: any) {
  if(!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='scene_desk'").get()) {
    if(db.pragma('user_version',{simple:true})<38)return;
    throw new Error("Szenentischspeicher fehlt.");
  }
  for(const row of db.prepare('SELECT * FROM scene_desk').iterate())checkedState(row);
}
export function readSceneDesk(
  db: any,
  cam: string,
  sceneId: string,
): SceneDesk {
  const scene = readLiveScene(db, cam, sceneId),
    s = state(db, cam, sceneId);
  const entry = (ref: DeskRef): DeskEntry => {
    try {
      const c = deskContent(db, cam, ref);
      return {
        ref,
        title: c.title,
        label: c.label,
        unavailable: c.unavailable,
      };
    } catch {
      return {
        ref,
        title: "Inhalt nicht verfügbar",
        label: ref.kind,
        unavailable: true,
      };
    }
  };
  return {
    sceneId,
    revision: s.revision,
    pins: s.refs.map(entry),
    place: scene.locationId
      ? entry({ kind: "location", id: scene.locationId })
      : null,
  };
}
export function pinSceneDesk(
  db: any,
  cam: string,
  sceneId: string,
  revision: number,
  ref: DeskRef,
  pin: boolean,
) {
  return db
    .transaction(() => {
      checkedRef(ref);
      const scene = readLiveScene(db, cam, sceneId),
        s = state(db, cam, sceneId);
      if (scene.retired || s.revision !== revision || typeof pin !== "boolean")
        throw new Error(
          "Szenentisch inzwischen geändert. Bitte aktualisieren.",
        );
      const found = s.refs.some((r) => r.kind === ref.kind && r.id === ref.id);
      if (found === pin) return readSceneDesk(db, cam, sceneId);
      if (pin) {
        const c = deskContent(db, cam, ref);
        if (c.unavailable || s.refs.length >= 100)
          throw new Error("Inhalt nicht verfügbar oder Szenentisch voll.");
        s.refs.push(ref);
      } else
        s.refs = s.refs.filter((r) => r.kind !== ref.kind || r.id !== ref.id);
      const payload = JSON.stringify(s.refs);
      db.prepare(
        "INSERT INTO scene_desk VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,scene_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum",
      ).run(cam, sceneId, s.revision + 1, payload, hash(payload));
      return readSceneDesk(db, cam, sceneId);
    })
    .immediate();
}
export function searchDesk(
  db: any,
  cam: string,
  kind: string,
  search: string,
  offset: number,
) {
  if (
    typeof search !== "string" ||
    search.length > 1000 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 1000000
  )
    throw new Error("Suchanfrage ungültig.");
  if (kind === "creature") {
    const p = searchCreatures({ text: search, offset, limit: 40 });
    return {
      entries: p.rows.map((c) => ({
        ref: { kind: "creature", id: c.id },
        title: c.name,
        label: "Kreatur · HG " + c.challengeRating,
      })),
      next: offset + p.rows.length < p.total ? offset + p.rows.length : null,
    };
  }
  if (kind === "item") {
    const p = readItemDefinitions(db, {
      search,
      category: "",
      magic: "",
      rarity: "",
      attunement: "",
      sort: "name",
      direction: "asc",
      after: offset,
      includeTrashed: false,
    });
    return {
      entries: p.items.map((i) => ({
        ref: { kind: "item", id: i.id },
        title: i.name,
        label: "Gegenstand",
      })),
      next: p.next,
      notice:p.sourceStatus.message,
    };
  }
  if (!["world", "encounter"].includes(kind))
    throw new Error("Suchbereich ungültig.");
  const sql =
    kind === "encounter"
      ? `SELECT 'encounter' kind,id,name title,'Encounter' label FROM encounter_plan WHERE campaign_id=@cam AND instr(lower(name||' '||payload),lower(@search))>0 ORDER BY title,id LIMIT 41 OFFSET @offset`
      : `SELECT 'note' kind,id,json_extract(payload,'$.title') title,json_extract(payload,'$.kind') label FROM world_note WHERE campaign_id=@cam AND trashed=0 AND json_valid(payload) AND instr(lower(json_extract(payload,'$.title')||' '||json_extract(payload,'$.readAloud')||' '||json_extract(payload,'$.gmNotes')),lower(@search))>0 UNION ALL SELECT 'location' kind,id,json_extract(payload,'$.name') title,'Ort' label FROM location WHERE campaign_id=@cam AND trashed=0 AND json_valid(payload) AND instr(lower(payload),lower(@search))>0 ORDER BY title,id LIMIT 41 OFFSET @offset`;
  const rows = db.prepare(sql).all({ cam, search, offset });
  return {
    entries: rows
      .slice(0, 40)
      .map((r: any) => ({
        ref: { kind: r.kind, id: r.id },
        title: r.title,
        label:
          (
            {
              npc: "NPC",
              faction: "Fraktion",
              quest: "Quest",
              rumor: "Gerücht",
        rule: "Regel",
            } as Record<string, string>
          )[r.label] ?? r.label,
      })),
    next: rows.length > 40 ? offset + 40 : null,
  };
}
