import { createHash } from 'node:crypto';
import { campaignLocalId } from '../../features/campaign/campaign-contracts';
import { worldNoteDocument } from '../../features/world/world-notes';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { readDungeonKeys } from './dungeon-key';
import { readSession } from './session-read';
import { documentReferences, remapTextReferences } from '../campaign/text-references';
import type { NoteMergePreview } from '../campaign/note-merge-contracts';
import type { Note } from '../campaign/note-data';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const decoded = (row: any) => {
  if (!row || hash(row.payload) !== row.checksum)
    throw new Error('Eine Quelle der Zusammenführung fehlt oder ist beschädigt.');
  return JSON.parse(row.payload);
};
const dedupe = <T>(values: T[], key: (v: T) => string) => {
  const seen = new Set<string>();
  return values.filter((v) => {
    const k = key(v);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** Current preparation references only. Historical records keep their original identity. */
export function noteMergeWork(db: any, cam: string, sourceId: string, targetId: string) {
  if (
    typeof sourceId !== 'string' ||
    typeof targetId !== 'string' ||
    !sourceId ||
    !targetId ||
    sourceId === targetId ||
    sourceId.length > 1000 ||
    targetId.length > 1000
  )
    throw new Error('Zwei verschiedene NSC-Notizen wählen.');
  const notes = (
    db.prepare('SELECT * FROM world_note WHERE campaign_id=? ORDER BY id').all(cam) as any[]
  ).map((row) => {
    const note = worldNoteDocument(decoded(row));
    if (note.id !== row.id || note.revision !== row.revision)
      throw new Error('Notizidentität der Zusammenführung ist widersprüchlich.');
    return { row, note };
  });
  const source = notes.find((n) => n.note.id === sourceId),
    target = notes.find((n) => n.note.id === targetId);
  if (
    !source ||
    !target ||
    source.row.trashed ||
    target.row.trashed ||
    source.note.kind !== 'npc' ||
    target.note.kind !== 'npc'
  )
    throw new Error('Zwei verfügbare NSC-Notizen wählen.');
  const blockers: string[] = [];
  // A note merge must not silently retire a distinct running actor, schedule or household.
  if (db.prepare('SELECT 1 FROM world_actor WHERE campaign_id=? AND id=?').get(cam, sourceId))
    blockers.push(
      'Die Quellnotiz gehört zu einer Figur mit Spielwerten. Diese Figurenidentität zuerst getrennt klären.',
    );
  if (
    db.prepare('SELECT 1 FROM npc_record WHERE campaign_id=? AND id=?').get(cam, sourceId) ||
    db.prepare('SELECT 1 FROM npc_position WHERE campaign_id=? AND actor_id=?').get(cam, sourceId)
  )
    blockers.push(
      'Die Quellnotiz besitzt ein eigenes NSC-Profil oder einen Standort. Diese Zuordnung zuerst getrennt klären.',
    );
  if (
    db
      .prepare(
        "SELECT 1 FROM city_unit WHERE campaign_id=? AND (EXISTS(SELECT 1 FROM json_each(city_unit.payload,'$.residentIds') WHERE value=?) OR EXISTS(SELECT 1 FROM json_each(city_unit.payload,'$.workerIds') WHERE value=?)) LIMIT 1",
      )
      .get(cam, sourceId, sourceId)
  )
    blockers.push(
      'Die Quellnotiz ist noch als Bewohner oder Arbeitsplatz gebunden. Diese Zuordnung zuerst am Gebäude klären.',
    );
  if (source.note.creatureId && source.note.creatureId !== target.note.creatureId)
    blockers.push(
      'Die Quellnotiz besitzt eine andere Kreaturreferenz. Diese Zuordnung zuerst klären.',
    );
  if (
    notes.some((n) =>
      n.note.id === sourceId
        ? n.note.relations.some((r) => r.familyKind)
        : n.note.relations.some((r) => r.targetId === sourceId && r.familyKind),
    )
  )
    blockers.push(
      'Die Quellnotiz hat typisierte Familienbeziehungen. Diese Paare zuerst im Zusammenhangsplan klären.',
    );
  if (
    db
      .prepare(
        "SELECT 1 FROM preparation_draft WHERE campaign_id=? AND kind='note' AND target_id IN (?,?) LIMIT 1",
      )
      .get(cam, sourceId, targetId) ||
    db
      .prepare('SELECT 1 FROM npc_draft WHERE campaign_id=? AND id IN (?,?) LIMIT 1')
      .get(cam, sourceId, targetId)
  )
    blockers.push(
      'Zu einer der Notizen liegt noch eine offene Eingabe vor. Diese zuerst öffnen und abschließen.',
    );

  const remap = (text: string) =>
    remapTextReferences(text, (ref) =>
      ref.kind === 'note' && ref.id === sourceId ? targetId : ref.id,
    );
  const refers = (doc: any) =>
    documentReferences(doc, Number.MAX_SAFE_INTEGER).some(
      (r) => r.ref.kind === 'note' && r.ref.id === sourceId,
    );
  const relations = (list: Note['relations'], owner: string) =>
    dedupe(
      list
        .map((r) => ({
          ...r,
          targetId: r.targetId === sourceId ? campaignLocalId(targetId) : r.targetId,
        }))
        .filter((r) => r.targetId !== owner),
      (r) => JSON.stringify([r.targetId, r.label, r.familyKind]),
    );
  const noteOwners = notes.filter(
    (n) =>
      !n.row.trashed &&
      n.note.id !== sourceId &&
      (refers(n.note) || n.note.relations.some((r) => r.targetId === sourceId)),
  );
  const keys = readDungeonKeys(db, cam)
    .filter((k) => k.references.some((r) => r.kind === 'npc' && r.id === sourceId))
    .map((key) => ({
      key,
      refs: dedupe(
        key.references.map((r) =>
          r.kind === 'npc' && r.id === sourceId
            ? { ...r, id: targetId, label: target.note.title }
            : r,
        ),
        (r) => JSON.stringify([r.kind, r.id]),
      ),
    }));
  const locations = (
    db.prepare('SELECT * FROM location WHERE campaign_id=? ORDER BY id').all(cam) as any[]
  )
    .filter((row) => !row.trashed)
    .map((row) => {
      const document = checkedLocationDocument(decoded(row));
      if (document.id !== row.id)
        throw new Error('Ortsidentität der Zusammenführung ist widersprüchlich.');
      return { row, document };
    })
    .filter((n) => refers(n.document));
  const visits = (
    db.prepare('SELECT id FROM plan WHERE campaign_id=? ORDER BY id').all(cam) as { id: string }[]
  ).flatMap(({ id }) => {
    const session = readSession(db, cam, id);
    return session.visits
      .filter((v) => v.noteIds.includes(sourceId))
      .map((detail) => ({
        planId: id,
        planName: session.plan.name,
        title: session.plan.scenes.find((s) => s.id === detail.visitId)?.title ?? '',
        detail,
      }));
  });
  for (const n of noteOwners)
    if (
      db
        .prepare(
          "SELECT 1 FROM preparation_draft WHERE campaign_id=? AND kind='note' AND target_id=?",
        )
        .get(cam, n.note.id)
    ) {
      blockers.push('Eine verweisende Notiz hat noch eine offene Eingabe: ' + n.note.title);
      break;
    }
  for (const n of locations)
    if (
      db
        .prepare(
          "SELECT 1 FROM preparation_draft WHERE campaign_id=? AND kind='location' AND target_id=?",
        )
        .get(cam, n.document.id)
    ) {
      blockers.push('Ein verweisender Ort hat noch eine offene Eingabe: ' + n.document.name);
      break;
    }
  for (const r of source.note.relations)
    if (
      r.targetId !== targetId &&
      r.targetId !== sourceId &&
      notes.find((n) => n.note.id === r.targetId)?.row.trashed &&
      !target.note.relations.some(
        (t) => t.targetId === r.targetId && t.label === r.label && t.familyKind === r.familyKind,
      )
    ) {
      blockers.push(
        'Eine Beziehung der Quelle zeigt in den Papierkorb. Diese zuerst an der Quelle klären.',
      );
      break;
    }
  const uses: NoteMergePreview['uses'] = [
    ...keys.map((k) => ({ kind: 'key' as const, id: k.key.id, title: k.key.name || 'Raum-Key' })),
    ...visits.map((v) => ({
      kind: 'visit' as const,
      id: v.detail.visitId,
      title: v.planName + ' · ' + v.title,
    })),
    ...noteOwners.map((n) => ({ kind: 'note' as const, id: n.note.id, title: n.note.title })),
    ...locations.map((n) => ({
      kind: 'location' as const,
      id: n.document.id,
      title: n.document.name,
    })),
  ];
  const basis = hash(
    JSON.stringify({
      source: source.row,
      target: target.row,
      notes: noteOwners.map((n) => n.row),
      keys: keys.map((k) => k.key),
      locations: locations.map((n) => n.row),
      visits,
      blockers,
    }),
  );
  const preview: NoteMergePreview = {
    source: source.note,
    target: target.note,
    basis,
    uses,
    blockers,
  };
  return {
    preview,
    source: source.note,
    target: target.note,
    keys,
    visits,
    notes: noteOwners
      .filter((n) => n.note.id !== targetId)
      .map((n) => ({
        ...n.note,
        readAloud: remap(n.note.readAloud),
        gmNotes: remap(n.note.gmNotes),
        relations: relations(n.note.relations, n.note.id),
      })),
    locations: locations.map((n) => ({
      expectedRevision: n.row.revision,
      document: {
        ...n.document,
        sections: n.document.sections.map((s) => ({ ...s, markdown: remap(s.markdown) })),
      },
    })),
    targetRelations: relations([...target.note.relations, ...source.note.relations], targetId),
    remap,
  };
}
