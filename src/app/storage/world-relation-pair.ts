import { createHash } from 'node:crypto';
import type {
  WorldRelationPairAck,
  WorldRelationPairCommand,
  WorldRelationPairDraft,
  WorldRelationPairHistoryCommand,
  WorldRelationPairHistoryView,
} from '../campaign/world-relation-pair-contracts';
import {
  inverseWorldFamilyRelationKind,
  worldFamilyRelationKinds,
  worldNoteDocument,
  type WorldFamilyRelationKind,
  type WorldNoteRelation,
  type WorldNoteV1,
} from '../../features/world/world-notes';
import { campaignLocalId } from '../../features/campaign/campaign-contracts';

const json = (value: unknown) => JSON.stringify(value),
  hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const worldRelationPairFingerprint = (command: WorldRelationPairCommand) =>
  hash(json({ ...command, token: undefined }));
const fingerprint = worldRelationPairFingerprint;
function decoded(row: any) {
  if (!row || hash(row.payload) !== row.checksum) throw new Error('Beziehungspaar ist beschädigt.');
  return JSON.parse(row.payload);
}
function checkedCommand(command: WorldRelationPairCommand) {
  if (
    !command ||
    typeof command.commandId !== 'string' ||
    !command.commandId ||
    command.commandId.length > 1000 ||
    typeof command.campaignId !== 'string' ||
    !command.campaignId ||
    typeof command.token !== 'string' ||
    !command.token
  )
    throw new Error('Beziehungspaarauftrag ist ungültig.');
  if (
    command.draftWriteId !== undefined &&
    (typeof command.draftWriteId !== 'string' || !command.draftWriteId)
  )
    throw new Error('Beziehungspaarentwurf ist ungültig.');
  const a = command.action;
  if (
    !a ||
    !['add', 'remove'].includes(a.kind) ||
    campaignLocalId(a.sourceId) !== a.sourceId ||
    campaignLocalId(a.targetId) !== a.targetId ||
    a.sourceId === a.targetId ||
    !Number.isSafeInteger(a.sourceRevision) ||
    a.sourceRevision < 1 ||
    !Number.isSafeInteger(a.targetRevision) ||
    a.targetRevision < 1
  )
    throw new Error('Beziehungspaar ist ungültig.');
  for (const label of [a.forwardLabel, a.reverseLabel])
    if (typeof label !== 'string' || !label.trim() || label.length > 1000)
      throw new Error('Beziehungspaar benötigt zwei gültige Bezeichnungen.');
  const kinds = [a.forwardFamilyKind, a.reverseFamilyKind];
  if (
    (kinds[0] === undefined) !== (kinds[1] === undefined) ||
    kinds.some((kind) => kind !== undefined && !worldFamilyRelationKinds.includes(kind))
  )
    throw new Error('Familienbeziehungspaar ist ungültig.');
  if (
    a.forwardFamilyKind !== undefined &&
    a.reverseFamilyKind !== inverseWorldFamilyRelationKind(a.forwardFamilyKind)
  )
    throw new Error('Familienbeziehungspaar benötigt passende Gegenrichtungen.');
  return command;
}
function note(db: any, cam: string, id: string): { row: any; note: WorldNoteV1 } {
  const row = db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(cam, id);
  if (!row || row.trashed)
    throw new Error('Beziehungspaar zeigt auf keinen verfügbaren Weltinhalt.');
  const value = worldNoteDocument(decoded(row));
  if (value.id !== row.id || value.revision !== row.revision)
    throw new Error('Beziehungspaar widerspricht seiner Weltidentität.');
  return { row, note: value };
}
function put(db: any, cam: string, value: WorldNoteV1) {
  const payload = json(worldNoteDocument(value));
  db.prepare(
    'UPDATE world_note SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
  ).run(value.revision, payload, hash(payload), cam, value.id);
}
export function installWorldRelationPairs(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS world_relation_pair_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaign(id),fingerprint TEXT NOT NULL,source_id TEXT NOT NULL,target_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,FOREIGN KEY(campaign_id,source_id) REFERENCES world_note(campaign_id,id),FOREIGN KEY(campaign_id,target_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS world_relation_pair_draft(campaign_id TEXT NOT NULL REFERENCES campaign(id),source_id TEXT NOT NULL,write_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,source_id),FOREIGN KEY(campaign_id,source_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS world_relation_pair_history_state(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id),cursor INTEGER NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS world_relation_pair_history(campaign_id TEXT NOT NULL REFERENCES campaign(id),ordinal INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,ordinal)) STRICT;
CREATE TABLE IF NOT EXISTS world_relation_pair_history_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaign(id),fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;`);
}
interface PairHistoryEntry {
  version: 1;
  ordinal: number;
  operation: 'add' | 'remove';
  sourceId: string;
  targetId: string;
  forwardLabel: string;
  reverseLabel: string;
  forwardFamilyKind?: WorldFamilyRelationKind;
  reverseFamilyKind?: WorldFamilyRelationKind;
  afterSourceRevision: number;
  afterTargetRevision: number;
  undoSourceRevision: number | null;
  undoTargetRevision: number | null;
}
function historyEntry(row: any): PairHistoryEntry {
  const value = decoded(row) as PairHistoryEntry,
    kinds = [value.forwardFamilyKind, value.reverseFamilyKind];
  if (
    value.version !== 1 ||
    value.ordinal !== row.ordinal ||
    !Number.isSafeInteger(value.ordinal) ||
    value.ordinal < 1 ||
    !['add', 'remove'].includes(value.operation) ||
    campaignLocalId(value.sourceId) !== value.sourceId ||
    campaignLocalId(value.targetId) !== value.targetId ||
    value.sourceId === value.targetId ||
    typeof value.forwardLabel !== 'string' ||
    !value.forwardLabel.trim() ||
    value.forwardLabel.length > 1000 ||
    typeof value.reverseLabel !== 'string' ||
    !value.reverseLabel.trim() ||
    value.reverseLabel.length > 1000 ||
    (kinds[0] === undefined) !== (kinds[1] === undefined) ||
    kinds.some((kind) => kind !== undefined && !worldFamilyRelationKinds.includes(kind)) ||
    (value.forwardFamilyKind !== undefined &&
      value.reverseFamilyKind !== inverseWorldFamilyRelationKind(value.forwardFamilyKind)) ||
    !Number.isSafeInteger(value.afterSourceRevision) ||
    value.afterSourceRevision < 2 ||
    !Number.isSafeInteger(value.afterTargetRevision) ||
    value.afterTargetRevision < 2 ||
    (value.undoSourceRevision === null) !== (value.undoTargetRevision === null) ||
    (value.undoSourceRevision !== null &&
      (!Number.isSafeInteger(value.undoSourceRevision) || value.undoSourceRevision < 2)) ||
    (value.undoTargetRevision !== null &&
      (!Number.isSafeInteger(value.undoTargetRevision) || value.undoTargetRevision < 2))
  )
    throw new Error('Beziehungspaarhistory ist ungültig.');
  return value;
}
function historyCursor(db: any, cam: string) {
  return (
    db.prepare('SELECT cursor FROM world_relation_pair_history_state WHERE campaign_id=?').get(cam)
      ?.cursor ?? 0
  );
}
function historyTitle(db: any, cam: string, id: string) {
  const row = db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(cam, id);
  if (!row) return id;
  return worldNoteDocument(decoded(row)).title;
}
function historyLabel(db: any, cam: string, entry: PairHistoryEntry) {
  return (
    (entry.operation === 'add' ? 'Paar anlegen: ' : 'Paar lösen: ') +
    historyTitle(db, cam, entry.sourceId) +
    ' ↔ ' +
    historyTitle(db, cam, entry.targetId) +
    ' · ' +
    entry.forwardLabel +
    ' / ' +
    entry.reverseLabel
  );
}
export function readWorldRelationPairHistory(db: any, cam: string): WorldRelationPairHistoryView {
  const cursor = historyCursor(db, cam),
    undo = cursor
      ? db
          .prepare('SELECT * FROM world_relation_pair_history WHERE campaign_id=? AND ordinal=?')
          .get(cam, cursor)
      : null,
    redo = db
      .prepare('SELECT * FROM world_relation_pair_history WHERE campaign_id=? AND ordinal=?')
      .get(cam, cursor + 1);
  return {
    cursor,
    canUndo: !!undo,
    canRedo: !!redo,
    undoLabel: undo ? historyLabel(db, cam, historyEntry(undo)) : null,
    redoLabel: redo ? historyLabel(db, cam, historyEntry(redo)) : null,
  };
}
function saveHistoryEntry(db: any, cam: string, entry: PairHistoryEntry) {
  const payload = json(entry);
  db.prepare(
    'UPDATE world_relation_pair_history SET payload=?,checksum=? WHERE campaign_id=? AND ordinal=?',
  ).run(payload, hash(payload), cam, entry.ordinal);
}
function appendHistory(
  db: any,
  cam: string,
  a: WorldRelationPairCommand['action'],
  sourceRevision: number,
  targetRevision: number,
) {
  db.prepare('INSERT OR IGNORE INTO world_relation_pair_history_state VALUES(?,0)').run(cam);
  const cursor = historyCursor(db, cam);
  db.prepare('DELETE FROM world_relation_pair_history WHERE campaign_id=? AND ordinal>?').run(
    cam,
    cursor,
  );
  const entry: PairHistoryEntry = {
      version: 1,
      ordinal: cursor + 1,
      operation: a.kind,
      sourceId: a.sourceId,
      targetId: a.targetId,
      forwardLabel: a.forwardLabel,
      reverseLabel: a.reverseLabel,
      ...(a.forwardFamilyKind === undefined
        ? {}
        : { forwardFamilyKind: a.forwardFamilyKind, reverseFamilyKind: a.reverseFamilyKind }),
      afterSourceRevision: sourceRevision,
      afterTargetRevision: targetRevision,
      undoSourceRevision: null,
      undoTargetRevision: null,
    },
    payload = json(entry);
  db.prepare('INSERT INTO world_relation_pair_history VALUES(?,?,?,?)').run(
    cam,
    entry.ordinal,
    payload,
    hash(payload),
  );
  db.prepare('UPDATE world_relation_pair_history_state SET cursor=? WHERE campaign_id=?').run(
    entry.ordinal,
    cam,
  );
}
const relation = (
  targetId: string,
  label: string,
  familyKind?: WorldFamilyRelationKind,
): WorldNoteRelation =>
  familyKind === undefined
    ? { targetId: campaignLocalId(targetId), label }
    : { targetId: campaignLocalId(targetId), label, familyKind };
const matches = (
  value: WorldNoteRelation,
  targetId: string,
  label: string,
  familyKind?: WorldFamilyRelationKind,
) => value.targetId === targetId && value.label === label && value.familyKind === familyKind;
export function executeWorldRelationPair(
  db: any,
  command: WorldRelationPairCommand,
  guard: () => void,
): WorldRelationPairAck {
  return db
    .transaction(() => {
      guard();
      checkedCommand(command);
      const cam = command.campaignId,
        fp = fingerprint(command),
        prior = db
          .prepare('SELECT * FROM world_relation_pair_receipt WHERE command_id=?')
          .get(command.commandId);
      if (prior) {
        if (prior.campaign_id !== cam || prior.fingerprint !== fp)
          throw new Error('Beziehungspaarauftrag wurde anders verwendet.');
        return decoded(prior);
      }
      if (command.draftWriteId) {
        const draft = readWorldRelationPairDraft(db, cam, command.action.sourceId);
        if (!draft || draft.writeId !== command.draftWriteId || fingerprint(draft.command) !== fp)
          throw new Error('Beziehungspaarauftrag stimmt nicht mit seinem Entwurf überein.');
      }
      const a = command.action,
        source = note(db, cam, a.sourceId),
        target = note(db, cam, a.targetId);
      if (source.row.revision !== a.sourceRevision || target.row.revision !== a.targetRevision)
        throw new Error('Beziehungspaar-Konflikt: Ein Weltinhalt wurde geändert.');
      if (
        a.forwardFamilyKind !== undefined &&
        (source.note.kind !== 'npc' || target.note.kind !== 'npc')
      )
        throw new Error('Familienbeziehungen verbinden ausschließlich NPCs.');
      const forward = (r: WorldNoteRelation) =>
          matches(r, a.targetId, a.forwardLabel, a.forwardFamilyKind),
        reverse = (r: WorldNoteRelation) =>
          matches(r, a.sourceId, a.reverseLabel, a.reverseFamilyKind),
        hasForward = source.note.relations.some(forward),
        hasReverse = target.note.relations.some(reverse);
      if (
        a.kind === 'add' &&
        (source.note.relations.some(
          (r) => r.targetId === a.targetId && r.label === a.forwardLabel,
        ) ||
          target.note.relations.some(
            (r) => r.targetId === a.sourceId && r.label === a.reverseLabel,
          ))
      )
        throw new Error('Mindestens eine Richtung dieses Beziehungspaars ist bereits vorhanden.');
      if (a.kind === 'remove' && (!hasForward || !hasReverse))
        throw new Error('Das gekoppelte Beziehungspaar ist nicht mehr vollständig vorhanden.');
      const sourceRevision = source.row.revision + 1,
        targetRevision = target.row.revision + 1;
      const nextSource = worldNoteDocument({
        ...source.note,
        revision: sourceRevision,
        relations:
          a.kind === 'add'
            ? [...source.note.relations, relation(a.targetId, a.forwardLabel, a.forwardFamilyKind)]
            : source.note.relations.filter((r) => !forward(r)),
      });
      const nextTarget = worldNoteDocument({
        ...target.note,
        revision: targetRevision,
        relations:
          a.kind === 'add'
            ? [...target.note.relations, relation(a.sourceId, a.reverseLabel, a.reverseFamilyKind)]
            : target.note.relations.filter((r) => !reverse(r)),
      });
      put(db, cam, nextSource);
      put(db, cam, nextTarget);
      appendHistory(db, cam, a, sourceRevision, targetRevision);
      const ack = { sourceRevision, targetRevision },
        payload = json(ack);
      db.prepare('INSERT INTO world_relation_pair_receipt VALUES(?,?,?,?,?,?,?)').run(
        command.commandId,
        cam,
        fp,
        a.sourceId,
        a.targetId,
        payload,
        hash(payload),
      );
      if (command.draftWriteId)
        db.prepare(
          'DELETE FROM world_relation_pair_draft WHERE campaign_id=? AND source_id=? AND write_id=?',
        ).run(cam, a.sourceId, command.draftWriteId);
      return ack;
    })
    .immediate();
}
export function reconcileWorldRelationPair(
  db: any,
  command: WorldRelationPairCommand,
  cam: string,
) {
  checkedCommand(command);
  const a = command.action,
    r = db
      .prepare('SELECT * FROM world_relation_pair_receipt WHERE command_id=?')
      .get(command.commandId);
  if (r) {
    if (r.campaign_id !== cam || r.fingerprint !== fingerprint(command))
      throw new Error('Beziehungspaarauftrag wurde anders verwendet.');
    decoded(r);
    const s = db
        .prepare('SELECT revision FROM world_note WHERE campaign_id=? AND id=?')
        .get(cam, a.sourceId),
      t = db
        .prepare('SELECT revision FROM world_note WHERE campaign_id=? AND id=?')
        .get(cam, a.targetId),
      ack = decoded(r) as WorldRelationPairAck;
    return {
      outcome: 'applied' as const,
      targetChanged: s?.revision !== ack.sourceRevision || t?.revision !== ack.targetRevision,
    };
  }
  const s = db
      .prepare('SELECT revision FROM world_note WHERE campaign_id=? AND id=?')
      .get(cam, a.sourceId),
    t = db
      .prepare('SELECT revision FROM world_note WHERE campaign_id=? AND id=?')
      .get(cam, a.targetId),
    changed = s?.revision !== a.sourceRevision || t?.revision !== a.targetRevision;
  return {
    outcome: changed ? ('conflict' as const) : ('not-applied' as const),
    targetChanged: changed,
  };
}
function checkDraftReceipt(db: any, cam: string, draft: WorldRelationPairDraft) {
  const receipt = db
    .prepare('SELECT * FROM world_relation_pair_receipt WHERE command_id=?')
    .get(draft.command.commandId);
  if (!receipt) return;
  if (
    receipt.campaign_id !== cam ||
    receipt.source_id !== draft.command.action.sourceId ||
    receipt.target_id !== draft.command.action.targetId ||
    receipt.fingerprint !== fingerprint(draft.command)
  )
    throw new Error('Beziehungspaarentwurf widerspricht seinem Beleg.');
  decoded(receipt);
}
export function readWorldRelationPairDraft(
  db: any,
  cam: string,
  sourceId: string,
): WorldRelationPairDraft | null {
  const row = db
    .prepare('SELECT * FROM world_relation_pair_draft WHERE campaign_id=? AND source_id=?')
    .get(cam, sourceId);
  if (!row) return null;
  const draft = decoded(row) as WorldRelationPairDraft;
  if (
    draft.version !== 1 ||
    draft.writeId !== row.write_id ||
    draft.command.action.sourceId !== sourceId ||
    draft.command.campaignId !== cam ||
    draft.command.draftWriteId !== draft.writeId
  )
    throw new Error('Beziehungspaarentwurf ist falsch zugeordnet.');
  checkedCommand(draft.command);
  checkDraftReceipt(db, cam, draft);
  return draft;
}
export function keepWorldRelationPairDraft(
  db: any,
  cam: string,
  draft: WorldRelationPairDraft,
  expected: string | null,
) {
  if (
    !draft ||
    draft.version !== 1 ||
    typeof draft.writeId !== 'string' ||
    !draft.writeId ||
    draft.command.draftWriteId !== draft.writeId
  )
    throw new Error('Beziehungspaarentwurf ist ungültig.');
  checkedCommand(draft.command);
  if (draft.command.campaignId !== cam)
    throw new Error('Beziehungspaarentwurf gehört zu einer anderen Kampagne.');
  checkDraftReceipt(db, cam, draft);
  note(db, cam, draft.command.action.sourceId);
  note(db, cam, draft.command.action.targetId);
  const prior = db
    .prepare('SELECT write_id FROM world_relation_pair_draft WHERE campaign_id=? AND source_id=?')
    .get(cam, draft.command.action.sourceId);
  if ((prior?.write_id ?? null) !== expected)
    throw new Error('Beziehungspaarentwurf wurde bereits geändert.');
  const payload = json(draft);
  db.prepare(
    'INSERT INTO world_relation_pair_draft VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,source_id) DO UPDATE SET write_id=excluded.write_id,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, draft.command.action.sourceId, draft.writeId, payload, hash(payload));
}
export function discardWorldRelationPairDraft(
  db: any,
  cam: string,
  sourceId: string,
  writeId: string,
) {
  const changed = db
    .prepare(
      'DELETE FROM world_relation_pair_draft WHERE campaign_id=? AND source_id=? AND write_id=?',
    )
    .run(cam, sourceId, writeId).changes;
  if (!changed) throw new Error('Beziehungspaarentwurf wurde bereits geändert.');
}
function applyHistoryEntry(db: any, cam: string, entry: PairHistoryEntry, forward: boolean) {
  const source = note(db, cam, entry.sourceId),
    target = note(db, cam, entry.targetId),
    operation = forward ? entry.operation : entry.operation === 'add' ? 'remove' : 'add',
    isForward = (r: WorldNoteRelation) =>
      matches(r, entry.targetId, entry.forwardLabel, entry.forwardFamilyKind),
    isReverse = (r: WorldNoteRelation) =>
      matches(r, entry.sourceId, entry.reverseLabel, entry.reverseFamilyKind),
    hasForward = source.note.relations.some(isForward),
    hasReverse = target.note.relations.some(isReverse);
  if (
    (operation === 'add' && (hasForward || hasReverse)) ||
    (operation === 'remove' && (!hasForward || !hasReverse))
  )
    throw new Error('Beziehungspaarhistory stimmt nicht mehr mit den Kanten überein.');
  const sourceRevision = source.row.revision + 1,
    targetRevision = target.row.revision + 1;
  const nextSource = worldNoteDocument({
      ...source.note,
      revision: sourceRevision,
      relations:
        operation === 'add'
          ? [
              ...source.note.relations,
              relation(entry.targetId, entry.forwardLabel, entry.forwardFamilyKind),
            ]
          : source.note.relations.filter((r) => !isForward(r)),
    }),
    nextTarget = worldNoteDocument({
      ...target.note,
      revision: targetRevision,
      relations:
        operation === 'add'
          ? [
              ...target.note.relations,
              relation(entry.sourceId, entry.reverseLabel, entry.reverseFamilyKind),
            ]
          : target.note.relations.filter((r) => !isReverse(r)),
    });
  put(db, cam, nextSource);
  put(db, cam, nextTarget);
  return { sourceRevision, targetRevision };
}
function rebaseNeighbor(
  db: any,
  cam: string,
  cursor: number,
  direction: 'undo' | 'redo',
  ids: Map<string, number>,
) {
  const step = direction === 'undo' ? -1 : 1;
  for (const [id, revision] of ids) {
    let ordinal = cursor + step;
    while (ordinal > 0) {
      const row = db
        .prepare('SELECT * FROM world_relation_pair_history WHERE campaign_id=? AND ordinal=?')
        .get(cam, ordinal);
      if (!row) break;
      const entry = historyEntry(row),
        side = entry.sourceId === id ? 'source' : entry.targetId === id ? 'target' : null;
      if (side) {
        if (direction === 'undo') {
          if (side === 'source') entry.afterSourceRevision = revision;
          else entry.afterTargetRevision = revision;
        } else {
          if (side === 'source') entry.undoSourceRevision = revision;
          else entry.undoTargetRevision = revision;
        }
        saveHistoryEntry(db, cam, entry);
        break;
      }
      ordinal += step;
    }
  }
}
const historyFingerprint = (command: WorldRelationPairHistoryCommand) =>
  hash(json({ ...command, token: undefined }));
function checkedHistoryCommand(command: WorldRelationPairHistoryCommand) {
  if (
    !command ||
    typeof command.commandId !== 'string' ||
    !command.commandId ||
    typeof command.campaignId !== 'string' ||
    !command.campaignId ||
    typeof command.token !== 'string' ||
    !command.token ||
    !Number.isSafeInteger(command.expectedCursor) ||
    command.expectedCursor < 0 ||
    !['undo', 'redo'].includes(command.direction)
  )
    throw new Error('Beziehungspaar-Historyauftrag ist ungültig.');
  return command;
}
export function executeWorldRelationPairHistory(
  db: any,
  command: WorldRelationPairHistoryCommand,
  guard: () => void,
): WorldRelationPairHistoryView {
  return db
    .transaction(() => {
      guard();
      checkedHistoryCommand(command);
      const cam = command.campaignId,
        fp = historyFingerprint(command),
        prior = db
          .prepare('SELECT * FROM world_relation_pair_history_receipt WHERE command_id=?')
          .get(command.commandId);
      if (prior) {
        if (prior.campaign_id !== cam || prior.fingerprint !== fp)
          throw new Error('Beziehungspaar-Historyauftrag wurde anders verwendet.');
        return decoded(prior);
      }
      const cursor = historyCursor(db, cam);
      if (cursor !== command.expectedCursor)
        throw new Error('Beziehungspaar-History wurde geändert. Bitte aktualisieren.');
      const ordinal = command.direction === 'undo' ? cursor : cursor + 1,
        row = db
          .prepare('SELECT * FROM world_relation_pair_history WHERE campaign_id=? AND ordinal=?')
          .get(cam, ordinal);
      if (!row)
        throw new Error(
          command.direction === 'undo'
            ? 'Keine Paaränderung zum Rückgängigmachen.'
            : 'Keine Paaränderung zum Wiederholen.',
        );
      const entry = historyEntry(row),
        source = note(db, cam, entry.sourceId),
        target = note(db, cam, entry.targetId),
        expectedSource =
          command.direction === 'undo' ? entry.afterSourceRevision : entry.undoSourceRevision,
        expectedTarget =
          command.direction === 'undo' ? entry.afterTargetRevision : entry.undoTargetRevision;
      if (
        expectedSource === null ||
        expectedTarget === null ||
        source.row.revision !== expectedSource ||
        target.row.revision !== expectedTarget
      )
        throw new Error(
          'Beziehungspaar wurde danach anderweitig geändert. History bleibt gesperrt.',
        );
      const revisions = applyHistoryEntry(db, cam, entry, command.direction === 'redo');
      if (command.direction === 'undo') {
        entry.undoSourceRevision = revisions.sourceRevision;
        entry.undoTargetRevision = revisions.targetRevision;
      } else {
        entry.afterSourceRevision = revisions.sourceRevision;
        entry.afterTargetRevision = revisions.targetRevision;
      }
      saveHistoryEntry(db, cam, entry);
      const nextCursor = command.direction === 'undo' ? cursor - 1 : cursor + 1;
      db.prepare('UPDATE world_relation_pair_history_state SET cursor=? WHERE campaign_id=?').run(
        nextCursor,
        cam,
      );
      rebaseNeighbor(
        db,
        cam,
        entry.ordinal,
        command.direction,
        new Map([
          [entry.sourceId, revisions.sourceRevision],
          [entry.targetId, revisions.targetRevision],
        ]),
      );
      const result = readWorldRelationPairHistory(db, cam),
        payload = json(result);
      db.prepare('INSERT INTO world_relation_pair_history_receipt VALUES(?,?,?,?,?)').run(
        command.commandId,
        cam,
        fp,
        payload,
        hash(payload),
      );
      return result;
    })
    .immediate();
}
export function reconcileWorldRelationPairHistory(
  db: any,
  command: WorldRelationPairHistoryCommand,
  cam: string,
) {
  checkedHistoryCommand(command);
  const fp = historyFingerprint(command),
    row = db
      .prepare('SELECT * FROM world_relation_pair_history_receipt WHERE command_id=?')
      .get(command.commandId);
  if (row) {
    if (row.campaign_id !== cam || row.fingerprint !== fp)
      throw new Error('Beziehungspaar-Historyauftrag wurde anders verwendet.');
    const result = decoded(row) as WorldRelationPairHistoryView;
    return { outcome: 'applied' as const, targetChanged: historyCursor(db, cam) !== result.cursor };
  }
  const changed = historyCursor(db, cam) !== command.expectedCursor;
  return {
    outcome: changed ? ('conflict' as const) : ('not-applied' as const),
    targetChanged: changed,
  };
}
/** Soft-deleted notes retain their relationships, including reciprocal family edges. */
export function validateWorldRelationPairs(db: any) {
  for (const row of db.prepare('SELECT * FROM world_relation_pair_draft').iterate())
    readWorldRelationPairDraft(db, row.campaign_id, row.source_id);
  for (const row of db.prepare('SELECT * FROM world_relation_pair_receipt').iterate()) {
    const ack = decoded(row) as WorldRelationPairAck;
    if (
      typeof row.command_id !== 'string' ||
      !row.command_id ||
      typeof row.fingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(row.fingerprint) ||
      !Number.isSafeInteger(ack.sourceRevision) ||
      ack.sourceRevision < 2 ||
      !Number.isSafeInteger(ack.targetRevision) ||
      ack.targetRevision < 2
    )
      throw new Error('Beziehungspaarbeleg ist ungültig.');
  }
  for (const row of db.prepare('SELECT * FROM world_relation_pair_history').iterate()) {
    historyEntry(row);
    if (
      !db
        .prepare('SELECT 1 FROM world_relation_pair_history_state WHERE campaign_id=?')
        .get(row.campaign_id)
    )
      throw new Error('Beziehungspaar-History besitzt keinen Cursor.');
  }
  for (const state of db.prepare('SELECT * FROM world_relation_pair_history_state').iterate()) {
    const sequence = db
      .prepare(
        'SELECT count(*) count,coalesce(max(ordinal),0) maximum FROM world_relation_pair_history WHERE campaign_id=?',
      )
      .get(state.campaign_id);
    if (
      !Number.isSafeInteger(state.cursor) ||
      state.cursor < 0 ||
      state.cursor > sequence.count ||
      sequence.maximum !== sequence.count
    )
      throw new Error('Beziehungspaar-Historycursor ist ungültig.');
  }
  for (const row of db.prepare('SELECT * FROM world_relation_pair_history_receipt').iterate()) {
    const view = decoded(row) as WorldRelationPairHistoryView;
    if (
      typeof row.command_id !== 'string' ||
      !row.command_id ||
      typeof row.fingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(row.fingerprint) ||
      !Number.isSafeInteger(view.cursor) ||
      view.cursor < 0 ||
      typeof view.canUndo !== 'boolean' ||
      typeof view.canRedo !== 'boolean' ||
      (view.undoLabel !== null && typeof view.undoLabel !== 'string') ||
      (view.redoLabel !== null && typeof view.redoLabel !== 'string')
    )
      throw new Error('Beziehungspaar-Historybeleg ist ungültig.');
  }
  for (const row of db.prepare('SELECT * FROM world_note').iterate()) {
    const source = worldNoteDocument(decoded(row));
    for (const relation of source.relations) {
      if (!relation.familyKind) continue;
      const targetRow = db
        .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
        .get(row.campaign_id, relation.targetId);
      if (!targetRow) throw new Error('Familienbeziehung zeigt auf keinen gespeicherten NPC.');
      const target = worldNoteDocument(decoded(targetRow)),
        inverse = inverseWorldFamilyRelationKind(relation.familyKind);
      if (
        source.kind !== 'npc' ||
        target.kind !== 'npc' ||
        !target.relations.some(
          (candidate) => candidate.targetId === source.id && candidate.familyKind === inverse,
        )
      )
        throw new Error('Familienbeziehung besitzt keine passende Gegenrichtung.');
    }
  }
}
