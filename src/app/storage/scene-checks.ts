import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { SceneCheck, SceneCheckCommand, SceneChecks } from '../runtime/scene-check-contracts';
import { readLiveScene } from './live-read';
import { formulaOutcome, parseDiceFormula } from '../shared/dice-formula';

const json = (value: unknown) => JSON.stringify(value),
  hash = (text: string) => createHash('sha256').update(text).digest('hex');
const fingerprint = (command: SceneCheckCommand) => hash(json({ ...command, token: undefined }));
const checkOutcome = (value: {
  dc: number | null;
  total: number;
  rollKind?: string;
  formulaKind?: string;
  rolls: number[];
}) =>
  value.rollKind === 'formula'
    ? formulaOutcome(
        value.formulaKind as 'attack' | 'damage' | undefined,
        value.rolls[0]!,
        value.total,
        value.dc,
      )
    : value.dc === null
      ? null
      : value.total >= value.dc
        ? 'success'
        : 'failure';

export function installSceneCheckSchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS scene_check_state(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(campaign_id,scene_id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id));
 CREATE TABLE IF NOT EXISTS scene_check(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,id TEXT NOT NULL,ordinal INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),UNIQUE(campaign_id,scene_id,ordinal),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id));
 CREATE TABLE IF NOT EXISTS scene_check_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaign(id),fingerprint TEXT NOT NULL,check_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL);`);
}

function checked(
  value: unknown,
  owner?: { sceneId: string; id?: string; ordinal?: number },
): SceneCheck {
  const v = value as SceneCheck;
  const formulaRoll = v?.rollKind === 'formula';
  if (
    !v ||
    typeof v !== 'object' ||
    typeof v.id !== 'string' ||
    !v.id ||
    typeof v.sceneId !== 'string' ||
    !v.sceneId ||
    (owner &&
      (v.sceneId !== owner.sceneId ||
        (owner.id !== undefined && v.id !== owner.id) ||
        (owner.ordinal !== undefined && v.ordinal !== owner.ordinal))) ||
    !Number.isSafeInteger(v.ordinal) ||
    v.ordinal < 1 ||
    typeof v.label !== 'string' ||
    !v.label.trim() ||
    v.label.length > 1000 ||
    (v.ruleNoteId !== null && (typeof v.ruleNoteId !== 'string' || !v.ruleNoteId)) ||
    (v.ruleTitle !== null && (typeof v.ruleTitle !== 'string' || !v.ruleTitle)) ||
    (v.ruleSourceRevision !== null &&
      (!Number.isSafeInteger(v.ruleSourceRevision) || v.ruleSourceRevision < 1)) ||
    (v.ruleNoteId === null) !== (v.ruleTitle === null) ||
    (v.ruleNoteId === null) !== (v.ruleSourceRevision === null) ||
    !['normal', 'advantage', 'disadvantage'].includes(v.mode) ||
    !Number.isSafeInteger(v.modifier) ||
    v.modifier < -1000 ||
    v.modifier > 1000 ||
    (v.dc !== null && (!Number.isSafeInteger(v.dc) || v.dc < -1000 || v.dc > 1000)) ||
    !Array.isArray(v.rolls) ||
    (!formulaRoll && v.rolls.length !== (v.mode === 'normal' ? 1 : 2)) ||
    v.rolls.some(
      (roll) => !Number.isSafeInteger(roll) || roll < 1 || (!formulaRoll && roll > 20),
    ) ||
    !Number.isSafeInteger(v.total) ||
    (!formulaRoll &&
      v.total !==
        (v.mode === 'advantage'
          ? Math.max(...v.rolls)
          : v.mode === 'disadvantage'
            ? Math.min(...v.rolls)
            : v.rolls[0]!) +
          v.modifier) ||
    v.outcome !== checkOutcome(v) ||
    typeof v.sceneInstantMs !== 'string' ||
    !/^(0|[1-9][0-9]{0,29})$/.test(v.sceneInstantMs) ||
    typeof v.recordedAt !== 'string' ||
    Number.isNaN(Date.parse(v.recordedAt))
  )
    throw new Error('Gespeicherte GM-Probe ist beschädigt.');
  if (v.rollKind !== undefined && !['check', 'formula'].includes(v.rollKind))
    throw new Error('Gespeicherte GM-Probe hat eine unbekannte Wurfart.');
  for (const field of [v.actor, v.sourceCreatureId, v.sourceActionId])
    if (
      field !== undefined &&
      field !== null &&
      (typeof field !== 'string' || !field || field.length > 1000)
    )
      throw new Error('Gespeicherter Wurfkontext ist ungültig.');
  if (v.rollKind === 'formula') {
    const formula = parseDiceFormula(v.formula ?? ''),
      fields = [v.actor, v.sourceCreatureId, v.sourceActionId];
    if (
      (v.formulaKind !== undefined && !['attack', 'damage'].includes(v.formulaKind)) ||
      fields.some(
        (field) => field !== null && (typeof field !== 'string' || !field || field.length > 1000),
      ) ||
      v.mode !== 'normal' ||
      v.ruleNoteId !== null ||
      v.rolls.length !== formula.count ||
      v.rolls.some((roll) => roll > formula.sides) ||
      v.modifier !== formula.modifier ||
      v.total !== v.rolls.reduce((sum, roll) => sum + roll, 0) + formula.modifier
    )
      throw new Error('Gespeicherter Formelwurf ist beschädigt.');
  }
  return v;
}
function decoded(row: any): SceneCheck {
  if (!row || typeof row.payload !== 'string' || hash(row.payload) !== row.checksum)
    throw new Error('Gespeicherte GM-Probe ist beschädigt.');
  return checked(JSON.parse(row.payload), {
    sceneId: row.scene_id,
    id: row.id,
    ordinal: row.ordinal,
  });
}
function checkCommand(command: SceneCheckCommand) {
  const a = command?.action;
  if (
    !command ||
    ![command.commandId, command.campaignId, command.token, command.sceneId].every(
      (value) => typeof value === 'string' && !!value && value.length <= 1000,
    ) ||
    !Number.isSafeInteger(command.expectedRevision) ||
    command.expectedRevision < 0 ||
    !a ||
    !['roll', 'formula'].includes(a.kind) ||
    typeof a.label !== 'string' ||
    !a.label.trim() ||
    a.label.length > 1000 ||
    (a.dc !== null && (!Number.isSafeInteger(a.dc) || a.dc < -1000 || a.dc > 1000))
  )
    throw new Error('Ungültiger GM-Probenauftrag.');
  for (const field of [a.actor, a.sourceCreatureId, a.sourceActionId])
    if (
      field !== undefined &&
      field !== null &&
      (typeof field !== 'string' || !field || field.length > 1000)
    )
      throw new Error('Ungültiger Wurfkontext.');
  if (
    a.kind === 'roll' &&
    ((a.ruleNoteId !== null &&
      (typeof a.ruleNoteId !== 'string' || !a.ruleNoteId || a.ruleNoteId.length > 1000)) ||
      !['normal', 'advantage', 'disadvantage'].includes(a.mode) ||
      !Number.isSafeInteger(a.modifier) ||
      a.modifier < -1000 ||
      a.modifier > 1000)
  )
    throw new Error('Ungültiger d20-Probenauftrag.');
  if (a.kind === 'formula') {
    if (a.formulaKind !== undefined && !['attack', 'damage'].includes(a.formulaKind))
      throw new Error('Unbekannte Formelwurfart.');
    parseDiceFormula(a.formula);
  }
}

export function readSceneChecks(db: any, cam: string, sceneId: string): SceneChecks {
  readLiveScene(db, cam, sceneId);
  const revision =
      db
        .prepare('SELECT revision FROM scene_check_state WHERE campaign_id=? AND scene_id=?')
        .get(cam, sceneId)?.revision ?? 0,
    rows = db
      .prepare(
        'SELECT * FROM scene_check WHERE campaign_id=? AND scene_id=? ORDER BY ordinal DESC LIMIT 101',
      )
      .all(cam, sceneId);
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error('GM-Probenrevision ist beschädigt.');
  return {
    sceneId,
    revision,
    checks: rows.slice(0, 100).map(decoded),
    truncated: rows.length > 100,
  };
}

export function executeSceneCheck(
  db: any,
  command: SceneCheckCommand,
  guard: () => void,
): SceneChecks {
  return db
    .transaction(() => {
      checkCommand(command);
      guard();
      const fp = fingerprint(command),
        prior = db
          .prepare('SELECT * FROM scene_check_receipt WHERE command_id=?')
          .get(command.commandId);
      if (prior) {
        if (
          prior.campaign_id !== command.campaignId ||
          prior.fingerprint !== fp ||
          hash(prior.payload) !== prior.checksum
        )
          throw new Error('GM-Probenauftrag ist nicht verlässlich wiederholbar.');
        const saved = checked(JSON.parse(prior.payload)),
          row = db
            .prepare('SELECT * FROM scene_check WHERE campaign_id=? AND id=?')
            .get(command.campaignId, prior.check_id);
        if (!row || json(decoded(row)) !== json(saved))
          throw new Error('Bestätigte GM-Probe ist nicht mehr verfügbar.');
        return readSceneChecks(db, command.campaignId, command.sceneId);
      }
      const current = readSceneChecks(db, command.campaignId, command.sceneId);
      if (current.revision !== command.expectedRevision)
        throw new Error('Probenverlauf dieser Gruppe wurde geändert.');
      const scene = readLiveScene(db, command.campaignId, command.sceneId),
        a = command.action,
        ordinal = db
          .prepare(
            'SELECT coalesce(max(ordinal),0)+1 n FROM scene_check WHERE campaign_id=? AND scene_id=?',
          )
          .get(command.campaignId, command.sceneId).n;
      let check: SceneCheck;
      if (a.kind === 'formula') {
        const formula = parseDiceFormula(a.formula),
          rolls = Array.from({ length: formula.count }, () => randomInt(1, formula.sides + 1)),
          total = rolls.reduce((sum, roll) => sum + roll, 0) + formula.modifier;
        const core = { dc: a.dc, total, rollKind: 'formula', formulaKind: a.formulaKind, rolls };
        check = checked({
          id: randomUUID(),
          sceneId: command.sceneId,
          ordinal,
          label: a.label.trim(),
          ruleNoteId: null,
          ruleTitle: null,
          ruleSourceRevision: null,
          mode: 'normal',
          modifier: formula.modifier,
          ...core,
          outcome: checkOutcome(core),
          sceneInstantMs: scene.clock.instantMs,
          recordedAt: new Date().toISOString(),
          actor: a.actor,
          formula: formula.formula,
          sourceCreatureId: a.sourceCreatureId,
          sourceActionId: a.sourceActionId,
        });
      } else {
        let ruleTitle: string | null = null,
          ruleSourceRevision: number | null = null;
        if (a.ruleNoteId !== null) {
          const pin = db
            .prepare(
              'SELECT payload,checksum FROM scene_rule_pin WHERE campaign_id=? AND scene_id=? AND note_id=?',
            )
            .get(command.campaignId, command.sceneId, a.ruleNoteId);
          if (!pin || hash(pin.payload) !== pin.checksum)
            throw new Error('Gewählte Regel ist nicht mehr an diese Gruppe angeheftet.');
          const value = JSON.parse(pin.payload);
          if (
            !value ||
            value.noteId !== a.ruleNoteId ||
            typeof value.title !== 'string' ||
            !value.title ||
            !Number.isSafeInteger(value.sourceRevision) ||
            value.sourceRevision < 1
          )
            throw new Error('Angeheftete Regel ist beschädigt.');
          if (a.expectedRuleSourceRevision !== value.sourceRevision)
            throw new Error('Regelstand geändert. Aktualisieren und Regel erneut prüfen.');
          ruleTitle = value.title;
          ruleSourceRevision = value.sourceRevision;
        }
        const rolls = Array.from({ length: a.mode === 'normal' ? 1 : 2 }, () => randomInt(1, 21)),
          kept =
            a.mode === 'advantage'
              ? Math.max(...rolls)
              : a.mode === 'disadvantage'
                ? Math.min(...rolls)
                : rolls[0]!,
          total = kept + a.modifier;
        check = checked({
          id: randomUUID(),
          sceneId: command.sceneId,
          ordinal,
          label: a.label.trim(),
          ruleNoteId: a.ruleNoteId,
          ruleTitle,
          ruleSourceRevision,
          mode: a.mode,
          modifier: a.modifier,
          dc: a.dc,
          rolls,
          total,
          outcome: a.dc === null ? null : total >= a.dc ? 'success' : 'failure',
          sceneInstantMs: scene.clock.instantMs,
          recordedAt: new Date().toISOString(),
          rollKind: 'check',
          actor: a.actor,
          sourceCreatureId: a.sourceCreatureId,
          sourceActionId: a.sourceActionId,
        });
      }
      const payload = json(check);
      db.prepare('INSERT INTO scene_check VALUES(?,?,?,?,?,?)').run(
        command.campaignId,
        command.sceneId,
        check.id,
        ordinal,
        payload,
        hash(payload),
      );
      db.prepare('INSERT OR IGNORE INTO scene_check_state VALUES(?,?,0)').run(
        command.campaignId,
        command.sceneId,
      );
      db.prepare(
        'UPDATE scene_check_state SET revision=revision+1 WHERE campaign_id=? AND scene_id=?',
      ).run(command.campaignId, command.sceneId);
      db.prepare('INSERT INTO scene_check_receipt VALUES(?,?,?,?,?,?)').run(
        command.commandId,
        command.campaignId,
        fp,
        check.id,
        payload,
        hash(payload),
      );
      return readSceneChecks(db, command.campaignId, command.sceneId);
    })
    .immediate();
}

export function validateSceneChecks(db: any) {
  const tables = ['scene_check', 'scene_check_state', 'scene_check_receipt'].filter((name) =>
    db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name),
  );
  if (!tables.length) return;
  if (tables.length !== 3) throw new Error('GM-Probenverlauf ist unvollständig.');
  for (const row of db.prepare('SELECT * FROM scene_check').iterate()) {
    decoded(row);
    if (
      !db
        .prepare('SELECT 1 FROM scene_check_state WHERE campaign_id=? AND scene_id=?')
        .get(row.campaign_id, row.scene_id)
    )
      throw new Error('GM-Probe besitzt keinen Verlauf.');
  }
  for (const row of db.prepare('SELECT * FROM scene_check_receipt').iterate()) {
    if (hash(row.payload) !== row.checksum) throw new Error('GM-Probenbeleg ist beschädigt.');
    const value = checked(JSON.parse(row.payload)),
      saved = db
        .prepare('SELECT payload FROM scene_check WHERE campaign_id=? AND id=?')
        .get(row.campaign_id, row.check_id);
    if (value.id !== row.check_id || !saved || saved.payload !== row.payload)
      throw new Error('GM-Probenbeleg besitzt kein Ergebnis.');
  }
  for (const row of db
    .prepare('SELECT campaign_id,scene_id,revision FROM scene_check_state')
    .iterate()) {
    const sequence = db
      .prepare(
        'SELECT count(*) count,coalesce(max(ordinal),0) maximum FROM scene_check WHERE campaign_id=? AND scene_id=?',
      )
      .get(row.campaign_id, row.scene_id);
    if (
      !Number.isSafeInteger(row.revision) ||
      row.revision < 0 ||
      sequence.count !== row.revision ||
      sequence.maximum !== row.revision
    )
      throw new Error('GM-Probenrevision ist beschädigt.');
  }
}
