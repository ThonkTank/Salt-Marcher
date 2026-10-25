import type { DeskRef, DeskEntry } from '../runtime/scene-desk-contracts';
import { documentReferences } from '../campaign/text-references';
import { createHash } from 'node:crypto';
import { worldNoteDocument } from '../../features/world/world-notes';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { readCreature, readEncounterPlan } from './encounters';
import { readItemDefinition } from './item-definitions';
const registered = new WeakSet<object>();
export function installTextReferenceReader(db: any) {
  if (registered.has(db)) return;
  const cache = new Map<string, { value: string; bytes: number }>();
  let cacheBytes = 0;
  const maxBytes = 4 * 1024 * 1024,
    maxDocuments = 1024;
  db.function(
    'gm_document_refs',
    { deterministic: true },
    (kind: string, payload: string, checksum: string, id: string, revision: number) => {
      try {
        if (createHash('sha256').update(payload).digest('hex') !== checksum)
          throw new Error('Prüfsumme widersprüchlich');
        // Verify bytes before a hit: an unchanged stored checksum is not authority.
        const key = JSON.stringify([kind, id, revision, checksum]),
          cached = cache.get(key);
        if (cached) {
          cache.delete(key);
          cache.set(key, cached);
          return cached.value;
        }
        const d =
          kind === 'note'
            ? worldNoteDocument(JSON.parse(payload))
            : checkedLocationDocument(JSON.parse(payload));
        if (d.id !== id || (kind === 'note' && 'revision' in d && d.revision !== revision))
          throw new Error('Identität oder Revision widersprüchlich');
        const value = JSON.stringify(
            documentReferences(d, Number.MAX_SAFE_INTEGER).map((r) => ({
              kind: r.ref.kind,
              id: r.ref.id,
              label: r.label,
              field: r.field,
            })),
          ),
          bytes = Buffer.byteLength(value);
        if (value !== '[]' && bytes <= maxBytes) {
          while (cache.size && (cacheBytes + bytes > maxBytes || cache.size >= maxDocuments)) {
            const first = cache.keys().next().value!;
            cacheBytes -= cache.get(first)!.bytes;
            cache.delete(first);
          }
          cache.set(key, { value, bytes });
          cacheBytes += bytes;
        }
        return value;
      } catch {
        return JSON.stringify([
          {
            problem:
              (kind === 'note' ? 'Weltinhalt ' : 'Ort ') +
              id +
              ': Quelle beschädigt oder falsch zugeordnet.',
          },
        ]);
      }
    },
  );
  registered.add(db);
}
// Derived SQL rows; the source memo above is volatile and byte-verified, never author state.
export const textReferenceSql = `SELECT 'note' sourceKind,n.id sourceId,json_extract(j.value,'$.kind') kind,json_extract(j.value,'$.id') id,json_extract(j.value,'$.label') alias,json_extract(j.value,'$.field') field,json_extract(j.value,'$.problem') problem FROM world_note n,json_each(gm_document_refs('note',n.payload,n.checksum,n.id,n.revision)) j WHERE n.campaign_id=@cam AND n.trashed=0
 UNION ALL SELECT 'location',l.id,json_extract(j.value,'$.kind'),json_extract(j.value,'$.id'),json_extract(j.value,'$.label'),json_extract(j.value,'$.field'),json_extract(j.value,'$.problem') FROM location l,json_each(gm_document_refs('location',l.payload,l.checksum,l.id,l.revision)) j WHERE l.campaign_id=@cam AND l.trashed=0`;
