import { createHash } from 'node:crypto';
import { checkedCombat } from '../runtime/combat-contracts';
import { checkedChase } from '../runtime/chase-contracts';
import {
  checkedMaskHistoryQuery,
  type MaskHistoryQuery,
  type MaskHistoryPage,
  type MaskHistoryItem,
} from '../runtime/mask-history-contracts';
import { readLiveScene } from './live';
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const fold = (s: string) =>
  s.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('de').replace(/ß/g, 'ss');
export function installMaskHistoryIndexes(db: any) {
  db.exec(
    'CREATE INDEX IF NOT EXISTS mask_chase_scene ON chase(campaign_id,scene_id); CREATE INDEX IF NOT EXISTS mask_combat_scene ON combat(campaign_id,scene_id);',
  );
}
export function readMaskHistory(
  db: any,
  cam: string,
  sceneId: string,
  input: MaskHistoryQuery,
): MaskHistoryPage {
  const q = checkedMaskHistoryQuery(input),
    table = q.kind === 'combat' ? 'combat' : 'chase',
    phase = q.kind === 'combat' ? 'phase' : 'status',
    ordinal = q.kind === 'combat' ? 'ordinal' : 'rowid',
    active = q.kind === 'combat' ? "('preparing','running')" : "('running')",
    rank = `CASE WHEN ${phase} IN ${active} THEN 1 ELSE 0 END`,
    binding = digest(JSON.stringify([cam, sceneId, q.kind, q.state, q.search]));
  let cursor: { binding: string; rank: number; ordinal: number } | null = null;
  if (q.after !== null) {
    try {
      cursor = JSON.parse(q.after);
    } catch {
      throw new Error('Suchseite ungültig. Suche erneut öffnen.');
    }
    if (
      !cursor ||
      cursor.binding !== binding ||
      ![0, 1].includes(cursor.rank) ||
      !Number.isSafeInteger(cursor.ordinal) ||
      cursor.ordinal < 1
    )
      throw new Error('Suchseite gehört zu einer anderen Gruppe oder Suche.');
  }
  const terms = fold(q.search).trim().split(/\s+/u).filter(Boolean),
    where = ['campaign_id=?', 'scene_id=?'],
    args: any[] = [cam, sceneId];
  if (q.state === 'active') where.push(`${phase} IN ${active}`);
  else if (q.state !== 'all') {
    where.push(`${phase}=?`);
    args.push(q.state);
  }
  if (terms.length) {
    db.function('gm_mask_matches', { deterministic: true }, (text: string) => {
      const normalized = fold(text);
      return terms.every((term) => normalized.includes(term)) ? 1 : 0;
    });
    where.push(
      "gm_mask_matches(COALESCE(json_extract(payload,'$.title'),'')||' '||COALESCE(json_extract(payload,'$.notes'),'')||' '||COALESCE(json_extract(payload,'$.goal'),'')||' '||COALESCE(json_extract(payload,'$.outcome'),''))=1",
    );
  }
  return db.transaction(() => {
    readLiveScene(db, cam, sceneId);
    const filter = where.join(' AND '),
      total = db.prepare(`SELECT count(*) n FROM ${table} WHERE ${filter}`).get(...args).n;
    const pageFilter = cursor ? ` AND (${rank}<? OR (${rank}=? AND ${ordinal}<?))` : '',
      rows = db
        .prepare(
          `SELECT *,${ordinal} AS history_ordinal,${rank} AS history_rank FROM ${table} WHERE ${filter}${pageFilter} ORDER BY history_rank DESC,history_ordinal DESC LIMIT 21`,
        )
        .all(...args, ...(cursor ? [cursor.rank, cursor.rank, cursor.ordinal] : []));
    const items: MaskHistoryItem[] = rows.slice(0, 20).map((r: any) => {
      if (digest(r.payload) !== r.checksum)
        throw new Error('Gespeicherte Begegnung beschädigt. Originaldaten bleiben erhalten.');
      const s =
          q.kind === 'combat'
            ? checkedCombat(JSON.parse(r.payload))
            : checkedChase(JSON.parse(r.payload)),
        state = 'phase' in s ? s.phase : s.status;
      if (s.id !== r.id || s.sceneId !== sceneId || s.revision !== r.revision || state !== r[phase])
        throw new Error('Gespeicherte Begegnung hat eine widersprüchliche Zuordnung.');
      return {
        kind: q.kind,
        id: s.id,
        title: s.title,
        state,
        round: s.round,
        summary: (s.outcome.trim() ? s.outcome : 'notes' in s ? s.notes : s.goal).slice(0, 240),
      };
    });
    const last = rows[19];
    return {
      campaignId: cam,
      sceneId,
      query: { ...q },
      items,
      total,
      next:
        rows.length > 20
          ? JSON.stringify({ binding, rank: last.history_rank, ordinal: last.history_ordinal })
          : null,
    };
  })();
}
