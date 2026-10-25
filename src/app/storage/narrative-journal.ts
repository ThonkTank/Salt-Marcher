import { createHash } from 'node:crypto';
import { worldNoteDocument } from '../../features/world/world-notes';
import { readNarrative } from './narrative';
import type { NarrativeJournal, NarrativeJournalQuery } from '../narrative-journal-contracts';
function payload(row: any) {
  if (createHash('sha256').update(row.payload).digest('hex') !== row.checksum)
    throw new Error('Journalquelle ist beschädigt.');
  return JSON.parse(row.payload);
}
export function readNarrativeJournal(
  db: any,
  cam: string,
  q: NarrativeJournalQuery,
): NarrativeJournal {
  return db
    .transaction(() => {
      if (
        !q ||
        typeof q.search !== 'string' ||
        q.search.length > 1000 ||
        !['all', 'quest', 'rumor'].includes(q.kind) ||
        !['all', 'open', 'closed'].includes(q.status) ||
        (q.after !== null && typeof q.after !== 'string')
      )
        throw new Error('Journalfilter prüfen.');
      let cursor: string[] | null = null;
      if (q.after) {
        cursor = JSON.parse(q.after);
        if (
          !Array.isArray(cursor) ||
          cursor.length !== 2 ||
          cursor.some((v) => typeof v !== 'string')
        )
          throw new Error('Journalposition prüfen.');
      }
      const title = "json_extract(n.payload,'$.title')",
        status = "coalesce(json_extract(s.payload,'$.status'),'open')";
      const joins =
        'FROM world_note n LEFT JOIN narrative_state s ON s.campaign_id=n.campaign_id AND s.note_id=n.id LEFT JOIN narrative_award a ON a.campaign_id=n.campaign_id AND a.note_id=n.id';
      const filters = [
          'n.campaign_id=?',
          'n.trashed=0',
          "json_extract(n.payload,'$.kind') IN ('quest','rumor')",
        ],
        args: unknown[] = [cam];
      if (q.kind !== 'all') {
        filters.push("json_extract(n.payload,'$.kind')=?");
        args.push(q.kind);
      }
      for (const term of q.search.trim().split(/\s+/).filter(Boolean)) {
        filters.push(
          "instr(lower(coalesce(json_extract(n.payload,'$.title'),'')||char(10)||coalesce(json_extract(n.payload,'$.gmNotes'),'')||char(10)||coalesce(json_extract(n.payload,'$.readAloud'),'')||char(10)||coalesce(json_extract(a.payload,'$.outcome'),'')),lower(?))>0",
        );
        args.push(term);
      }
      const where = filters.join(' AND '),
        counts = { open: 0, closed: 0 };
      for (const row of db
        .prepare(
          `SELECT ${status} AS status,count(*) AS n ${joins} WHERE ${where} GROUP BY ${status}`,
        )
        .all(...args)) {
        if (row.status === 'open' || row.status === 'closed')
          counts[row.status as 'open' | 'closed'] = row.n;
      }
      if (q.status !== 'all') {
        filters.push(status + '=?');
        args.push(q.status);
      }
      if (cursor) {
        filters.push(`(${title} COLLATE NOCASE > ? OR ${title} COLLATE NOCASE = ? AND n.id > ?)`);
        args.push(cursor[0], cursor[0], cursor[1]);
      }
      const rows = db
          .prepare(
            `SELECT n.* ${joins} WHERE ${filters.join(' AND ')} ORDER BY ${title} COLLATE NOCASE,n.id LIMIT 41`,
          )
          .all(...args),
        more = rows.length > 40;
      rows.length = Math.min(rows.length, 40);
      const entries = rows.map((row: any) => {
        const note = worldNoteDocument(payload(row)),
          view = readNarrative(db, cam, note.id),
          place = view.state.locationId
            ? db
                .prepare('SELECT * FROM location WHERE campaign_id=? AND id=?')
                .get(cam, view.state.locationId)
            : null;
        return {
          note,
          view,
          locationName: place ? (place.trashed ? 'Papierkorb: ' : '') + payload(place).name : null,
          contributorNames: view.state.contributors.map((id) => {
            const p = db
              .prepare('SELECT * FROM character_profile WHERE campaign_id=? AND id=?')
              .get(cam, id);
            return p ? payload(p).name : id;
          }),
        };
      });
      const last = entries.at(-1);
      return {
        entries,
        next: more && last ? JSON.stringify([last.note.title, last.note.id]) : null,
        counts,
      };
    })
    .deferred();
}
