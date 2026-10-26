import { type SqliteDatabase, checkedQuery, checkedRow } from './sqlite-connection';
import { commandFingerprint, matchesReceipt } from './command-fingerprint';
import { createHash, randomUUID } from 'node:crypto';
import { type ManualPlan } from '../../features/planner/manual-planner';
import { worldNoteDocument } from '../../features/world/world-notes';
import { appendNoteExcerpt } from '../campaign/note-excerpt';
import {
  checkedPreparationDraft,
  preparationTarget,
  validatePreparation,
  type Note,
  type Preparation,
  type PreparationChange,
  type PreparationCommand,
  type PreparationDraft,
  type PreparationSelection,
} from '../campaign/preparation-contracts';
import { executeDrawing } from './drawing';
import { hasNoteTitle } from './key-note-capture';
import { assertNpcOutsideOpenCombat, syncOpenMaskHealth } from './mask-health';
import { noteMergeWork } from './note-merge';
import { noteSearchPreview } from './note-search-preview';
import { noteSearchQuery } from './note-search-query';
import { rememberSourceUnlink } from './note-source-history';
import { checkNoteThread } from './note-thread';
import { applySceneCreation } from './scene-desk';
import { cleanSessionVisits } from './session';
import {
  decodeLocation,
  decodePreparationDraft,
  preparationDraftTable,
  readStoredPlan,
} from './stored-records';
import { checkedWorldNoteRow } from './world-note-row';
const json = (value: unknown) => JSON.stringify(value);
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

interface PreparationWriteContext {
  readonly activeCampaignId: string | undefined;
  readonly graphPreviewOpen: boolean;
  guard(token: string, campaignId?: string): string;
  commitPreparation(command: PreparationCommand): void;
  executeSession(command: import('../campaign/session-contracts').SessionCommand): unknown;
}