export function readTextReferenceRows(
  db: any,
  cam: string,
  query: { text: string; offset: number } | { target: DeskRef },
) {
  installTextReferenceReader(db);
  const target = 'target' in query ? query.target : null,
    offset = 'offset' in query ? query.offset : 0;
  const columns = target
    ? 'sourceKind,sourceId,kind,id,alias,field'
    : 'NULL sourceKind,NULL sourceId,kind,id,min(alias) alias,NULL field';
  const filter = target ? 'kind=@kind AND id=@target' : 'instr(lower(alias),lower(@text))>0',
    group = target ? '' : ' GROUP BY kind,id',
    order = target ? 'sourceKind,sourceId,alias' : 'alias COLLATE NOCASE,kind,id';
  const result = db
    .prepare(
      `WITH refs AS MATERIALIZED (${textReferenceSql}) SELECT sourceKind,sourceId,kind,id,alias,field,NULL problems,NULL example FROM (SELECT ${columns} FROM refs WHERE problem IS NULL AND ${filter}${group} ORDER BY ${order} LIMIT 41 OFFSET @offset)
 UNION ALL SELECT NULL,NULL,NULL,NULL,NULL,NULL,count(*),min(problem) FROM refs WHERE problem IS NOT NULL HAVING count(*)>0`,
    )
    .all({
      cam,
      offset,
      ...(target
        ? { kind: target.kind, target: target.id }
        : { text: 'text' in query ? query.text : '' }),
    });
  const problem = result.find((r: any) => r.problems !== null),
    rows = result.filter((r: any) => r.problems === null);
  const notice = problem
    ? `Textverweise unvollständig: ${problem.problems} ${problem.problems === 1 ? 'Quelle konnte' : 'Quellen konnten'} nicht gelesen werden. ${problem.example}`
    : undefined;
  return {
    rows: rows.slice(0, 40) as {
      sourceKind: 'note' | 'location';
      sourceId: string;
      kind: DeskRef['kind'];
      id: string;
      alias: string;
      field: string;
    }[],
    next: rows.length > 40 ? offset + 40 : null,
    ...(notice ? { notice } : {}),
  };
}
export function referenceEntry(
  db: any,
  cam: string,
  ref: DeskRef,
): DeskEntry & { revision: number } {
  let title = 'Ziel nicht verfügbar',
    label = {
      note: 'Weltinhalt',
      location: 'Ort',
      creature: 'Kreatur',
      item: 'Gegenstand',
      encounter: 'Begegnung',
    }[ref.kind],
    revision = 0,
    unavailable = true;
  if (ref.kind === 'creature') {
    try {
      const c = readCreature(ref.id);
      title = c.name;
      label = 'Kreatur';
      revision = 1;
      unavailable = false;
    } catch {}
  } else if (ref.kind === 'item') {
    try {
      const d = readItemDefinition(db, ref.id);
      title = d.name;
      label = 'Gegenstand';
      revision = d.revision;
      unavailable = d.trashed;
    } catch {}
  } else
    try {
      if (ref.kind === 'encounter') {
        const d = readEncounterPlan(db, cam, ref.id);
        title = d.name;
        revision = d.revision;
        unavailable = false;
      } else {
        const table = ref.kind === 'note' ? 'world_note' : 'location',
          row = db.prepare(`SELECT * FROM ${table} WHERE campaign_id=? AND id=?`).get(cam, ref.id);
        if (!row || createHash('sha256').update(row.payload).digest('hex') !== row.checksum)
          throw new Error('Textverweisziel beschädigt.');
        if (ref.kind === 'note') {
          const d = worldNoteDocument(JSON.parse(row.payload));
          if (d.id !== row.id || d.revision !== row.revision)
            throw new Error('Textverweisziel widerspricht seiner Identität.');
          title = d.title;
        } else {
          const d = checkedLocationDocument(JSON.parse(row.payload));
          if (d.id !== row.id) throw new Error('Textverweisziel widerspricht seiner Identität.');
          title = d.name;
        }
        revision = row.revision;
        unavailable = !!row.trashed;
      }
    } catch {}
  return { ref, title, label, revision, unavailable };
}
export function searchTextReferences(db: any, cam: string, text: string, offset: number) {
  const page = readTextReferenceRows(db, cam, { text, offset });
  return {
    entries: page.rows.map((r) => {
      const e = referenceEntry(db, cam, { kind: r.kind, id: r.id });
      return { ...e, alias: r.alias, label: r.alias + ' → ' + e.label };
    }),
    next: page.next,
    ...(page.notice ? { notice: page.notice } : {}),
  };
}
