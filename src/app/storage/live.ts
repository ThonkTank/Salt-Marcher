import { consumeSessionRecapDraft } from './session-recap';
import { prepareTravelHistoryValidation, validTravelHistoryTimeStep } from './travel-history';
import { readLiveMomentDraft, clearSubmittedMomentDraft } from './live-moment-drafts';
import { readSessionBoundary } from './chronicle';
import { readWorldCalendar } from './world';
import { readClockEvent } from './calendar-events';
import { agendaOccurrence } from '../agenda-model';
import { validInstant, validClockCalendar } from '../time-plan-model';
import { readVisitOutcome } from './visit-outcomes';
import { visitOutcomeLabel } from '../visit-outcome-contracts';
import { randomUUID, createHash } from 'node:crypto';
import {
  checkedCharacterProfile,
  validateLiveCommand,
  advanceInstant,
  type Character,
  type LiveScene,
  type LiveView,
  type LiveCommand,
  type LiveAck,
  type LiveStatus,
} from '../live-contracts';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { manualPlan } from '../../features/planner/manual-planner';
import { captureVisitDetails, sceneReadAloud, writeSceneReadAloud } from './session';
const json = (value: unknown) => JSON.stringify(value);
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const fingerprint = (command: LiveCommand) => hash(json({ ...command, token: undefined }));

