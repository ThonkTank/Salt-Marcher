import { randomUUID } from 'node:crypto';
import { checkedWorldNoteRow } from './world-note-row';
import { noteSearchQuery } from './note-search-query';
import { noteSearchPreview } from './note-search-preview';
import type { DeskEntry } from '../runtime/scene-desk-contracts';
/** Bounded, canonical note candidates for preparation. Uses the existing derived FTS index. */
export function searchNoteChoices(
  db: any,
  cam: string,
  search: string,
  offset: number,
  rulesOnly = false,
) {
  const nonce = randomUUID(),
    marks = { start: `⟦${nonce}:hit⟧`, end: `⟦${nonce}:end⟧`, clip: `⟦${nonce}:clip⟧` };
  const order =
    "CASE WHEN json_valid(n.payload) THEN json_extract(n.payload,'$.title') ELSE '' END COLLATE NOCASE,n.id";
  const ruleFilter = rulesOnly
    ? " AND json_valid(n.payload) AND json_extract(n.payload,'$.kind')='rule'"
    : '';
  const rows = search.trim()
    ? db
        .prepare(
          `SELECT n.*,snippet(note_search,3,@start,@end,@clip,24) search_preview FROM world_note n JOIN note_search s ON s.campaign_id=n.campaign_id AND s.note_id=n.id WHERE n.campaign_id=@cam AND n.trashed=0${ruleFilter} AND note_search MATCH @query ORDER BY ${order} LIMIT 41 OFFSET @offset`,
        )
        .all({ cam, query: noteSearchQuery(search), offset, ...marks })
    : db
        .prepare(
          `SELECT n.*,NULL search_preview FROM world_note n WHERE n.campaign_id=@cam AND n.trashed=0${ruleFilter} ORDER BY ${order} LIMIT 41 OFFSET @offset`,
        )
        .all({ cam, offset });
  let damaged = 0;
  const entries: DeskEntry[] = rows.slice(0, 40).map((row: any) => {
    try {
      const note = checkedWorldNoteRow(row);
      const preview = noteSearchPreview(row.search_preview, note, marks);
      return {
        ref: { kind: 'note', id: note.id },
        revision: note.revision,
        title: note.title,
        label: {
          note: 'Notiz',
          npc: 'NSC',
          faction: 'Fraktion',
          quest: 'Quest',
          rumor: 'Gerücht',
          rule: 'Regelreferenz',
        }[note.kind],
        ...(preview ? { preview } : {}),
      };
    } catch {
      damaged++;
      return {
        ref: { kind: 'note', id: row.id },
        title: 'Notiz nicht lesbar',
        label: 'Quelle prüfen',
        unavailable: true,
      };
    }
  });
  return {
    entries,
    next: rows.length > 40 ? offset + 40 : null,
    ...(damaged
      ? {
          notice: `${damaged} Quellen auf dieser Seite sind beschädigt und können nicht verknüpft werden.`,
        }
      : {}),
  };
}
