import type { Note } from './preparation-contracts';
import { documentReferences, textReferences } from './text-references';

/** Canonical direct-source order: shared by storage cursors and reader restoration. */
export function noteThreadMembers(root: Note) {
  const ids = new Map<string, string[]>(),
    add = (id: string, label: string) => {
      if (id === root.id) return;
      const labels = ids.get(id) ?? [];
      if (!labels.includes(label)) labels.push(label);
      ids.set(id, labels);
    };
  for (const r of root.relations) add(r.targetId, r.label);
  for (const r of documentReferences(root, Number.MAX_SAFE_INTEGER))
    if (r.ref.kind === 'note') add(r.ref.id, 'Textverweis: ' + r.label);
  return ids;
}

export interface NoteSourceLinks {
  relationships: string[];
  readAloud: number;
  gmNotes: number;
  family: boolean;
}
/** One reading pass for all source-card previews, independent of page size. */
export function noteSourceLinks(root: Note) {
  const sources = new Map<string, NoteSourceLinks>();
  const source = (id: string) => {
    let value = sources.get(id);
    if (!value) {
      value = { relationships: [], readAloud: 0, gmNotes: 0, family: false };
      sources.set(id, value);
    }
    return value;
  };
  for (const relation of root.relations) {
    const value = source(relation.targetId);
    value.relationships.push(relation.label);
    value.family ||= !!relation.familyKind;
  }
  for (const field of ['readAloud', 'gmNotes'] as const)
    for (const link of textReferences(root[field], Number.MAX_SAFE_INTEGER))
      if (link.ref.kind === 'note') source(link.ref.id)[field]++;
  return sources;
}

/** Unlink one source from this document, retaining its written names and literal code. */
export function detachNoteSource(root: Note, id: string) {
  if (root.relations.some((r) => r.targetId === id && r.familyKind))
    throw Error(
      'Familienbeziehungen werden unter „Zusammenhänge“ als vollständiges Paar geändert.',
    );
  const unlink = (text: string) => {
    let cursor = 0,
      value = '',
      count = 0;
    for (const link of textReferences(text, Number.MAX_SAFE_INTEGER)) {
      if (link.ref.kind !== 'note' || link.ref.id !== id) continue;
      // Keep the original escaped label, so a label cannot become a new active link.
      const labelEnd = link.targetStart - `](dungeon-ref:${link.ref.kind}/`.length;
      value += text.slice(cursor, link.start) + text.slice(link.start + 1, labelEnd);
      cursor = link.end;
      count++;
    }
    return { value: value + text.slice(cursor), count };
  };
  const readAloud = unlink(root.readAloud),
    gmNotes = unlink(root.gmNotes);
  const relationships = root.relations.filter((r) => r.targetId === id).map((r) => r.label);
  return {
    note: {
      ...root,
      readAloud: readAloud.value,
      gmNotes: gmNotes.value,
      relations: root.relations.filter((r) => r.targetId !== id),
    },
    relationships,
    readAloud: readAloud.count,
    gmNotes: gmNotes.count,
  };
}

export function sameNoteContent(a: Note, b: Note) {
  const content = (n: Note) => [
    n.version,
    n.id,
    n.kind,
    n.title,
    n.readAloud,
    n.gmNotes,
    n.creatureId,
    n.deleted,
    n.relations.map((r) => [r.targetId, r.label, r.familyKind ?? null]),
  ];
  return JSON.stringify(content(a)) === JSON.stringify(content(b));
}

export interface NoteSourceRecovery {
  id: string;
  sourceId: string;
  title: string;
  unavailable?: boolean;
  before: Note;
  after: Note;
}

/** Reverse only the recorded unlink. Changed or ambiguous text lines require manual review. */
export function restoreNoteSource(current: Note, recovery: NoteSourceRecovery): Note {
  const { before, after, sourceId } = recovery;
  if (current.id !== before.id || after.id !== before.id || current.kind !== before.kind)
    throw Error('Wiederherstellung gehört zu einer anderen Notiz.');
  if (noteSourceLinks(current).has(sourceId))
    throw Error(
      'Die Quelle ist bereits verknüpft. Notizmappe aktualisieren und im Original prüfen.',
    );
  const detached = detachNoteSource(before, sourceId).note;
  if (!sameNoteContent(detached, after))
    throw Error('Gesicherte Quellenänderung ist widersprüchlich.');
  const restore = (field: 'readAloud' | 'gmNotes') => {
    const lines = (text: string) => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    const old = lines(before[field]),
      unlinked = lines(after[field]),
      now = lines(current[field]);
    if (old.length !== unlinked.length)
      throw Error('Mehrzeilige Verweise bitte im Original prüfen.');
    const positions = new Map<string, { count: number; index: number }>(),
      oldCounts = new Map<string, number>();
    now.forEach((line, index) =>
      positions.set(line, { count: (positions.get(line)?.count ?? 0) + 1, index }),
    );
    for (const line of unlinked) oldCounts.set(line, (oldCounts.get(line) ?? 0) + 1);
    const replacements = new Map<number, string>();
    for (let i = 0; i < old.length; i++) {
      if (old[i] === unlinked[i]) continue;
      // Never guess which repeated name or newly edited passage the old link belonged to.
      const match = positions.get(unlinked[i]!);
      if (match?.count !== 1 || oldCounts.get(unlinked[i]!) !== 1)
        throw Error(
          'Die frühere Verweiszeile wurde geändert oder ist mehrdeutig. Im Original anhand der gesicherten Verweise prüfen.',
        );
      replacements.set(match.index, old[i]!);
    }
    return now.map((line, index) => replacements.get(index) ?? line).join('');
  };
  const relations = [...current.relations];
  for (const relation of before.relations.filter((r) => r.targetId === sourceId))
    if (
      !relations.some(
        (r) =>
          r.targetId === relation.targetId &&
          r.label === relation.label &&
          r.familyKind === relation.familyKind,
      )
    )
      relations.push({ ...relation });
  const result = {
    ...current,
    readAloud: restore('readAloud'),
    gmNotes: restore('gmNotes'),
    relations,
  };
  const expected = noteSourceLinks(before).get(sourceId),
    actual = noteSourceLinks(result).get(sourceId);
  if (!expected || actual?.readAloud !== expected.readAloud || actual.gmNotes !== expected.gmNotes)
    throw Error(
      'Der Markdown-Kontext der Verweise wurde geändert. Gesicherte Verweise im Original prüfen.',
    );
  return result;
}
