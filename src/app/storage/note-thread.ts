import { readSourceUnlinks } from './note-source-history';
import { createHash } from 'node:crypto';
import { checkedWorldNoteRow } from './world-note-row';
import { plainReferenceText } from '../text-references';
import { noteThreadMembers as links } from '../note-thread-edit';
import { readNarrative } from './narrative';
import type { Note } from '../preparation-contracts';
import type {
  NoteThreadEntry,
  NoteThreadPage,
  NoteThreadSelection,
} from '../note-thread-contracts';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const identity = (id: unknown) => typeof id === 'string' && !!id && id.length <= 1000;
function noteRecord(db: any, cam: string, id: string) {
  const row = db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(cam, id);
  const n = checkedWorldNoteRow(row, 'Notiz fehlt, ist beschädigt oder liegt im Papierkorb.');
  return { note: n, trashed: !!row.trashed };
}
function note(db: any, cam: string, id: string): Note {
  const value = noteRecord(db, cam, id);
  if (value.trashed) throw Error('Die Notiz liegt im Papierkorb.');
  return value.note;
}
function entry(db: any, cam: string, id: string, labels: string[]): NoteThreadEntry {
  let n: Note | null = null,
    status: NoteThreadEntry['status'] = 'untracked',
    stateRevision: number | null = null,
    notice: string | undefined,
    trashed = false;
  try {
    const value = noteRecord(db, cam, id);
    n = value.note;
    trashed = value.trashed;
    if (trashed) {
      notice =
        'Diese Originalnotiz liegt im Papierkorb. Ansehen und bei Bedarf wiederherstellen; ihre Verweise bleiben erhalten.';
      if (n.kind === 'quest' || n.kind === 'rumor') status = 'unknown';
    }
  } catch (error) {
    notice = (error as Error).message;
  }
  if (n && !trashed && (n.kind === 'quest' || n.kind === 'rumor'))
    try {
      const view = readNarrative(db, cam, id);
      status = view.state.status;
      stateRevision = view.state.revision;
      if (view.draft)
        notice = 'Gesicherte Statuseingabe vorhanden; hier steht der bestätigte Status.';
    } catch {
      status = 'unknown';
      notice = 'Bestätigter Status nicht lesbar. Quelle ausdrücklich prüfen.';
    }
  const unavailable = !n || trashed,
    revision = n?.revision ?? null;
  return {
    id,
    title: n?.title ?? 'Notiz nicht verfügbar',
    kind: n?.kind ?? null,
    revision,
    labels,
    status,
    unavailable,
    ...(trashed ? { trashed: true } : {}),
    preview:
      n && !trashed
        ? plainReferenceText(n.gmNotes || n.readAloud)
            .replace(/\s+/g, ' ')
            .slice(0, 240)
        : '',
    stamp: hash(JSON.stringify([id, revision, status, stateRevision, unavailable, trashed])),
    ...(notice ? { notice } : {}),
  };
}
export function readNoteThread(
  db: any,
  cam: string,
  id: string,
  offset: number,
  active: boolean,
  history = false,
): NoteThreadPage {
  if (
    !identity(id) ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 1_000_000 ||
    typeof active !== 'boolean' ||
    typeof history !== 'boolean'
  )
    throw Error('Notizmappe prüfen.');
  return db.transaction(() => {
    const root = note(db, cam, id),
      members = [...links(root)],
      entries: NoteThreadEntry[] = [];
    let cursor = offset,
      scanned = 0;
    while (cursor < members.length && entries.length < 40 && scanned < 200) {
      const [id, labels] = members[cursor++]!;
      scanned++;
      const value = entry(db, cam, id, labels);
      if (!active || value.status !== 'closed') entries.push(value);
    }
    return {
      root,
      recoveries: history && offset === 0 ? readSourceUnlinks(db, cam, root) : [],
      entries,
      total: members.length,
      next: cursor < members.length ? cursor : null,
    };
  })();
}
export function checkNoteThread(db: any, cam: string, selection: NoteThreadSelection) {
  if (
    !selection ||
    !identity(selection.rootId) ||
    !Number.isSafeInteger(selection.rootRevision) ||
    selection.rootRevision < 1 ||
    typeof selection.includeRoot !== 'boolean' ||
    !Array.isArray(selection.entries) ||
    selection.entries.length > 1000 ||
    selection.entries.some(
      (e) =>
        !e || !identity(e.id) || typeof e.stamp !== 'string' || !/^[a-f0-9]{64}$/.test(e.stamp),
    ) ||
    new Set(selection.entries.map((e) => e.id)).size !== selection.entries.length
  )
    throw Error('Quellenauswahl prüfen.');
  db.transaction(() => {
    const root = note(db, cam, selection.rootId),
      members = links(root);
    if (root.revision !== selection.rootRevision)
      throw Error('Die Übersichtsnotiz wurde geändert. Notizmappe aktualisieren.');
    for (const selected of selection.entries) {
      if (!members.has(selected.id))
        throw Error('Die Quelle gehört nicht mehr zu dieser Notizmappe.');
      const fresh = entry(db, cam, selected.id, members.get(selected.id)!);
      if (fresh.unavailable || fresh.stamp !== selected.stamp)
        throw Error(
          'Eine gewählte Quelle oder ihr Status wurde geändert. Notizmappe aktualisieren und Auswahl prüfen.',
        );
    }
  })();
}
