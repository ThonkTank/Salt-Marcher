import { readLiveMomentDraft } from './live-moment-drafts';
import { readVisitOutcome } from './visit-outcome-read';
import { createHash } from 'node:crypto';
import {
  checkedCharacterProfile,
  type Character,
  type LiveScene,
  type LiveView,
} from '../runtime/live-contracts';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { sceneReadAloud } from './scene-read-aloud';
export const hash = (text: string) => createHash('sha256').update(text).digest('hex');

export const profileQuery =
  'SELECT m.*,p.revision AS profile_revision,p.payload,p.checksum FROM roster_member m LEFT JOIN character_profile p ON p.campaign_id=m.campaign_id AND p.id=m.id';

function checkedCharacterRow(row: any): Character {
  if (!row || typeof row.payload !== 'string' || hash(row.payload) !== row.checksum)
    throw new Error('Charakterprofil nicht verfügbar oder beschädigt.');
  if (
    ![row.ordinal, row.membership_revision].every((v) => Number.isSafeInteger(v) && v >= 0) ||
    !Number.isSafeInteger(row.profile_revision) ||
    row.profile_revision < 1
  )
    throw new Error('Charakterrevision oder Partyreihenfolge beschädigt.');
  const value = checkedCharacterProfile(JSON.parse(row.payload));
  if (value.archive && (row.active || row.scene_id !== null))
    throw new Error('Archivierte Figur ist noch einer Party oder Scene zugeordnet.');
  return {
    id: row.id,
    ordinal: row.ordinal,
    profile: value,
    profileRevision: row.profile_revision,
    archived: !!value.archive,
    active: !!row.active,
    membershipRevision: row.membership_revision,
    sceneId: row.scene_id,
  };
}

export function profile(db: any, campaignId: string, id: string): Character {
  return checkedCharacterRow(
    db.prepare(profileQuery + ' WHERE m.campaign_id=? AND m.id=?').get(campaignId, id),
  );
}

export function readRoster(db: any, campaignId: string): Character[] {
  return db
    .prepare(profileQuery + ' WHERE m.campaign_id=? ORDER BY m.ordinal,m.id')
    .all(campaignId)
    .map(checkedCharacterRow);
}

export function readCampaignTime(db: any, campaignId: string) {
  const anchor = db
    .prepare('SELECT epoch_id,instant_ms FROM campaign_time WHERE campaign_id=?')
    .get(campaignId);
  if (!anchor || !anchor.epoch_id || !/^(0|[1-9][0-9]{0,29})$/.test(anchor.instant_ms))
    throw new Error('Kampagnenzeit fehlt oder ist beschädigt. Kein Ersatzstand erzeugt.');
  return { epochId: anchor.epoch_id as string, instantMs: anchor.instant_ms as string };
}

export function clock(db: any, campaignId: string, sceneId: string) {
  const row = db
    .prepare('SELECT * FROM scene_clock WHERE campaign_id=? AND scene_id=?')
    .get(campaignId, sceneId);
  if (
    !row ||
    !row.epoch_id ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 0 ||
    !/^(0|[1-9][0-9]{0,29})$/.test(row.instant_ms)
  )
    throw new Error('Scene-Uhr fehlt oder ist beschädigt. Kein Ersatzstand erzeugt.');
  const anchor = readCampaignTime(db, campaignId);
  if (row.epoch_id !== anchor.epochId)
    throw new Error(
      'Scene-Uhr gehört nicht zur bestätigten Kampagnenepoche. Kein Ersatzstand erzeugt.',
    );
  return { epochId: row.epoch_id, instantMs: row.instant_ms, revision: row.revision };
}