export function commitPreparation(
  db: SqliteDatabase,
  command: PreparationCommand,
  context: PreparationWriteContext,
): void {
  if (typeof command.commandId !== 'string' || !command.commandId)
    throw new Error('Änderungskennung fehlt.');
  const change = validatePreparation(command.change),
    fingerprint = commandFingerprint(command);
  db.transaction(() => {
    const campaignId = context.guard(command.token, command.campaignId ?? context.activeCampaignId);
    const prior = checkedQuery(
      db,
      'SELECT fingerprint,campaign_id FROM receipt WHERE command_id=?',
      { fingerprint: 'text', campaign_id: 'text' },
    ).get(command.commandId);
    if (prior) {
      if (prior.campaign_id !== campaignId || !matchesReceipt(prior, command))
        throw new Error('Änderungskennung bereits anders verwendet.');
      return;
    }
    let targetId: string, revision: number;
    if (change.kind === 'note-merge') {
      if (context.graphPreviewOpen)
        throw new Error('Die offene Dungeonvorschau zuerst abschließen.');
      const work = noteMergeWork(db, campaignId, change.id, change.targetId),
        p = work.preview;
      if (
        work.source.revision !== change.expectedRevision ||
        work.target.revision !== change.expectedTargetRevision ||
        p.basis !== change.basis
      )
        throw new Error(
          'Zusammenführungskonflikt: Originale oder Verweise wurden geändert. Vorschau erneut prüfen.',
        );
      if (p.blockers.length) throw new Error(p.blockers.join(' '));
      let index = 0;
      const nested = (next: PreparationChange) =>
        context.commitPreparation({
          commandId: command.commandId + '|merge:' + index++,
          campaignId,
          token: command.token,
          change: next,
        });
      nested({
        kind: 'note',
        expectedRevision: work.target.revision,
        note: {
          ...work.target,
          readAloud: work.remap(change.readAloud),
          gmNotes: work.remap(change.gmNotes),
          relations: work.targetRelations,
        },
      });
      for (const note of work.notes)
        nested({ kind: 'note', expectedRevision: note.revision, note });
      for (const location of work.locations) nested({ kind: 'location', ...location });
      for (const { key, refs } of work.keys)
        executeDrawing(
          db,
          {
            commandId: command.commandId + '|merge:key:' + key.id,
            campaignId,
            token: command.token,
            action: {
              kind: 'key-content',
              expectedRevision: key.revision,
              content: { ...key, references: refs },
            },
          },
          () => {
            context.guard(command.token, campaignId);
          },
        );
      for (const v of work.visits)
        context.executeSession({
          commandId: command.commandId + '|merge:visit:' + v.detail.visitId,
          campaignId,
          token: command.token,
          action: {
            kind: 'visit',
            planId: v.planId,
            expectedRevision: v.detail.revision,
            detail: {
              ...v.detail,
              noteIds: [
                ...new Set(v.detail.noteIds.map((id) => (id === change.id ? change.targetId : id))),
              ],
            },
          },
        });
      nested({
        kind: 'note-trash',
        id: change.id,
        expectedRevision: work.source.revision,
        trashed: true,
      });
      targetId = change.id;
      revision = work.source.revision + 1;
    } else if (change.kind === 'note') {
      targetId = change.note.id;
      const old = checkedQuery(db, 'SELECT * FROM world_note WHERE campaign_id=? AND id=?', {
        id: 'text',
        revision: 'integer',
        trashed: 'integer',
        payload: 'text',
        checksum: 'text',
      }).get(campaignId, targetId);
      if (
        change.expectedRevision === null
          ? !!old
          : !old || old.revision !== change.expectedRevision || old.trashed
      )
        throw new Error('Notizkonflikt: Der gespeicherte Stand hat sich geändert.');
      const oldNote = old
        ? checkedWorldNoteRow(old, 'Beschädigte Notiz darf nicht überschrieben werden.')
        : null;
      const source = change.excerpt;
      let sourceNote: Note | null = null;
      if (source) {
        const row = checkedQuery(db, 'SELECT * FROM world_note WHERE campaign_id=? AND id=?', {
          id: 'text',
          revision: 'integer',
          trashed: 'integer',
          payload: 'text',
          checksum: 'text',
        }).get(campaignId, source.id);
        if (!row || row.trashed || row.revision !== source.revision)
          throw new Error('Auszugskonflikt: Die Quelle wurde geändert oder ist nicht verfügbar.');
        sourceNote = checkedWorldNoteRow(row, 'Beschädigte Quelle bleibt unverändert.');
        const selected = sourceNote[source.field].slice(source.start, source.end),
          other = source.field === 'gmNotes' ? 'readAloud' : 'gmNotes';
        if (source.end > sourceNote[source.field].length || !selected.trim())
          throw new Error('Der Auszug stimmt nicht mit der markierten Quelle überein.');
        if (oldNote) {
          if (
            db
              .prepare(
                "SELECT 1 FROM preparation_draft WHERE campaign_id=? AND kind='note' AND target_id=?",
              )
              .get(campaignId, oldNote.id)
          )
            throw new Error(
              'Dieses Original hat einen offenen Arbeitsentwurf. Erst im Originaleditor aufklären.',
            );
          const expected = worldNoteDocument(
            appendNoteExcerpt(oldNote, sourceNote, source.field, selected),
          );
          if (json(expected) !== json(change.note))
            throw new Error(
              'Die Ergänzung stimmt nicht mit Original und markierter Quelle überein.',
            );
        } else {
          if (
            change.note[source.field] !== selected ||
            change.note[other] !== '' ||
            change.note.relations.length !== 1 ||
            change.note.relations[0]?.targetId !== source.id ||
            change.note.relations[0]?.label !== 'Quelle' ||
            change.note.relations[0]?.familyKind !== undefined
          )
            throw new Error('Der Auszug stimmt nicht mit der markierten Quelle überein.');
          if (!source.allowSameTitle && hasNoteTitle(db, campaignId, change.note.title))
            throw new Error(
              'Diesen Namen gibt es bereits. Vorhandene Notiz wählen oder ausdrücklich eigenständig neu anlegen.',
            );
        }
      }
      if (oldNote && oldNote.kind !== change.note.kind)
        throw new Error('Die Notizart bleibt an ihrer Identität gebunden.');
      if (
        oldNote?.relations.some(
          (relation) =>
            relation.familyKind &&
            !change.note.relations.some(
              (next) =>
                next.targetId === relation.targetId &&
                next.label === relation.label &&
                next.familyKind === relation.familyKind,
            ),
        )
      )
        throw new Error('Familienbeziehungen werden nur als vollständiges Paar geändert.');
      for (const relation of change.note.relations) {
        const target = checkedQuery(
          db,
          'SELECT trashed FROM world_note WHERE campaign_id=? AND id=?',
          { trashed: 'integer' },
        ).get(campaignId, relation.targetId);
        const retained = oldNote?.relations.some(
          (r) =>
            r.targetId === relation.targetId &&
            r.label === relation.label &&
            r.familyKind === relation.familyKind,
        );
        if (relation.familyKind && !retained)
          throw new Error('Familienbeziehungen werden atomar im Zusammenhangsplan angelegt.');
        if (!target || (target.trashed && !retained))
          throw new Error('Beziehung zeigt nicht auf eine verfügbare Notiz.');
      }
      revision = (old?.revision ?? 0) + 1;
      const note: Note = { ...change.note, revision },
        payload = json(note);
      rememberSourceUnlink(db, campaignId, command.commandId, oldNote, note);
      db.prepare(
        'INSERT INTO world_note VALUES(?,?,?,0,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
      ).run(campaignId, targetId, revision, payload, hash(payload));
      db.prepare('DELETE FROM note_search WHERE campaign_id=? AND note_id=?').run(
        campaignId,
        targetId,
      );
      db.prepare('INSERT INTO note_search(campaign_id,note_id,title,body) VALUES(?,?,?,?)').run(
        campaignId,
        targetId,
        note.title,
        note.readAloud + '\n' + note.gmNotes,
      );
      if (
        sourceNote &&
        !sourceNote.relations.some((r) => r.targetId === note.id && r.label === 'Auszug')
      ) {
        // Reuse the canonical writer inside this transaction: index, checksum,
        // receipt and both directions either all publish or all roll back.
        context.commitPreparation({
          commandId: command.commandId + '|excerpt-source',
          campaignId,
          token: command.token,
          change: {
            kind: 'note',
            expectedRevision: sourceNote.revision,
            note: {
              ...sourceNote,
              relations: [...sourceNote.relations, { targetId: note.id, label: 'Auszug' }],
            },
          },
        });
      }
      if (oldNote?.kind === 'npc' && oldNote.title !== note.title)
        syncOpenMaskHealth(
          db,
          campaignId,
          undefined,
          new Map([[targetId, { before: oldNote.title, after: note.title }]]),
        );
    } else if (change.kind === 'note-trash') {
      targetId = change.id;
      const old = checkedQuery(db, 'SELECT * FROM world_note WHERE campaign_id=? AND id=?', {
        id: 'text',
        revision: 'integer',
        trashed: 'integer',
        payload: 'text',
        checksum: 'text',
      }).get(campaignId, targetId);
      if (!old || old.revision !== change.expectedRevision || !!old.trashed === change.trashed)
        throw new Error('Papierkorbkonflikt: Notizstand hat sich geändert.');
      const note = checkedWorldNoteRow(old, 'Beschädigte Notiz bleibt gesperrt.');
      revision = old.revision + 1;
      if (
        change.trashed &&
        note.kind === 'npc' &&
        db
          .prepare(
            `SELECT 1 FROM city_unit WHERE campaign_id=? AND (EXISTS(SELECT 1 FROM json_each(city_unit.payload,'$.residentIds') WHERE value=?) OR EXISTS(SELECT 1 FROM json_each(city_unit.payload,'$.workerIds') WHERE value=?)) LIMIT 1`,
          )
          .get(campaignId, targetId, targetId)
      )
        throw new Error(
          'NPC ist noch als Stadtbewohner oder Arbeitsplatzbindung verwendet. Bindung zuerst am Haus lösen.',
        );
      if (change.trashed && note.kind === 'npc')
        assertNpcOutsideOpenCombat(db, campaignId, targetId);
      const payload = json({ ...note, revision });
      db.prepare(
        'UPDATE world_note SET trashed=?,revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
      ).run(Number(change.trashed), revision, payload, hash(payload), campaignId, targetId);
    } else if (change.kind === 'location') {
      targetId = change.document.id;
      const old = checkedQuery(db, 'SELECT * FROM location WHERE campaign_id=? AND id=?', {
        id: 'text',
        revision: 'integer',
        trashed: 'integer',
        payload: 'text',
        checksum: 'text',
      }).get(campaignId, targetId);
      if (
        change.expectedRevision === null
          ? !!old
          : !old || old.revision !== change.expectedRevision || old.trashed
      )
        throw new Error('Ortskonflikt: Der gespeicherte Stand hat sich geändert.');
      if (old) decodeLocation(old, 'Beschädigter Ort darf nicht überschrieben werden.');
      for (const map of change.document.detailMaps) {
        if (
          map.kind !== 'dungeon' ||
          !db
            .prepare('SELECT 1 FROM scope WHERE campaign_id=? AND id=?')
            .get(campaignId, map.documentId)
        )
          throw new Error('Die gewählte Karte gehört nicht zu dieser Kampagne.');
        const bound = checkedQuery(
          db,
          'SELECT location_id FROM location_map WHERE campaign_id=? AND scope_id=?',
          { location_id: 'text' },
        ).get(campaignId, map.documentId);
        if (bound && bound.location_id !== targetId)
          throw new Error(
            'Diese Dungeonzeichnung gehört bereits zu einem anderen Ort. Bindung zuerst dort ausdrücklich lösen.',
          );
      }
      revision = (old?.revision ?? 0) + 1;
      const payload = json(change.document);
      db.prepare(
        'INSERT INTO location VALUES(?,?,?,0,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
      ).run(campaignId, targetId, revision, payload, hash(payload));
      db.prepare('DELETE FROM location_map WHERE campaign_id=? AND location_id=?').run(
        campaignId,
        targetId,
      );
      for (const map of change.document.detailMaps)
        db.prepare('INSERT INTO location_map VALUES(?,?,?)').run(
          campaignId,
          map.documentId,
          targetId,
        );
    } else if (change.kind === 'location-trash') {
      targetId = change.id;
      const old = checkedQuery(db, 'SELECT * FROM location WHERE campaign_id=? AND id=?', {
        id: 'text',
        revision: 'integer',
        trashed: 'integer',
        payload: 'text',
        checksum: 'text',
      }).get(campaignId, targetId);
      if (!old || old.revision !== change.expectedRevision || !!old.trashed === change.trashed)
        throw new Error('Orts-Papierkorbkonflikt: Stand hat sich geändert.');
      decodeLocation(old, 'Beschädigter Ort bleibt gesperrt.');
      revision = old.revision + 1;
      db.prepare('UPDATE location SET trashed=?,revision=? WHERE campaign_id=? AND id=?').run(
        Number(change.trashed),
        revision,
        campaignId,
        targetId,
      );
    } else {
      targetId = change.plan.id;
      const old = checkedQuery(db, 'SELECT revision FROM plan WHERE campaign_id=? AND id=?', {
        revision: 'integer',
      }).get(campaignId, targetId);
      if (
        change.expectedRevision === null ? !!old : !old || old.revision !== change.expectedRevision
      )
        throw new Error('Plankonflikt: Der gespeicherte Stand hat sich geändert.');
      const beforePlan = old ? readStoredPlan(db, campaignId, targetId) : null;
      const beforeVisits = new Map(beforePlan?.scenes.map((scene) => [scene.id, scene]));
      const nextIds = new Set<string>(change.plan.scenes.map((scene) => scene.id));
      const locationState = checkedQuery(
        db,
        'SELECT trashed FROM location WHERE campaign_id=? AND id=?',
        { trashed: 'integer' },
      );
      for (const scene of change.plan.scenes)
        if (scene.locationId !== null) {
          const location = locationState.get(campaignId, scene.locationId);
          const retained = beforeVisits.get(scene.id)?.locationId === scene.locationId;
          if (!location || (location.trashed && !retained))
            throw new Error(
              'Szenenort ist nicht verfügbar. Wähle einen aktuellen Ort oder lasse die Szene ortlos.',
            );
        }
      revision = (old?.revision ?? 0) + 1;
      db.prepare(
        'INSERT INTO plan VALUES(?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,name=excluded.name',
      ).run(campaignId, targetId, revision, change.plan.name);
      const existing = checkedQuery(
        db,
        'SELECT * FROM planned_visit WHERE campaign_id=? AND plan_id=?',
        { id: 'text', ordinal: 'integer', payload: 'text', checksum: 'text' },
      ).all(campaignId, targetId);
      const existingVisits = new Map(existing.map((visit) => [visit.id, visit]));
      for (const visit of existing)
        if (!nextIds.has(visit.id))
          db.prepare('DELETE FROM planned_visit WHERE campaign_id=? AND id=?').run(
            campaignId,
            visit.id,
          );
      change.plan.scenes.forEach((scene, ordinal) => {
        const foreign = checkedQuery(
          db,
          'SELECT plan_id FROM planned_visit WHERE campaign_id=? AND id=?',
          { plan_id: 'text' },
        ).get(campaignId, scene.id);
        if (foreign && foreign.plan_id !== targetId)
          throw new Error('Szenenidentität gehört zu einem anderen Plan.');
        const payload = json(scene),
          before = existingVisits.get(scene.id);
        if (!before || before.ordinal !== ordinal || before.payload !== payload)
          db.prepare(
            'INSERT INTO planned_visit VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET ordinal=excluded.ordinal,payload=excluded.payload,checksum=excluded.checksum',
          ).run(campaignId, targetId, scene.id, ordinal, payload, hash(payload));
      });
    }
    if (change.kind === 'plan')
      cleanSessionVisits(
        db,
        campaignId,
        change.plan.id,
        change.plan.scenes.map((s) => s.id),
      );
    if (change.kind === 'plan' && change.opening) {
      const o = change.opening;
      if (o.noteThread !== undefined) {
        checkNoteThread(db, campaignId, o.noteThread);
        const ids = [
          ...o.noteThread.entries.map((e) => e.id),
          ...(o.noteThread.includeRoot ? [o.noteThread.rootId] : []),
        ];
        if (ids.some((id) => !o.noteIds.includes(id)))
          throw new Error('Notizmappenauswahl passt nicht zum neuen Besuch.');
      }
      context.executeSession({
        commandId: command.commandId + '|opening',
        campaignId,
        token: command.token,
        action: {
          kind: 'visit',
          planId: change.plan.id,
          expectedRevision: 0,
          detail: {
            visitId: o.visitId,
            revision: 0,
            readAloud: o.readAloud,
            noteIds: o.noteIds,
            groupIds: [],
            reward: null,
          },
        },
      });
    }
    applySceneCreation(db, campaignId, command);
    db.prepare('INSERT INTO receipt VALUES(?,?,?,?,?)').run(
      command.commandId,
      fingerprint,
      campaignId,
      targetId,
      revision,
    );
    const target = preparationTarget(command.change),
      savedDraft = db
        .prepare('SELECT * FROM preparation_draft WHERE campaign_id=? AND kind=? AND target_id=?')
        .get(campaignId, target.kind, target.id);
    if (savedDraft && decodePreparationDraft(savedDraft).writeId === command.draftWriteId)
      db.prepare(
        'DELETE FROM preparation_draft WHERE campaign_id=? AND kind=? AND target_id=?',
      ).run(campaignId, target.kind, target.id);
  }).immediate();
}