export function installLiveSchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS roster_state(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id), revision INTEGER NOT NULL DEFAULT 0) STRICT;
    CREATE TABLE IF NOT EXISTS campaign_time(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id), epoch_id TEXT NOT NULL, instant_ms TEXT NOT NULL) STRICT;
    CREATE UNIQUE INDEX IF NOT EXISTS campaign_time_epoch ON campaign_time(campaign_id,epoch_id);
    CREATE TABLE IF NOT EXISTS live_scene(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, revision INTEGER NOT NULL, title TEXT NOT NULL, notes TEXT NOT NULL, location_id TEXT, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,location_id) REFERENCES location(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS live_moment_draft(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,scene_id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS scene_clock(campaign_id TEXT NOT NULL, scene_id TEXT NOT NULL, revision INTEGER NOT NULL, epoch_id TEXT NOT NULL, instant_ms TEXT NOT NULL, PRIMARY KEY(campaign_id,scene_id), FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id), FOREIGN KEY(campaign_id,epoch_id) REFERENCES campaign_time(campaign_id,epoch_id)) STRICT;
    CREATE TABLE IF NOT EXISTS live_state(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id), primary_id TEXT NOT NULL, focus_id TEXT NOT NULL, focus_revision INTEGER NOT NULL, FOREIGN KEY(campaign_id,primary_id) REFERENCES live_scene(campaign_id,id), FOREIGN KEY(campaign_id,focus_id) REFERENCES live_scene(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS roster_member(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, ordinal INTEGER NOT NULL, active INTEGER NOT NULL CHECK(active IN(0,1)), membership_revision INTEGER NOT NULL, scene_id TEXT, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS character_profile(campaign_id TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,id) REFERENCES roster_member(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS scene_adoption(campaign_id TEXT NOT NULL, id TEXT NOT NULL, scene_id TEXT NOT NULL, ordinal INTEGER NOT NULL, plan_id TEXT NOT NULL, plan_revision INTEGER NOT NULL, visit_id TEXT NOT NULL, title TEXT NOT NULL, notes TEXT NOT NULL, location_id TEXT, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS live_receipt(command_id TEXT PRIMARY KEY REFERENCES receipt(command_id), payload TEXT NOT NULL, checksum TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS scene_lifecycle(campaign_id TEXT NOT NULL, id TEXT NOT NULL, membership_revision INTEGER NOT NULL, retired INTEGER NOT NULL CHECK(retired IN(0,1)), PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,id) REFERENCES live_scene(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS scene_time_step(campaign_id TEXT NOT NULL, id TEXT NOT NULL, scene_id TEXT NOT NULL, command_id TEXT NOT NULL REFERENCES receipt(command_id) DEFERRABLE INITIALLY DEFERRED, ordinal INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id), UNIQUE(campaign_id,scene_id,ordinal)) STRICT;`);
}
export function ensureLiveOwners(db: any, campaignId: string) {
  db.prepare('INSERT OR IGNORE INTO roster_state VALUES(?,0)').run(campaignId);
  db.prepare("INSERT OR IGNORE INTO campaign_time VALUES(?,?,'0')").run(campaignId, campaignId);
}
const profileQuery =
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
function profile(db: any, campaignId: string, id: string): Character {
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
export { profile as readCharacter };
export function readCampaignTime(db: any, campaignId: string) {
  const anchor = db
    .prepare('SELECT epoch_id,instant_ms FROM campaign_time WHERE campaign_id=?')
    .get(campaignId);
  if (!anchor || !anchor.epoch_id || !/^(0|[1-9][0-9]{0,29})$/.test(anchor.instant_ms))
    throw new Error('Kampagnenzeit fehlt oder ist beschädigt. Kein Ersatzstand erzeugt.');
  return { epochId: anchor.epoch_id as string, instantMs: anchor.instant_ms as string };
}
function clock(db: any, campaignId: string, sceneId: string) {
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
const archiveCount = (db: any, campaignId: string): number =>
  db
    .prepare('SELECT count(*) n FROM scene_lifecycle WHERE campaign_id=? AND retired=1')
    .get(campaignId).n;
function scenePlace(db: any, campaignId: string, sceneId: string) {
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
function activeSummaries(db: any, campaignId: string, primaryId: string): LiveView['scenes'] {
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
function currentScene(db: any, campaignId: string, id: string) {
  const scene = readLiveScene(db, campaignId, id);
  if (scene.retired) throw new Error('Diese Scene gehört bereits zum Archiv.');
  return scene;
}
function cleanupScenes(
  db: any,
  campaignId: string,
  preferred: string | null,
): NonNullable<LiveAck['session']>['retired'] {
  const state = db.prepare('SELECT * FROM live_state WHERE campaign_id=?').get(campaignId);
  const groups = activeSummaries(db, campaignId, state.primary_id),
    populated = groups.filter((g) => g.members > 0),
    retired: NonNullable<LiveAck['session']>['retired'] = [];
  let primaryId = state.primary_id;
  if (populated.length && !populated.some((g) => g.id === primaryId)) {
    primaryId =
      populated.find((g) => g.id === preferred)?.id ??
      populated.find((g) => g.id === state.focus_id)?.id ??
      db
        .prepare(
          'SELECT scene_id FROM roster_member WHERE campaign_id=? AND active=1 ORDER BY ordinal,id LIMIT 1',
        )
        .get(campaignId).scene_id;
  }
  for (const group of groups)
    if (!group.members && group.id !== primaryId) {
      db.prepare('UPDATE scene_lifecycle SET retired=1 WHERE campaign_id=? AND id=?').run(
        campaignId,
        group.id,
      );
      retired.push({ id: group.id, clock: group.clock });
    }
  const focusId = retired.some((g) => g.id === state.focus_id)
    ? (populated.find((g) => g.id === preferred)?.id ?? primaryId)
    : state.focus_id;
  db.prepare(
    'UPDATE live_state SET primary_id=?,focus_id=?,focus_revision=focus_revision+? WHERE campaign_id=?',
  ).run(primaryId, focusId, Number(focusId !== state.focus_id), campaignId);
  return retired;
}
function sessionDelta(
  db: any,
  campaignId: string,
  ids: string[],
  retired: NonNullable<LiveAck['session']>['retired'],
  groupIds: string[] = [],
): NonNullable<LiveAck['session']> {
  const state = db.prepare('SELECT * FROM live_state WHERE campaign_id=?').get(campaignId);
  return {
    primaryId: state.primary_id,
    focusId: state.focus_id,
    focusRevision: state.focus_revision,
    retired,
    archiveCount: archiveCount(db, campaignId),
    groups: [...new Set([...groupIds, ...retired.map((g) => g.id)])].map((id) => {
      const s = readLiveScene(db, campaignId, id);
      return { id, membershipRevision: s.membershipRevision, members: s.members.length };
    }),
    members: ids.map((id) => {
      const c = profile(db, campaignId, id);
      return {
        id: c.id,
        active: c.active,
        membershipRevision: c.membershipRevision,
        sceneId: c.sceneId,
      };
    }),
  };
}
function availableLocation(
  db: any,
  campaignId: string,
  id: string | null,
  retained?: string | null,
) {
  if (id === null) return;
  const row = db
    .prepare('SELECT trashed,payload,checksum FROM location WHERE campaign_id=? AND id=?')
    .get(campaignId, id);
  if (!row || hash(row.payload) !== row.checksum || (row.trashed && retained !== id))
    throw new Error('Gewählter Szenenort ist nicht verfügbar.');
  checkedLocationDocument(JSON.parse(row.payload));
}
function recordLocationVisit(
  db: any,
  campaignId: string,
  sceneId: string,
  beforeLocationId: string | null,
  locationId: string | null,
  source: 'visit' | 'manual',
  visitId?: string,
) {
  if (locationId === beforeLocationId) return;
  const row = locationId
      ? db
          .prepare('SELECT payload,checksum FROM location WHERE campaign_id=? AND id=?')
          .get(campaignId, locationId)
      : null,
    name =
      row && hash(row.payload) === row.checksum
        ? checkedLocationDocument(JSON.parse(row.payload)).name
        : 'Kein Ort';
  const value = json({
    text: locationId ? 'Ort besucht: ' + name : 'Ort verlassen',
    recordedAt: new Date().toISOString(),
    facts: { locationId, beforeLocationId, source, visitId: visitId ?? null },
  });
  db.prepare('INSERT INTO world_history VALUES(?,?,?,?,?)').run(
    campaignId,
    randomUUID(),
    sceneId,
    value,
    hash(value),
  );
}
function recordPartyHistory(
  db: any,
  campaignId: string,
  sceneId: string | null,
  text: string,
  facts: Record<string, unknown>,
) {
  const value = json({ text, recordedAt: new Date().toISOString(), facts });
  db.prepare('INSERT INTO world_history VALUES(?,?,?,?,?)').run(
    campaignId,
    randomUUID(),
    sceneId,
    value,
    hash(value),
  );
}
function targetRevision(
  db: any,
  campaignId: string,
  action: LiveCommand['action'],
  targetId: string,
): number | null {
  const table =
    action.kind === 'membership'
      ? 'roster_member'
      : action.kind === 'profile' ||
          action.kind === 'archive-character' ||
          action.kind === 'create-character'
        ? 'character_profile'
        : 'live_scene';
  if (
    !db
      .prepare('SELECT 1 FROM ' + table + ' WHERE campaign_id=? AND id=?')
      .get(campaignId, targetId)
  )
    return null;
  if (action.kind === 'move' || action.kind === 'scene-roster')
    return (
      db.prepare('SELECT revision FROM roster_state WHERE campaign_id=?').get(campaignId)
        ?.revision ?? null
    );
  if (table === 'live_scene') {
    const current = readLiveScene(db, campaignId, targetId);
    if (current.retired) return null;
    if (action.kind === 'advance-clock') return current.clock.revision;
    if (action.kind === 'focus') {
      const state = db
        .prepare('SELECT focus_id,focus_revision FROM live_state WHERE campaign_id=?')
        .get(campaignId);
      return state?.focus_id === targetId ? state.focus_revision : null;
    }
    return current.revision;
  }
  const current = profile(db, campaignId, targetId);
  return action.kind === 'membership' ? current.membershipRevision : current.profileRevision;
}
export function liveStatus(db: any, command: LiveCommand): LiveStatus {
  validateLiveCommand(command);
  return db.transaction(() => {
    const row = db
      .prepare(
        'SELECT r.campaign_id,r.fingerprint,l.payload,l.checksum FROM receipt r LEFT JOIN live_receipt l ON l.command_id=r.command_id WHERE r.command_id=?',
      )
      .get(command.commandId);
    if (!row) {
      const action = command.action;
      const targetId =
        'sceneId' in action ? action.sceneId : 'characterId' in action ? action.characterId : null;
      let changed =
        targetId !== null &&
        'expectedRevision' in action &&
        targetRevision(db, command.campaignId, action, targetId) !== action.expectedRevision;
      if (action.kind === 'advance-clock' && action.calendarVersion === 'campaign-calendar-v1') {
        const calendar = readWorldCalendar(db, command.campaignId),
          state = db
            .prepare('SELECT focus_id,focus_revision FROM live_state WHERE campaign_id=?')
            .get(command.campaignId);
        changed ||=
          calendar.revision !== action.calendar.revision ||
          calendar.daySeconds !== action.calendar.daySeconds ||
          state?.focus_id !== action.sceneId ||
          state?.focus_revision !== action.expectedFocusRevision;
        if (action.eventTarget) {
          try {
            const event = readClockEvent(db, command.campaignId, action.eventTarget.eventId);
            changed ||= event.revision !== action.eventTarget.expectedRevision;
          } catch {
            changed = true;
          }
        }
      }
      if (action.kind === 'focus')
        changed =
          db
            .prepare('SELECT focus_revision FROM live_state WHERE campaign_id=?')
            .get(command.campaignId)?.focus_revision !== action.expectedRevision;
      if (action.kind === 'move' || action.kind === 'scene-roster') {
        const source = currentScene(db, command.campaignId, action.sceneId);
        const state = db
          .prepare('SELECT focus_revision FROM live_state WHERE campaign_id=?')
          .get(command.campaignId);
        changed =
          db
            .prepare('SELECT revision FROM roster_state WHERE campaign_id=?')
            .get(command.campaignId)?.revision !== action.expectedRosterRevision ||
          state?.focus_revision !== action.expectedFocusRevision ||
          (action.kind === 'move' && source.clock.revision !== action.expectedClockRevision) ||
          source.membershipRevision !== action.expectedSceneMembershipRevision;
      }
      return {
        outcome: changed ? 'conflict' : 'not-applied',
        receipt: null,
        targetChanged: changed,
      };
    }
    if (row.campaign_id !== command.campaignId || row.fingerprint !== fingerprint(command))
      throw new Error('Änderungskennung gehört zu einem anderen Auftrag.');
    if (!row.payload || hash(row.payload) !== row.checksum)
      throw new Error('Commitreceipt nicht verlässlich lesbar. Status bleibt ungeklärt.');
    const receipt: LiveAck = JSON.parse(row.payload);
    let targetChanged =
      targetRevision(db, command.campaignId, command.action, receipt.targetId) !== receipt.revision;
    if (receipt.session) {
      const state = db
        .prepare('SELECT * FROM live_state WHERE campaign_id=?')
        .get(command.campaignId);
      targetChanged ||=
        state?.primary_id !== receipt.session.primaryId ||
        state?.focus_revision !== receipt.session.focusRevision ||
        state?.focus_id !== receipt.session.focusId ||
        receipt.session.groups.some(
          (g) =>
            readLiveScene(db, command.campaignId, g.id).membershipRevision !== g.membershipRevision,
        );
    }
    return {
      outcome: 'applied',
      receipt,
      targetChanged,
      ...(receipt.scene && !targetChanged
        ? { currentScene: readLiveScene(db, command.campaignId, receipt.scene.id) }
        : {}),
      ...(receipt.character && !targetChanged
        ? { currentCharacter: profile(db, command.campaignId, receipt.character.id) }
        : {}),
    };
  })();
}
export function validateLiveBackup(db: any, campaignId: string) {
  prepareTravelHistoryValidation(db);
  readLive(db, campaignId);
  for (const row of db.prepare('SELECT id FROM live_scene WHERE campaign_id=?').all(campaignId))
    readLiveScene(db, campaignId, row.id);
  const last = new Map<string, { ordinal: number; to: string; revision: number }>();
  for (const row of db
    .prepare('SELECT * FROM scene_time_step WHERE campaign_id=? ORDER BY scene_id,ordinal')
    .iterate(campaignId)) {
    if (hash(row.payload) !== row.checksum) throw new Error('Zeitverlauf beschädigt.');
    const step = JSON.parse(row.payload),
      current = clock(db, campaignId, row.scene_id);
    if (
      !(
        validTravelHistoryTimeStep(db, campaignId, row.scene_id, step) ||
        (step.calendarVersion === 'relative-v1' &&
          advanceInstant(step.from, step.amount, step.unit) === step.to) ||
        (step.calendarVersion === 'campaign-calendar-v1' &&
          validClockCalendar(step.calendar) &&
          validInstant(step.from) &&
          validInstant(step.to) &&
          BigInt(step.to) > BigInt(step.from))
      ) ||
      step.epochId !== current.epochId ||
      !Number.isSafeInteger(step.beforeRevision) ||
      step.beforeRevision < 0 ||
      step.afterRevision !== step.beforeRevision + 1 ||
      step.afterRevision > current.revision ||
      (step.recordedAt !== undefined &&
        (typeof step.recordedAt !== 'string' ||
          !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(step.recordedAt) ||
          !Number.isFinite(Date.parse(step.recordedAt))))
    )
      throw new Error('Zeitverlauf ist nicht konsistent.');
    const previous = last.get(row.scene_id);
    if (
      previous
        ? row.ordinal !== previous.ordinal + 1 ||
          step.from !== previous.to ||
          step.beforeRevision !== previous.revision
        : row.ordinal !== 0
    )
      throw new Error('Zeitverlauf hat eine Lücke.');
    const receipt = db
      .prepare('SELECT room_id,revision FROM receipt WHERE command_id=?')
      .get(row.command_id);
    if (!receipt || receipt.room_id !== row.scene_id || receipt.revision !== step.afterRevision)
      throw new Error('Zeitverlauf hat kein passendes Commitreceipt.');
    last.set(row.scene_id, { ordinal: row.ordinal, to: step.to, revision: step.afterRevision });
  }
  for (const [id, step] of last) {
    const current = clock(db, campaignId, id);
    if (current.instantMs !== step.to || current.revision !== step.revision)
      throw new Error('Sceneuhr entspricht nicht dem bestätigten Zeitverlauf.');
  }
}
export function executeLive(db: any, command: LiveCommand, guard: () => void): LiveAck {
  validateLiveCommand(command);
  return db
    .transaction(() => {
      guard();
      const prior = liveStatus(db, command);
      if (prior.receipt) return prior.receipt;
      const campaignId = command.campaignId,
        action = command.action;
      let targetId: string,
        revision: number,
        scene: LiveScene | undefined,
        character: Character | undefined,
        session: LiveAck['session'],
        recapDraft: LiveAck['recapDraft'];
      if (action.kind === 'initialize') {
        const party = db
          .prepare('SELECT revision FROM roster_state WHERE campaign_id=?')
          .get(campaignId);
        if (!party || party.revision !== action.expectedRosterRevision)
          throw new Error('Partyquelle wurde verändert oder ist nicht verfügbar.');
        const current = db.prepare('SELECT * FROM live_state WHERE campaign_id=?').get(campaignId);
        if (current) {
          scene = readLive(db, campaignId).scene!;
          targetId = scene.id;
          revision = scene.revision;
        } else {
          if (db.prepare('SELECT 1 FROM live_scene WHERE campaign_id=?').get(campaignId))
            throw new Error('Unvollständige Runtime. Kein neuer Ersatzstand angelegt.');
          const roster = readLive(db, campaignId).roster;
          const time = db
            .prepare('SELECT * FROM campaign_time WHERE campaign_id=?')
            .get(campaignId);
          if (!time || !/^(0|[1-9][0-9]*)$/.test(time.instant_ms))
            throw new Error('Bestätigter Kampagnenzeitanker nicht verfügbar.');
          targetId = randomUUID();
          revision = 0;
          db.prepare("INSERT INTO live_scene VALUES(?,?,0,'','',NULL)").run(campaignId, targetId);
          db.prepare('INSERT INTO scene_lifecycle VALUES(?,?,0,0)').run(campaignId, targetId);
          db.prepare('INSERT INTO scene_clock VALUES(?,?,0,?,?)').run(
            campaignId,
            targetId,
            time.epoch_id,
            time.instant_ms,
          );
          db.prepare(
            'UPDATE roster_member SET scene_id=?,membership_revision=membership_revision+1 WHERE campaign_id=? AND active=1',
          ).run(targetId, campaignId);
          if (roster.some((c: Character) => c.active))
            db.prepare('UPDATE roster_state SET revision=revision+1 WHERE campaign_id=?').run(
              campaignId,
            );
          db.prepare('INSERT INTO live_state VALUES(?,?,?,0)').run(campaignId, targetId, targetId);
          scene = readLiveScene(db, campaignId, targetId);
        }
      } else if (action.kind === 'create-character') {
        const checked = checkedCharacterProfile(action.profile);
        if (checked.archive) throw new Error('Neue Figuren beginnen im Roster.');
        const payload = json(checked);
        targetId = randomUUID();
        revision = 1;
        const ordinal = db
          .prepare('SELECT coalesce(max(ordinal),-1)+1 n FROM roster_member WHERE campaign_id=?')
          .get(campaignId).n;
        db.prepare('INSERT INTO roster_member VALUES(?,?,?,0,0,NULL)').run(
          campaignId,
          targetId,
          ordinal,
        );
        db.prepare('INSERT INTO character_profile VALUES(?,?,?,?,?)').run(
          campaignId,
          targetId,
          1,
          payload,
          hash(payload),
        );
        db.prepare('UPDATE roster_state SET revision=revision+1 WHERE campaign_id=?').run(
          campaignId,
        );
        character = profile(db, campaignId, targetId);
      } else if (action.kind === 'profile') {
        const before = profile(db, campaignId, action.characterId);
        if (before.profileRevision !== action.expectedRevision)
          throw new Error('Charakterprofil wurde inzwischen geändert.');
        if (before.archived || action.profile.archive)
          throw new Error(
            'Archivierte Figuren zuerst wiederherstellen. Archivstatus nur über Archivieren ändern.',
          );
        const payload = json(checkedCharacterProfile(action.profile));
        targetId = before.id;
        revision = before.profileRevision + 1;
        db.prepare(
          'UPDATE character_profile SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
        ).run(revision, payload, hash(payload), campaignId, targetId);
        character = profile(db, campaignId, targetId);
      } else if (action.kind === 'archive-character') {
        const before = profile(db, campaignId, action.characterId),
          state = db.prepare('SELECT * FROM live_state WHERE campaign_id=?').get(campaignId);
        if (
          before.profileRevision !== action.expectedRevision ||
          before.membershipRevision !== action.expectedMembershipRevision ||
          db.prepare('SELECT revision FROM roster_state WHERE campaign_id=?').get(campaignId)
            ?.revision !== action.expectedRosterRevision ||
          (state?.focus_revision ?? null) !== action.expectedFocusRevision
        )
          throw new Error(
            'Figur oder Fokus wurde inzwischen geändert. Archivansicht aktualisieren.',
          );
        if (
          typeof action.archived !== 'boolean' ||
          action.confirmName !== before.profile.name ||
          typeof action.reason !== 'string' ||
          action.reason.length > 4000
        )
          throw new Error(
            'Archivieren benötigt den genauen Figurennamen und einen gültigen Grund.',
          );
        if (!!before.archived === action.archived)
          throw new Error(
            action.archived ? 'Figur ist bereits archiviert.' : 'Figur ist bereits im Roster.',
          );
        const next = { ...before.profile };
        if (action.archived)
          next.archive = { recordedAt: new Date().toISOString(), reason: action.reason };
        else delete next.archive;
        const payload = json(checkedCharacterProfile(next));
        targetId = before.id;
        revision = before.profileRevision + 1;
        db.prepare(
          'UPDATE character_profile SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
        ).run(revision, payload, hash(payload), campaignId, targetId);
        db.prepare(
          'UPDATE roster_member SET active=0,scene_id=NULL,membership_revision=membership_revision+1 WHERE campaign_id=? AND id=?',
        ).run(campaignId, targetId);
        db.prepare('UPDATE roster_state SET revision=revision+1 WHERE campaign_id=?').run(
          campaignId,
        );
        if (before.sceneId)
          db.prepare(
            'UPDATE scene_lifecycle SET membership_revision=membership_revision+1 WHERE campaign_id=? AND id=?',
          ).run(campaignId, before.sceneId);
        character = profile(db, campaignId, targetId);
        if (state) {
          const retired = cleanupScenes(db, campaignId, null);
          session = sessionDelta(
            db,
            campaignId,
            [before.id],
            retired,
            before.sceneId ? [before.sceneId] : [],
          );
          scene = currentScene(db, campaignId, session.focusId);
        }
        recordPartyHistory(
          db,
          campaignId,
          before.sceneId,
          'Figur ' +
            (action.archived ? 'archiviert: ' : 'wiederhergestellt: ') +
            before.profile.name,
          {
            kind: 'party-archive',
            characterIds: [before.id],
            archived: action.archived,
            reason: action.reason,
          },
        );
      } else if (action.kind === 'membership') {
        const before = profile(db, campaignId, action.characterId);
        if (before.archived) throw new Error('Archivierte Figur zuerst wiederherstellen.');
        if (
          before.membershipRevision !== action.expectedRevision ||
          typeof action.active !== 'boolean'
        )
          throw new Error('Partymitgliedschaft wurde inzwischen geändert.');
        if (
          db.prepare('SELECT revision FROM roster_state WHERE campaign_id=?').get(campaignId)
            ?.revision !== action.expectedRosterRevision
        )
          throw new Error('Partyquelle wurde verändert oder ist nicht verfügbar.');
        const state = db.prepare('SELECT * FROM live_state WHERE campaign_id=?').get(campaignId);
        if (
          (state?.focus_revision ?? null) !== action.expectedFocusRevision ||
          (action.active && (state?.focus_id ?? null) !== action.targetSceneId) ||
          (!action.active && action.targetSceneId !== null)
        )
          throw new Error('Sceneauswahl ist inzwischen veraltet.');
        if (state) readLive(db, campaignId);
        targetId = before.id;
        revision = before.membershipRevision + (before.active === action.active ? 0 : 1);
        if (before.active !== action.active) {
          db.prepare(
            'UPDATE roster_member SET active=?,membership_revision=?,scene_id=? WHERE campaign_id=? AND id=?',
          ).run(
            Number(action.active),
            revision,
            action.active ? action.targetSceneId : null,
            campaignId,
            targetId,
          );
          db.prepare('UPDATE roster_state SET revision=revision+1 WHERE campaign_id=?').run(
            campaignId,
          );
          const affected = action.active ? action.targetSceneId : before.sceneId;
          if (affected)
            db.prepare(
              'UPDATE scene_lifecycle SET membership_revision=membership_revision+1 WHERE campaign_id=? AND id=?',
            ).run(campaignId, affected);
        }
        character = profile(db, campaignId, targetId);
        if (state) {
          const retired = cleanupScenes(db, campaignId, null);
          session = sessionDelta(
            db,
            campaignId,
            [before.id],
            retired,
            [before.sceneId, action.targetSceneId].filter((id): id is string => id !== null),
          );
          scene = currentScene(db, campaignId, session.focusId);
        }
        if (before.active !== action.active)
          recordPartyHistory(
            db,
            campaignId,
            action.active ? action.targetSceneId : before.sceneId,
            'Figur ' + (action.active ? 'aktiviert: ' : 'deaktiviert: ') + before.profile.name,
            {
              kind: 'party-membership',
              characterIds: [before.id],
              active: action.active,
              fromSceneId: before.sceneId,
              toSceneId: action.active ? action.targetSceneId : null,
            },
          );
      } else if (action.kind === 'scene-roster') {
        const current = readLive(db, campaignId),
          source = currentScene(db, campaignId, action.sceneId);
        if (
          current.focusId !== source.id ||
          current.focusRevision !== action.expectedFocusRevision ||
          current.rosterRevision !== action.expectedRosterRevision ||
          source.membershipRevision !== action.expectedSceneMembershipRevision
        )
          throw new Error('Party oder Szenenfokus inzwischen geändert. Auswahl neu lesen.');
        if (
          !Array.isArray(action.memberIds) ||
          action.memberIds.length > 10000 ||
          new Set(action.memberIds).size !== action.memberIds.length
        )
          throw new Error('Eindeutige Figurenauswahl erforderlich.');
        const selected = new Set(action.memberIds),
          eligible = current.roster.filter(
            (c) => !c.archived && (!c.active || c.sceneId === null || c.sceneId === source.id),
          );
        for (const id of selected)
          if (typeof id !== 'string' || !eligible.some((c) => c.id === id))
            throw new Error(
              'Figur nicht verfügbar oder in einer anderen Szene. Gemeinsames Verschieben verwenden.',
            );
        const changed = eligible.filter((c) =>
          selected.has(c.id)
            ? !c.active || c.sceneId !== source.id
            : c.active && c.sceneId === source.id,
        );
        for (const c of changed)
          db.prepare(
            'UPDATE roster_member SET active=?,scene_id=?,membership_revision=membership_revision+1 WHERE campaign_id=? AND id=?',
          ).run(
            Number(selected.has(c.id)),
            selected.has(c.id) ? source.id : null,
            campaignId,
            c.id,
          );
        if (changed.length) {
          db.prepare('UPDATE roster_state SET revision=revision+1 WHERE campaign_id=?').run(
            campaignId,
          );
          db.prepare(
            'UPDATE scene_lifecycle SET membership_revision=membership_revision+1 WHERE campaign_id=? AND id=?',
          ).run(campaignId, source.id);
        }
        targetId = source.id;
        revision = current.rosterRevision + Number(changed.length > 0);
        session = sessionDelta(
          db,
          campaignId,
          changed.map((c) => c.id),
          cleanupScenes(db, campaignId, null),
          [source.id],
        );
        scene = currentScene(db, campaignId, session.focusId);
        if (changed.length)
          recordPartyHistory(
            db,
            campaignId,
            source.id,
            'Szenenroster übernommen: ' + action.memberIds.length + ' Figuren',
            {
              kind: 'party-roster',
              characterIds: changed.map((c) => c.id),
              memberIds: action.memberIds,
              sceneId: source.id,
            },
          );
      } else if (action.kind === 'focus') {
        const current = readLive(db, campaignId);
        if (current.focusRevision !== action.expectedRevision)
          throw new Error('Gruppenfokus wurde inzwischen geändert.');
        scene = currentScene(db, campaignId, action.sceneId);
        targetId = scene.id;
        revision = action.expectedRevision + (current.focusId === targetId ? 0 : 1);
        db.prepare('UPDATE live_state SET focus_id=?,focus_revision=? WHERE campaign_id=?').run(
          targetId,
          revision,
          campaignId,
        );
        session = sessionDelta(db, campaignId, [], []);
      } else if (action.kind === 'move') {
        const current = readLive(db, campaignId),
          source = currentScene(db, campaignId, action.sceneId);
        if (
          current.rosterRevision !== action.expectedRosterRevision ||
          current.focusRevision !== action.expectedFocusRevision ||
          source.membershipRevision !== action.expectedSceneMembershipRevision ||
          source.clock.revision !== action.expectedClockRevision
        )
          throw new Error('Gruppenzuordnung oder Ausgangszeit wurde inzwischen geändert.');
        if (
          !Array.isArray(action.memberIds) ||
          !action.memberIds.length ||
          action.memberIds.length > 10000 ||
          new Set(action.memberIds).size !== action.memberIds.length
        )
          throw new Error('Wähle eine eindeutige Gruppe von Figuren.');
        for (const id of action.memberIds) {
          if (typeof id !== 'string' || !id || id.length > 1000)
            throw new Error('Ungültige Figurenauswahl.');
          const c = profile(db, campaignId, id);
          if (!c.active || c.sceneId !== source.id)
            throw new Error('Auswahl gehört nicht vollständig zur Ausgangsgruppe.');
        }
        let destination: LiveScene,
          created = false;
        if (action.target?.kind === 'new') {
          if (source.revision !== action.target.expectedContentRevision)
            throw new Error('Szenenort wurde inzwischen geändert.');
          if (typeof action.target.title !== 'string' || action.target.title.length > 1000)
            throw new Error('Ungültiger Gruppenname.');
          availableLocation(db, campaignId, source.locationId);
          const id = randomUUID();
          db.prepare("INSERT INTO live_scene VALUES(?,?,0,?,'',?)").run(
            campaignId,
            id,
            action.target.title,
            source.locationId,
          );
          db.prepare('INSERT INTO scene_lifecycle VALUES(?,?,0,0)').run(campaignId, id);
          db.prepare('INSERT INTO scene_clock VALUES(?,?,0,?,?)').run(
            campaignId,
            id,
            source.clock.epochId,
            source.clock.instantMs,
          );
          destination = currentScene(db, campaignId, id);
          created = true;
        } else if (action.target?.kind === 'existing') {
          destination = currentScene(db, campaignId, action.target.sceneId);
          if (
            destination.membershipRevision !== action.target.expectedMembershipRevision ||
            destination.clock.revision !== action.target.expectedClockRevision ||
            destination.id === source.id
          )
            throw new Error('Zielgruppe ist veraltet oder entspricht der Ausgangsgruppe.');
        } else throw new Error('Gruppenziel fehlt.');
        for (const id of action.memberIds)
          db.prepare(
            'UPDATE roster_member SET scene_id=?,membership_revision=membership_revision+1 WHERE campaign_id=? AND id=?',
          ).run(destination.id, campaignId, id);
        for (const id of [source.id, destination.id])
          db.prepare(
            'UPDATE scene_lifecycle SET membership_revision=membership_revision+1 WHERE campaign_id=? AND id=?',
          ).run(campaignId, id);
        db.prepare('UPDATE roster_state SET revision=revision+1 WHERE campaign_id=?').run(
          campaignId,
        );
        session = sessionDelta(
          db,
          campaignId,
          action.memberIds,
          cleanupScenes(db, campaignId, destination.id),
          [source.id, destination.id],
        );
        if (created) {
          const target = currentScene(db, campaignId, destination.id);
          session.createdScene = {
            ...scenePlace(db, campaignId, target.id),
            id: target.id,
            title: target.title,
            primary: session.primaryId === target.id,
            members: target.members.length,
            membershipRevision: target.membershipRevision,
            clock: target.clock,
          };
        }
        targetId = source.id;
        revision = action.expectedRosterRevision + 1;
        scene = currentScene(db, campaignId, session.focusId);
        recordPartyHistory(
          db,
          campaignId,
          destination.id,
          action.memberIds.length === 1
            ? 'Figur verschoben'
            : 'Gruppe verschoben: ' + action.memberIds.length + ' Figuren',
          {
            kind: 'party-move',
            characterIds: action.memberIds,
            fromSceneId: source.id,
            toSceneId: destination.id,
            createdScene: created,
          },
        );
      } else if (action.kind === 'live-moment') {
        const before = currentScene(db, campaignId, action.sceneId);
        if (before.revision !== action.expectedRevision)
          throw new Error('Sceneinhalt wurde inzwischen geändert.');
        targetId = before.id;
        revision = before.revision;
        scene = before;
        const characterIds = db
          .prepare(
            'SELECT id FROM roster_member WHERE campaign_id=? AND scene_id=? AND active=1 ORDER BY ordinal,id',
          )
          .all(campaignId, targetId)
          .map((row: any) => row.id);
        recordPartyHistory(db, campaignId, targetId, action.title.trim(), {
          kind: 'live-moment',
          category: action.category,
          summary: action.summary,
          characterIds,
          locationId: before.locationId,
          instantMs: before.clock.instantMs,
          followUpKind: action.followUp?.kind ?? null,
          followUpId: action.followUp?.id ?? null,
        });
        if (action.draft) {
          clearSubmittedMomentDraft(db, campaignId, targetId, action.draft);
          scene = readLiveScene(db, campaignId, targetId);
        }
      } else if (action.kind === 'session-marker') {
        const boundary = readSessionBoundary(db, campaignId),
          open = boundary?.body.facts.marker === 'start';
        if ((action.marker === 'start') === open)
          throw new Error(
            open
              ? 'Ein Spielabend läuft bereits. Rückblick aktualisieren.'
              : 'Kein laufender Spielabend. Rückblick aktualisieren.',
          );
        const before = currentScene(db, campaignId, action.sceneId);
        if (before.revision !== action.expectedRevision)
          throw new Error('Sceneinhalt wurde inzwischen geändert.');
        targetId = before.id;
        revision = before.revision;
        scene = before;
        const characterIds = db
          .prepare(
            'SELECT id FROM roster_member WHERE campaign_id=? AND active=1 ORDER BY ordinal,id',
          )
          .all(campaignId)
          .map((row: any) => row.id);
        recordPartyHistory(
          db,
          campaignId,
          targetId,
          action.marker === 'start' ? 'Spielabend begonnen' : 'Spielabend beendet',
          {
            kind: 'session-marker',
            marker: action.marker,
            summary: action.summary,
            handoff: action.handoff ?? '',
            characterIds,
            locationId: before.locationId,
            instantMs: before.clock.instantMs,
          },
        );
        if (action.marker === 'end')
          recapDraft = consumeSessionRecapDraft(db, campaignId, {
            summary: action.summary,
            handoff: action.handoff ?? '',
          });
      } else if (action.kind === 'advance-clock') {
        const before = currentScene(db, campaignId, action.sceneId);
        if (before.clock.revision !== action.expectedRevision)
          throw new Error('Gruppenzeit geändert. Zeitvorschau aktualisieren.');
        if (typeof action.reason !== 'string' || action.reason.length > 2000)
          throw new Error('Ungültige Zeitnotiz.');
        let to: string;
        if (action.calendarVersion === 'relative-v1')
          to = advanceInstant(before.clock.instantMs, action.amount, action.unit);
        else if (action.calendarVersion === 'campaign-calendar-v1') {
          const calendar = readWorldCalendar(db, campaignId),
            focus = db
              .prepare('SELECT focus_id,focus_revision FROM live_state WHERE campaign_id=?')
              .get(campaignId);
          if (
            !validClockCalendar(action.calendar) ||
            calendar.revision !== action.calendar.revision ||
            calendar.daySeconds !== action.calendar.daySeconds
          )
            throw new Error('Kalender geändert. Zeitvorschau aktualisieren.');
          if (
            focus?.focus_id !== before.id ||
            focus.focus_revision !== action.expectedFocusRevision
          )
            throw new Error('Fokussierte Gruppe geändert. Zeitvorschau neu öffnen.');
          if (
            !validInstant(action.toInstantMs) ||
            BigInt(action.toInstantMs) <= BigInt(before.clock.instantMs)
          )
            throw new Error('Zeit muss vorwärts gehen.');
          if (action.eventTarget) {
            const target = action.eventTarget,
              event = readClockEvent(db, campaignId, target.eventId),
              occurrence = agendaOccurrence(event, before.clock.instantMs);
            if (
              event.revision !== target.expectedRevision ||
              !['start', 'end'].includes(target.phase) ||
              target.instantMs !==
                (target.phase === 'end' ? occurrence.endMs : occurrence.startMs) ||
              action.toInstantMs !== target.instantMs
            )
              throw new Error('Ereignis oder Ausführung geändert. Zeitvorschau aktualisieren.');
          }
          to = action.toInstantMs;
        } else throw new Error('Kalenderinterpretation unbekannt.');
        targetId = before.id;
        revision = before.clock.revision + 1;
        const ordinal = db
          .prepare(
            'SELECT coalesce(max(ordinal),-1)+1 n FROM scene_time_step WHERE campaign_id=? AND scene_id=?',
          )
          .get(campaignId, targetId).n;
        const payload = json({
          epochId: before.clock.epochId,
          from: before.clock.instantMs,
          to,
          beforeRevision: before.clock.revision,
          afterRevision: revision,
          ...(action.calendarVersion === 'relative-v1'
            ? { amount: action.amount, unit: action.unit }
            : { calendar: action.calendar, eventTarget: action.eventTarget }),
          calendarVersion: action.calendarVersion,
          reason: action.reason,
          recordedAt: new Date().toISOString(),
        });
        db.prepare('INSERT INTO scene_time_step VALUES(?,?,?,?,?,?,?)').run(
          campaignId,
          randomUUID(),
          targetId,
          command.commandId,
          ordinal,
          payload,
          hash(payload),
        );
        db.prepare(
          'UPDATE scene_clock SET revision=?,instant_ms=? WHERE campaign_id=? AND scene_id=?',
        ).run(revision, to, campaignId, targetId);
        scene = currentScene(db, campaignId, targetId);
      } else if (action.kind === 'visit-outcome') {
        const current = currentScene(db, campaignId, action.sceneId);
        if (
          current.revision !== action.expectedRevision ||
          current.adoption?.id !== action.adoptionId
        )
          throw new Error(
            'Aktueller Besuch wurde geändert. Ergebnis zuerst mit dem neuen Stand abgleichen.',
          );
        targetId = current.id;
        revision = current.revision + 1;
        db.prepare('UPDATE live_scene SET revision=? WHERE campaign_id=? AND id=?').run(
          revision,
          campaignId,
          targetId,
        );
        recordPartyHistory(
          db,
          campaignId,
          targetId,
          'Besuchsergebnis: ' +
            visitOutcomeLabel(action.status) +
            ' · ' +
            (current.adoption.title || 'Unbenannter Besuch'),
          {
            kind: 'visit-outcome',
            commandId: command.commandId,
            adoptionId: action.adoptionId,
            planId: current.adoption.planId,
            visitId: current.adoption.visitId,
            locationId: current.adoption.locationId,
            status: action.status,
            outcome: action.outcome,
            previous: current.adoption.outcome ?? null,
            sceneInstantMs: current.clock.instantMs,
            characterIds: current.members,
          },
        );
        scene = readLiveScene(db, campaignId, targetId);
      } else if (action.kind === 'scene-content' || action.kind === 'apply-visit') {
        const before = currentScene(db, campaignId, action.sceneId);
        if (before.revision !== action.expectedRevision)
          throw new Error('Sceneinhalt wurde inzwischen geändert.');
        targetId = before.id;
        revision = before.revision + 1;
        let title: string, notes: string, locationId: string | null;
        if (action.kind === 'apply-visit') {
          const plan = db
            .prepare('SELECT revision FROM plan WHERE campaign_id=? AND id=?')
            .get(campaignId, action.planId);
          const visit = db
            .prepare(
              'SELECT payload,checksum FROM planned_visit WHERE campaign_id=? AND plan_id=? AND id=?',
            )
            .get(campaignId, action.planId, action.visitId);
          if (
            !plan ||
            plan.revision !== action.expectedPlanRevision ||
            !visit ||
            hash(visit.payload) !== visit.checksum
          )
            throw new Error('Vorbereitung ist veraltet oder nicht verfügbar.');
          const checked = manualPlan({
            version: 1,
            id: action.planId,
            revision: plan.revision,
            name: '',
            scenes: [JSON.parse(visit.payload)],
          }).scenes[0]!;
          if (checked.id !== action.visitId)
            throw new Error('Vorbereitungsidentität stimmt nicht.');
          ({ title, notes, locationId } = checked);
          availableLocation(db, campaignId, locationId);
          const ordinal = db
            .prepare(
              'SELECT coalesce(max(ordinal),-1)+1 n FROM scene_adoption WHERE campaign_id=? AND scene_id=?',
            )
            .get(campaignId, targetId).n;
          const adoptionId = randomUUID();
          db.prepare('INSERT INTO scene_adoption VALUES(?,?,?,?,?,?,?,?,?,?)').run(
            campaignId,
            adoptionId,
            targetId,
            ordinal,
            action.planId,
            plan.revision,
            action.visitId,
            title,
            notes,
            locationId,
          );
          const detail = db
            .prepare('SELECT revision FROM session_visit WHERE campaign_id=? AND id=?')
            .get(campaignId, action.visitId);
          if (
            action.expectedVisitRevision !== undefined &&
            (detail?.revision ?? 0) !== action.expectedVisitRevision
          )
            throw new Error('Besuchsinhalte geändert. Übernahme erneut ansehen.');
          captureVisitDetails(
            db,
            campaignId,
            action.planId,
            action.visitId,
            targetId,
            adoptionId,
            locationId,
          );
        } else {
          ({ title, notes, locationId } = action);
          availableLocation(db, campaignId, locationId, before.locationId);
          if (action.readAloud !== undefined)
            writeSceneReadAloud(db, campaignId, targetId, action.readAloud);
        }
        if (
          typeof title !== 'string' ||
          typeof notes !== 'string' ||
          title.length > 1000 ||
          notes.length > 2_000_000
        )
          throw new Error('Ungültiger Sceneinhalt.');
        db.prepare(
          'UPDATE live_scene SET revision=?,title=?,notes=?,location_id=? WHERE campaign_id=? AND id=?',
        ).run(revision, title, notes, locationId, campaignId, targetId);
        scene = readLiveScene(db, campaignId, targetId);
        recordLocationVisit(
          db,
          campaignId,
          targetId,
          before.locationId,
          locationId,
          action.kind === 'apply-visit' ? 'visit' : 'manual',
          action.kind === 'apply-visit' ? action.visitId : undefined,
        );
      } else throw new Error('Unbekannte Liveaktion.');
      const rosterRevision = db
        .prepare('SELECT revision FROM roster_state WHERE campaign_id=?')
        .get(campaignId)?.revision;
      if (!Number.isSafeInteger(rosterRevision)) throw new Error('Partyquelle nicht verfügbar.');
      const archivedRosterCount = db
        .prepare(
          "SELECT count(*) n FROM character_profile WHERE campaign_id=? AND json_type(payload,'$.archive')='object'",
        )
        .get(campaignId).n;
      const ack: LiveAck = {
        ...(recapDraft !== undefined ? { recapDraft } : {}),
        archivedRosterCount,
        commandId: command.commandId,
        targetId,
        revision,
        rosterRevision,
        ...(scene ? { scene } : {}),
        ...(character ? { character } : {}),
        ...(session ? { session } : {}),
      };
      const payload = json(ack);
      db.prepare('INSERT INTO receipt VALUES(?,?,?,?,?)').run(
        command.commandId,
        fingerprint(command),
        campaignId,
        targetId,
        revision,
      );
      db.prepare('INSERT INTO live_receipt VALUES(?,?,?)').run(
        command.commandId,
        payload,
        hash(payload),
      );
      return ack;
    })
    .immediate();
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