export function readLiveScene(db: any, campaignId: string, id: string): LiveScene {
  const row = db
    .prepare('SELECT * FROM live_scene WHERE campaign_id=? AND id=?')
    .get(campaignId, id);
  if (!row) throw new Error('Laufende Scene nicht verfügbar.');
  if (
    !Number.isSafeInteger(row.revision) ||
    row.revision < 0 ||
    row.title.length > 1000 ||
    row.notes.length > 2_000_000
  )
    throw new Error('Sceneinhalt oder Revision beschädigt.');
  const life = db
    .prepare('SELECT * FROM scene_lifecycle WHERE campaign_id=? AND id=?')
    .get(campaignId, id);
  if (!life || !Number.isSafeInteger(life.membership_revision) || life.membership_revision < 0)
    throw new Error('Scenestatus fehlt oder ist beschädigt.');
  const source = db
    .prepare(
      'SELECT id,plan_id AS planId,plan_revision AS planRevision,visit_id AS visitId,title,notes,location_id AS locationId FROM scene_adoption WHERE campaign_id=? AND scene_id=? ORDER BY ordinal DESC LIMIT 1',
    )
    .get(campaignId, id);
  let moment: {} = {};
  try {
    const draft = readLiveMomentDraft(db, campaignId, id);
    if (draft) moment = { momentDraft: draft };
  } catch (error) {
    moment = { momentDraftError: (error as Error).message };
  }
  return {
    ...moment,
    id: row.id,
    revision: row.revision,
    title: row.title,
    notes: row.notes,
    readAloud: sceneReadAloud(db, campaignId, id),
    locationId: row.location_id,
    membershipRevision: life.membership_revision,
    retired: !!life.retired,
    clock: clock(db, campaignId, id),
    members: db
      .prepare(
        'SELECT id FROM roster_member WHERE campaign_id=? AND scene_id=? AND active=1 ORDER BY ordinal,id',
      )
      .all(campaignId, id)
      .map((r: any) => r.id),
    adoption: source ? { ...source, outcome: readVisitOutcome(db, campaignId, source.id) } : null,
  };
}

export function readLive(db: any, campaignId: string): LiveView {
  return db.transaction(() => {
    const party = db
      .prepare('SELECT revision FROM roster_state WHERE campaign_id=?')
      .get(campaignId);
    if (!party || !Number.isSafeInteger(party.revision) || party.revision < 0)
      throw new Error('Partyquelle ist nicht verfügbar.');
    const time = db.prepare('SELECT * FROM campaign_time WHERE campaign_id=?').get(campaignId);
    if (!time || !time.epoch_id || !/^(0|[1-9][0-9]*)$/.test(time.instant_ms))
      throw new Error('Bestätigter Kampagnenzeitanker nicht verfügbar.');
    const allRoster = readRoster(db, campaignId);
    const roster = allRoster.filter((c: Character) => !c.archived),
      archivedRosterCount = allRoster.length - roster.length;
    const state = db.prepare('SELECT * FROM live_state WHERE campaign_id=?').get(campaignId);
    if (!state) {
      if (
        db.prepare('SELECT 1 FROM live_scene WHERE campaign_id=?').get(campaignId) ||
        roster.some((c: Character) => c.sceneId !== null)
      )
        throw new Error('Runtime ohne bestätigte Primary/Focus-Zuordnung. Recovery erforderlich.');
      return {
        rosterRevision: party.revision,
        roster,
        archivedRosterCount,
        primaryId: null,
        focusId: null,
        focusRevision: null,
        scenes: [],
        scene: null,
        archiveCount: 0,
      };
    }
    if (!Number.isSafeInteger(state.focus_revision) || state.focus_revision < 0)
      throw new Error('Focusrevision ist beschädigt.');
    const scene = readLiveScene(db, campaignId, state.focus_id);
    if (
      scene.retired ||
      (state.primary_id !== scene.id && readLiveScene(db, campaignId, state.primary_id).retired)
    )
      throw new Error('Focus oder Primary verweist auf eine frühere Scene.');
    const sceneIds = new Set<string>();
    for (const row of db.prepare('SELECT id FROM live_scene WHERE campaign_id=?').all(campaignId)) {
      clock(db, campaignId, row.id);
      const life = db
        .prepare(
          'SELECT membership_revision,retired FROM scene_lifecycle WHERE campaign_id=? AND id=?',
        )
        .get(campaignId, row.id);
      if (!life || !Number.isSafeInteger(life.membership_revision) || life.membership_revision < 0)
        throw new Error('Scenestatus fehlt oder ist beschädigt.');
      const members = db
        .prepare(
          'SELECT count(*) n FROM roster_member WHERE campaign_id=? AND scene_id=? AND active=1',
        )
        .get(campaignId, row.id).n;
      if ((life.retired && members) || (!life.retired && !members && row.id !== state.primary_id))
        throw new Error('Leere oder frühere Gruppe hat eine ungültige Zuordnung.');
      if (!life.retired) sceneIds.add(row.id);
    }
    for (const character of roster)
      if (
        (character.active && (!character.sceneId || !sceneIds.has(character.sceneId))) ||
        (!character.active && character.sceneId)
      )
        throw new Error('Party und Scenezuordnung widersprechen sich.');
    if (
      roster.some((c: Character) => c.active) &&
      !roster.some((c: Character) => c.active && c.sceneId === state.primary_id)
    )
      throw new Error('Primary ist leer, obwohl eine andere Gruppe aktiv ist.');
    return {
      rosterRevision: party.revision,
      roster,
      archivedRosterCount,
      primaryId: state.primary_id,
      focusId: state.focus_id,
      focusRevision: state.focus_revision,
      scenes: activeSummaries(db, campaignId, state.primary_id),
      archiveCount: archiveCount(db, campaignId),
      scene,
    };
  })();
}

