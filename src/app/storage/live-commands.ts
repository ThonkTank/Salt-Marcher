import { consumeSessionRecapDraft } from './session-recap';
import { clearSubmittedMomentDraft } from './live-moment-drafts';
import { readSessionBoundary } from './chronicle';
import { readWorldCalendar } from './world-calendar-read';
import { readClockEvent } from './calendar-events';
import { agendaOccurrence } from '../runtime/agenda-model';
import { validClockCalendar, validInstant } from '../runtime/time-plan-model';
import { visitOutcomeLabel } from '../runtime/visit-outcome-contracts';
import { randomUUID } from 'node:crypto';
import {
  advanceInstant,
  checkedCharacterProfile,
  validateLiveCommand,
  type Character,
  type LiveAck,
  type LiveCommand,
  type LiveScene,
  type LiveStatus,
} from '../runtime/live-contracts';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { manualPlan } from '../../features/planner/manual-planner';
import { captureVisitDetails, writeSceneReadAloud } from './preparation-write';
import {
  hash,
  profile,
  readLiveScene,
  activeSummaries,
  archiveCount,
  readLive,
  scenePlace,
} from './live-read';
export const json = (value: unknown) => JSON.stringify(value);

export const fingerprint = (command: LiveCommand) => hash(json({ ...command, token: undefined }));

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
