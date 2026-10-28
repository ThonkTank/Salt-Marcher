import { createHash } from 'node:crypto';
import type { ContentContext, ContentState } from '../runtime/content-runtime-contracts';
import type { DungeonGeometry, DungeonPose } from '../atlas/dungeon-contracts';
import type { DrawingElement } from '../atlas/drawing-contracts';
import { dungeonContentAnchor } from '../atlas/dungeon-content-model';
import { seen3D } from '../atlas/spatial-3d';
import { readLiveScene } from './live-read';
import { position } from './scene-position';
import { createDungeonGroup } from './session';
import { readPreparedGroup } from './session-read';
import { readEncounterPlan } from './encounters';
import { readTreasure } from './progression-records';
import { npcDungeonPose, placeNpcDungeon } from './npc-dungeon';
import { npcPosition } from './npc-world';
const hash = (s: string) => createHash('sha256').update(s).digest('hex'),
  parsed = (r: any) => {
    if (!r || hash(r.payload) !== r.checksum) throw new Error('Dungeon-Inhaltszustand beschädigt.');
    return JSON.parse(r.payload);
  };
export function installContentRuntime(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS dungeon_content_state(campaign_id TEXT NOT NULL,feature_id TEXT NOT NULL,group_id TEXT,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,feature_id),UNIQUE(campaign_id,group_id),FOREIGN KEY(campaign_id,feature_id) REFERENCES drawing_element(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_feature_knowledge(campaign_id TEXT NOT NULL,character_id TEXT NOT NULL,feature_id TEXT NOT NULL,known INTEGER NOT NULL,override TEXT,PRIMARY KEY(campaign_id,character_id,feature_id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_content_signal(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,feature_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,scene_id,feature_id)) STRICT;`);
}
export function contentState(db: any, cam: string, id: string): ContentState {
  const r = db
    .prepare('SELECT * FROM dungeon_content_state WHERE campaign_id=? AND feature_id=?')
    .get(cam, id);
  return r ? parsed(r) : { featureId: id, revision: 0, groupId: null, combatId: null };
}
export function saveContentState(db: any, cam: string, value: ContentState) {
  const payload = JSON.stringify(value);
  db.prepare(
    'INSERT INTO dungeon_content_state VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,feature_id) DO UPDATE SET group_id=excluded.group_id,revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, value.featureId, value.groupId, value.revision, payload, hash(payload));
}
export function featureKnown(db: any, cam: string, ids: string[], id: string) {
  return ids.some(
    (cid) =>
      db
        .prepare(
          'SELECT known FROM dungeon_feature_knowledge WHERE campaign_id=? AND character_id=? AND feature_id=?',
        )
        .get(cam, cid, id)?.known === 1,
  );
}
function knownBy(db: any, cam: string, cid: string, id: string) {
  return (
    db
      .prepare(
        'SELECT known,override FROM dungeon_feature_knowledge WHERE campaign_id=? AND character_id=? AND feature_id=?',
      )
      .get(cam, cid, id) ?? { known: 0, override: null }
  );
}
export function confirmFeatureDiscovery(
  db: any,
  cam: string,
  ids: string[],
  id: string,
  known: boolean,
) {
  for (const cid of ids)
    db.prepare(
      'INSERT INTO dungeon_feature_knowledge VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,character_id,feature_id) DO UPDATE SET known=excluded.known,override=excluded.override',
    ).run(cam, cid, id, Number(known), known ? 'known' : 'unknown');
}
function contentPose(
  db: any,
  cam: string,
  g: DungeonGeometry,
  e: DrawingElement,
): DungeonPose | null {
  const state = contentState(db, cam, e.id),
    groupId = state.groupId;
  if (groupId) {
    const group = readPreparedGroup(db, cam, groupId),
      positions = group.actors
        .filter((a) => !a.unavailable && a.hp > 0)
        .map((a) => npcDungeonPose(db, cam, a.id))
        .filter((p): p is DungeonPose => !!p);
    return positions[0] ?? null;
  }
  return authoredContentPose(g, e);
}
function authoredContentPose(g: DungeonGeometry, e: DrawingElement): DungeonPose | null {
  const a = dungeonContentAnchor(g, e),
    v = g.drawing.volumes?.find((v) => v.id === e.content?.anchor.volumeId);
  if (a && v)
    return {
      scopeId: v.scopeId,
      floorId: v.floorId,
      roomId: v.roomId,
      ...a.point,
      z:
        (g.floors.find((f) => f.id === v.floorId && f.scopeId === v.scopeId)?.elevation ?? 0) +
        a.zOffsetMeters,
    };
  if (!e.roomId || !g.rooms.some((r) => r.id === e.roomId)) return null;
  return {
    scopeId: e.scopeId,
    floorId: e.floorId,
    roomId: e.roomId,
    ...e.points[0]!,
    z:
      (g.floors.find((f) => f.id === e.floorId && f.scopeId === e.scopeId)?.elevation ?? 0) +
      (e.zOffsetMeters ?? 0),
  };
}
function seenBy(
  db: any,
  cam: string,
  g: DungeonGeometry,
  from: DungeonPose,
  to: DungeonPose,
  cid: string,
) {
  const r = db
      .prepare("SELECT payload FROM player_record WHERE campaign_id=? AND kind='observer' AND id=?")
      .get(cam, cid),
    o = r
      ? JSON.parse(r.payload)
      : { enabled: true, rangeMeters: 10000, darkvisionMeters: 0, eyeHeightMeters: 1.7 },
    settings = db
      .prepare("SELECT payload FROM player_record WHERE campaign_id=? AND kind='settings'")
      .get(cam),
    light = settings ? JSON.parse(settings.payload).light : 'auto';
  return (
    o.enabled &&
    seen3D(g, from, to, Math.min(o.rangeMeters, 18), o.darkvisionMeters, light, o.eyeHeightMeters)
  );
}
function signal(db: any, cam: string, sceneId: string, id: string) {
  const r = db
    .prepare(
      'SELECT * FROM dungeon_content_signal WHERE campaign_id=? AND scene_id=? AND feature_id=?',
    )
    .get(cam, sceneId, id);
  return r ? parsed(r) : { revision: 0, lastVisible: false, pending: false, reason: '' };
}
function saveSignal(db: any, cam: string, sceneId: string, id: string, value: any) {
  const payload = JSON.stringify(value);
  db.prepare(
    'INSERT INTO dungeon_content_signal VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,scene_id,feature_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, sceneId, id, value.revision, payload, hash(payload));
}
export function dismissContentSignal(db: any, cam: string, sceneId: string, id: string) {
  const s = signal(db, cam, sceneId, id);
  saveSignal(db, cam, sceneId, id, { ...s, revision: s.revision + 1, pending: false, reason: '' });
}
export function evaluateContents(
  db: any,
  cam: string,
  sceneId: string,
  g: DungeonGeometry,
  activeScore: number | null = null,
  options: { activateEvents?: boolean } = {},
) {
  const scene = readLiveScene(db, cam, sceneId),
    from = position(db, cam, sceneId).dungeon;
  if (!from) return [];
  const opened: string[] = [];
  for (const e of g.drawing.elements.filter((e) => !e.archived && e.kind === 'feature')) {
    let to: DungeonPose | null;
    try {
      to = contentPose(db, cam, g, e);
    } catch {
      continue;
    }
    if (!to || to.scopeId !== from.scopeId) continue;
    let visible = false,
      detected = false;
    for (const cid of scene.members) {
      const physical = seenBy(db, cam, g, from, to, cid),
        old = knownBy(db, cam, cid, e.id);
      visible ||= physical;
      if (physical && !e.secret && old.override !== 'unknown')
        db.prepare(
          "INSERT INTO dungeon_feature_knowledge VALUES(?,?,?,1,NULL) ON CONFLICT(campaign_id,character_id,feature_id) DO UPDATE SET known=CASE WHEN override='unknown' THEN 0 ELSE 1 END",
        ).run(cam, cid, e.id);
      if (
        physical &&
        e.secret &&
        !old.known &&
        e.content?.search?.dc !== null &&
        e.content?.search?.dc !== undefined
      ) {
        const p = db
            .prepare('SELECT payload FROM character_profile WHERE campaign_id=? AND id=?')
            .get(cam, cid),
          passive = p ? (JSON.parse(p.payload).passivePerception ?? 10) : 10;
        if ((activeScore ?? passive) >= e.content.search.dc) detected = true;
      }
    }
    if (options.activateEvents === false) continue;
    const s = signal(db, cam, sceneId, e.id),
      encounter =
        e.feature === 'encounter' &&
        visible &&
        (!e.secret || featureKnown(db, cam, scene.members, e.id));
    if ((encounter && !s.lastVisible) || (detected && !s.lastDetected)) {
      s.pending = true;
      s.reason = encounter
        ? 'Encounter ist räumlich wahrnehmbar. Als GM klären oder mit vorhandener Gruppe beginnen.'
        : 'Suchwert erreicht den privaten DC. Entdeckung erst nach ausdrücklicher GM-Freigabe.';
      opened.push(e.id);
    }
    s.lastVisible = visible;
    s.lastDetected = detected;
    s.revision++;
    saveSignal(db, cam, sceneId, e.id, s);
  }
  return opened;
}
export function dungeonContentContexts(
  db: any,
  cam: string,
  sceneId: string | null,
  g: DungeonGeometry,
  observerIds?: string[],
): ContentContext[] {
  if (!sceneId) return [];
  const scene = readLiveScene(db, cam, sceneId),
    from = position(db, cam, sceneId).dungeon;
  if (!from) return [];
  const result: ContentContext[] = [];
  for (const e of g.drawing.elements.filter((e) => !e.archived && e.kind === 'feature')) {
    const state = contentState(db, cam, e.id);
    let pose: DungeonPose | null = null,
      problem: string | null = null,
      title = '',
      items: ContentContext['items'] = [],
      treasureRevision: number | null = null,
      groupRevision: number | null = null,
      aliveActors = 0;
    try {
      pose = contentPose(db, cam, g, e);
      const ref = e.content?.reference,
        groupId = ref?.kind === 'group' ? ref.id : state.groupId;
      if (groupId) {
        const group = readPreparedGroup(db, cam, groupId);
        title = group.title;
        groupRevision = group.revision;
        aliveActors = group.actors.filter((a) => !a.unavailable && a.hp > 0).length;
      } else if (ref?.kind === 'encounter') title = readEncounterPlan(db, cam, ref.id).name;
      else if (ref?.kind === 'treasure') {
        const t = readTreasure(db, cam, ref.id);
        title = t.title;
        items = t.items;
        treasureRevision = t.revision;
      }
    } catch (error) {
      problem = (error as Error).message;
    }
    if ((pose?.scopeId ?? e.scopeId) !== from.scopeId) continue;
    if (
      pose &&
      pose.roomId !== from.roomId &&
      Math.hypot(pose.x - from.x, pose.y - from.y, pose.z - from.z) > 18
    )
      continue;
    const known = featureKnown(db, cam, observerIds ?? scene.members, e.id),
      visible =
        !!pose &&
        (observerIds ?? scene.members).some((cid) => seenBy(db, cam, g, from, pose!, cid)),
      s = signal(db, cam, sceneId, e.id);
    result.push({
      id: e.id,
      revision: e.revision,
      name: e.name,
      kind: e.feature,
      publicText:
        known && e.content?.search?.revealedText
          ? e.content.search.revealedText
          : (e.content?.publicText ?? ''),
      gmNotes: e.notes,
      secret: e.secret,
      known,
      visible,
      pose,
      groupId: e.content?.reference?.kind === 'group' ? e.content.reference.id : state.groupId,
      groupRevision,
      combatId: state.combatId,
      referenceTitle: title,
      problem,
      items,
      treasureRevision,
      aliveActors,
      search: e.content?.search ?? { method: '', dc: null, notes: '', revealedText: '' },
      pending: !!s.pending,
      reason: s.reason,
    });
    if (result.length >= 200) break;
  }
  return result;
}
export function bindDungeonGroup(db: any, cam: string, e: DrawingElement, g: DungeonGeometry) {
  let state = contentState(db, cam, e.id);
  if (state.groupId) return readPreparedGroup(db, cam, state.groupId);
  const reference = e.content?.reference;
  if (!reference || !['encounter', 'group'].includes(reference.kind))
    throw new Error(
      'Encounter-Inhalt zuerst mit einer Vorlage oder bestehenden NPC-Gruppe verbinden.',
    );
  const pose = authoredContentPose(g, e),
    location = pose
      ? db
          .prepare('SELECT location_id FROM location_map WHERE campaign_id=? AND scope_id=?')
          .get(cam, pose.scopeId)
      : null;
  if (!pose || !location)
    throw new Error(
      'Encounteranker benötigt ein gültiges Volumen und einen verbundenen Kampagnenort.',
    );
  const group =
    reference.kind === 'group'
      ? readPreparedGroup(db, cam, reference.id)
      : createDungeonGroup(db, cam, reference.id, location.location_id);
  if (
    db
      .prepare(
        'SELECT feature_id FROM dungeon_content_state WHERE campaign_id=? AND group_id=? AND feature_id<>?',
      )
      .get(cam, group.id, e.id)
  )
    throw new Error('Diese NPC-Gruppe gehört bereits zu einer anderen Dungeonplatzierung.');
  for (const actor of group.actors.filter((a) => !a.unavailable && a.hp > 0))
    placeNpcDungeon(db, cam, actor.id, pose, npcPosition(db, cam, actor.id).revision, g);
  state = { ...state, revision: state.revision + 1, groupId: group.id };
  saveContentState(db, cam, state);
  return readPreparedGroup(db, cam, group.id);
}