const noteTitleOrder = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
interface KeepPreparationDraftsContext {
  guard: (token: string, campaignId?: string | undefined) => string;
}
export function storedKeepPreparationDrafts(
  db: SqliteDatabase,
  context: KeepPreparationDraftsContext,
  token: string,
  drafts: PreparationDraft[],
): void {
  if (!Array.isArray(drafts)) throw new Error('Ungültige Entwurfsliste.');
  db.transaction(() => {
    const campaignId = context.guard(token),
      targets = new Set<string>();
    for (const value of drafts) {
      const draft = checkedPreparationDraft(value),
        target = preparationTarget(draft.change),
        table = preparationDraftTable(target.kind);
      const key = json(target);
      if (targets.has(key)) throw new Error('Doppeltes Entwurfsziel.');
      targets.add(key);
      if (
        !db
          .prepare(`SELECT 1 FROM ${table} WHERE campaign_id=? AND id=?`)
          .get(campaignId, target.id)
      )
        throw new Error('Entwurfsziel nicht vorhanden.');
      const old = db
        .prepare('SELECT * FROM preparation_draft WHERE campaign_id=? AND kind=? AND target_id=?')
        .get(campaignId, target.kind, target.id);
      if (old) {
        const existing = decodePreparationDraft(old);
        if (
          draft.change.kind === 'note' &&
          draft.change.excerpt &&
          existing.writeId !== draft.writeId &&
          (!draft.failedCommand ||
            existing.failedCommand?.commandId !== draft.failedCommand.commandId)
        )
          throw new Error('Ein anderer Arbeitsentwurf dieses Originals bleibt erhalten.');
        if (existing.writeId === draft.writeId && json(existing) !== json(draft))
          throw new Error('Entwurfskennung bereits anders verwendet.');
      }
      const payload = json(draft),
        checksum = hash(payload);
      decodePreparationDraft({
        campaign_id: campaignId,
        kind: target.kind,
        target_id: target.id,
        payload,
        checksum,
      });
      db.prepare(
        'INSERT INTO preparation_draft(campaign_id,kind,target_id,payload,checksum) VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,kind,target_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
      ).run(campaignId, target.kind, target.id, payload, checksum);
    }
  }).immediate();
}
interface PreparationContext {
  guard: (token: string, campaignId?: string | undefined) => string;
  readPlan: (
    campaignId: string,
    id: string,
  ) => import('./../../features/planner/manual-planner').ManualPlan;
}
export function storedPreparation(
  db: SqliteDatabase,
  context: PreparationContext,
  token: string,
  search = '',
): import('./../campaign/preparation-contracts').Preparation {
  if (typeof search !== 'string' || search.length > 1000) throw new Error('Ungültige Suchanfrage.');
  return db.transaction(() => {
    const campaignId = context.guard(token),
      problems: string[] = [];
    const nonce = randomUUID(),
      marks = { start: `⟦${nonce}:hit⟧`, end: `⟦${nonce}:end⟧`, clip: `⟦${nonce}:clip⟧` };
    const rows = search.trim()
      ? db
          .prepare(
            'SELECT n.*, snippet(note_search,3,?,?,?,24) AS search_preview FROM world_note n JOIN note_search s ON s.campaign_id=n.campaign_id AND s.note_id=n.id WHERE n.campaign_id=? AND note_search MATCH ? ORDER BY n.id',
          )
          .all(marks.start, marks.end, marks.clip, campaignId, noteSearchQuery(search))
      : db.prepare('SELECT * FROM world_note WHERE campaign_id=? ORDER BY id').all(campaignId);
    const notes: Preparation['notes'] = [];
    for (const raw of rows) {
      try {
        const row = checkedRow(raw, {
          id: 'text',
          revision: 'integer',
          trashed: 'integer',
          payload: 'text',
          checksum: 'text',
        });
        const note = checkedWorldNoteRow(row),
          searchPreview = noteSearchPreview(raw.search_preview, note, marks);
        notes.push({ note, trashed: !!row.trashed, ...(searchPreview ? { searchPreview } : {}) });
      } catch {
        problems.push(`Notiz ${raw.id} ist gesperrt. Originalbytes bleiben erhalten.`);
      }
    }
    notes.sort(
      (a, b) =>
        noteTitleOrder.compare(a.note.title, b.note.title) || a.note.id.localeCompare(b.note.id),
    );
    const plans: ManualPlan[] = [];
    for (const row of db
      .prepare('SELECT * FROM plan WHERE campaign_id=? ORDER BY name,id')
      .all(campaignId)) {
      try {
        plans.push(context.readPlan(campaignId, checkedRow(row, { id: 'text' }).id));
      } catch {
        problems.push(`Plan ${row.id} ist gesperrt. Originalbytes bleiben erhalten.`);
      }
    }
    const locations: Preparation['locations'] = [];
    for (const row of db
      .prepare('SELECT * FROM location WHERE campaign_id=? ORDER BY id')
      .all(campaignId)) {
      try {
        locations.push({
          document: decodeLocation(row),
          revision: checkedRow(row, { revision: 'integer' }).revision,
          trashed: !!checkedRow(row, { trashed: 'integer' }).trashed,
        });
      } catch {
        problems.push(`Ort ${row.id} ist gesperrt. Originalbytes bleiben erhalten.`);
      }
    }
    let selection: PreparationSelection = { noteId: null, planId: null, sceneId: null };
    const saved = checkedQuery(db, 'SELECT value FROM settings WHERE key=?', { value: 'text' }).get(
      `preparation:${campaignId}`,
    );
    if (saved) {
      try {
        selection = JSON.parse(saved.value);
      } catch {
        problems.push('Auswahlcheckpoint ist beschädigt.');
      }
    }
    return {
      notes,
      plans,
      locations,
      maps: checkedQuery(db, 'SELECT id,name FROM scope WHERE campaign_id=? ORDER BY name,id', {
        id: 'text',
        name: 'text',
      }).all(campaignId),
      problems,
      selection,
    };
  })();
}
interface SelectPreparationContext {
  guard: (token: string, campaignId?: string | undefined) => string;
}
export function storedSelectPreparation(
  db: SqliteDatabase,
  context: SelectPreparationContext,
  token: string,
  selection: PreparationSelection,
): void {
  db.transaction(() => {
    const campaignId = context.guard(token);
    if (
      selection.noteId !== null &&
      !db
        .prepare('SELECT 1 FROM world_note WHERE campaign_id=? AND id=?')
        .get(campaignId, selection.noteId)
    )
      throw new Error('Notizauswahl ist nicht verfügbar.');
    if (
      selection.planId !== null &&
      !db
        .prepare('SELECT 1 FROM plan WHERE campaign_id=? AND id=?')
        .get(campaignId, selection.planId)
    )
      throw new Error('Planauswahl ist nicht verfügbar.');
    if (
      selection.sceneId !== null &&
      !db
        .prepare('SELECT 1 FROM planned_visit WHERE campaign_id=? AND plan_id=? AND id=?')
        .get(campaignId, selection.planId, selection.sceneId)
    )
      throw new Error('Szenenauswahl gehört nicht zu diesem Plan.');
    if (
      selection.locationId != null &&
      !db
        .prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?')
        .get(campaignId, selection.locationId)
    )
      throw new Error('Ortsauswahl gehört nicht zur Kampagne.');
    db.prepare(
      'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    ).run(`preparation:${campaignId}`, json(selection));
  }).immediate();
}
interface ReconcilePreparationPlanContext {
  guard: (token: string, campaignId?: string | undefined) => string;
  readonly activeCampaignId: string | undefined;
  readPlan: (
    campaignId: string,
    id: string,
  ) => import('./../../features/planner/manual-planner').ManualPlan;
}
export function storedReconcilePreparationPlan(
  db: SqliteDatabase,
  context: ReconcilePreparationPlanContext,
  command: PreparationCommand,
  token = command.token,
): import('./../campaign/preparation-contracts').PlanReconciliation {
  if (command.change.kind !== 'plan')
    throw new Error('Gezielte Planklärung benötigt einen Spielabendplan.');
  const change = command.change;
  return db.transaction((): import('../campaign/preparation-contracts').PlanReconciliation => {
    const cam = context.guard(token, command.campaignId ?? context.activeCampaignId);
    const prior = checkedQuery(
      db,
      'SELECT fingerprint,campaign_id,revision FROM receipt WHERE command_id=?',
      { fingerprint: 'text', campaign_id: 'text', revision: 'integer' },
    ).get(command.commandId);
    if (prior && (prior.campaign_id !== cam || !matchesReceipt(prior, command)))
      throw new Error('Änderungskennung bereits anders verwendet.');
    if (!prior && command.campaignId === undefined && command.token !== token)
      throw new Error('Der alte Auftrag besitzt keine eindeutige Kampagnenbindung.');
    const row = checkedQuery(db, 'SELECT revision FROM plan WHERE campaign_id=? AND id=?', {
      revision: 'integer',
    }).get(cam, change.plan.id);
    const unchanged =
      change.expectedRevision === null ? !row : row?.revision === change.expectedRevision;
    let plan: ManualPlan | null = null;
    if (row)
      try {
        plan = context.readPlan(cam, change.plan.id);
      } catch {
        /* Keep unreadable original bytes and the unresolved draft. */
      }
    return {
      outcome: prior ? 'applied' : unchanged ? 'not-applied' : 'conflict',
      targetChanged: (prior ? row?.revision !== prior.revision : !unchanged) || (!!row && !plan),
      plan,
    };
  })();
}