export const archiveCount = (db: any, campaignId: string): number =>
  db
    .prepare('SELECT count(*) n FROM scene_lifecycle WHERE campaign_id=? AND retired=1')
    .get(campaignId).n;

export function scenePlace(db: any, campaignId: string, sceneId: string) {
  const scene = db
      .prepare('SELECT location_id FROM live_scene WHERE campaign_id=? AND id=?')
      .get(campaignId, sceneId),
    locationId = scene?.location_id ?? null;
  if (!locationId) return { locationId: null, locationTitle: null };
  const row = db
    .prepare('SELECT payload,checksum FROM location WHERE campaign_id=? AND id=?')
    .get(campaignId, locationId);
  let locationTitle = 'Ort nicht lesbar';
  if (row && hash(row.payload) === row.checksum) {
    try {
      locationTitle = checkedLocationDocument(JSON.parse(row.payload)).name;
    } catch {}
  }
  return { locationId, locationTitle };
}

export function activeSummaries(
  db: any,
  campaignId: string,
  primaryId: string,
): LiveView['scenes'] {
  return db
    .prepare(
      'SELECT s.id,s.title,l.membership_revision FROM live_scene s JOIN scene_lifecycle l ON l.campaign_id=s.campaign_id AND l.id=s.id WHERE s.campaign_id=? AND l.retired=0 ORDER BY s.id',
    )
    .all(campaignId)
    .map((row: any) => {
      const members = db
        .prepare(
          'SELECT count(*) n FROM roster_member WHERE campaign_id=? AND scene_id=? AND active=1',
        )
        .get(campaignId, row.id).n;
      return {
        ...scenePlace(db, campaignId, row.id),
        id: row.id,
        title: row.title,
        primary: row.id === primaryId,
        members,
        membershipRevision: row.membership_revision,
        clock: clock(db, campaignId, row.id),
      };
    });
}

export function readArchives(db: any, campaignId: string, after: string | null) {
  if (after !== null && (typeof after !== 'string' || after.length > 1000))
    throw new Error('Ungültige Archivseite.');
  const rows = db
    .prepare(
      'SELECT s.id,s.title FROM live_scene s JOIN scene_lifecycle l ON l.campaign_id=s.campaign_id AND l.id=s.id WHERE s.campaign_id=? AND l.retired=1 AND s.id>? ORDER BY s.id LIMIT 21',
    )
    .all(campaignId, after ?? '');
  return { items: rows.slice(0, 20), next: rows.length > 20 ? rows[19].id : null };
}

export function readArchivedRoster(
  db: any,
  campaignId: string,
  after: string | null,
  search: string,
) {
  if (
    typeof search !== 'string' ||
    search.length > 1000 ||
    (after !== null && (typeof after !== 'string' || !/^\d+:[^:]+$/.test(after)))
  )
    throw new Error('Ungültige Archivsuche.');
  const ordinal = after === null ? -1 : Number(after.slice(0, after.indexOf(':'))),
    id = after === null ? '' : after.slice(after.indexOf(':') + 1);
  if (!Number.isSafeInteger(ordinal)) throw new Error('Ungültiger Archivcursor.');
  return db.transaction(() => {
    const pattern = '%' + search.replace(/[\\%_]/g, '\\$&') + '%',
      rows = db
        .prepare(
          "SELECT m.id,m.ordinal FROM roster_member m JOIN character_profile p USING(campaign_id,id) WHERE m.campaign_id=? AND json_type(p.payload,'$.archive')='object' AND (p.payload LIKE ? ESCAPE '\\' OR m.id LIKE ? ESCAPE '\\') AND (m.ordinal>? OR m.ordinal=? AND m.id>?) ORDER BY m.ordinal,m.id LIMIT 41",
        )
        .all(campaignId, pattern, pattern, ordinal, ordinal, id),
      items = rows.slice(0, 40).map((r: any) => profile(db, campaignId, r.id)),
      last = rows[39];
    return {
      items,
      next: rows.length > 40 ? last.ordinal + ':' + last.id : null,
      total: db
        .prepare(
          "SELECT count(*) n FROM character_profile WHERE campaign_id=? AND json_type(payload,'$.archive')='object'",
        )
        .get(campaignId).n,
    };
  })();
}

export { profile as readCharacter };
