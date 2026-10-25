import { documentReferences } from '../campaign/text-references';
import {
  searchTextReferences,
  installTextReferenceReader,
  readTextReferenceRows,
} from './text-references';
import { createHash } from 'node:crypto';
import type {
  WorldLinkRef,
  WorldLinkNode,
  WorldLinksQuery,
  WorldLinksPage,
} from '../campaign/world-links-contracts';
import { worldLinkKey, worldLinkKinds } from '../campaign/world-links-contracts';
import { npcPosition } from './npc-world';
import { readCreature, searchCreatures, readEncounterPlan } from './encounters';
import { readItemDefinition } from './item-definitions';
import { worldNoteDocument } from '../../features/world/world-notes';
import type { WorldFamilyRelationKind } from '../../features/world/world-notes';
import { checkedLocationDocument } from '../../features/location/location-schema';
const decode = (r: any) => {
  if (!r || createHash('sha256').update(r.payload).digest('hex') !== r.checksum)
    throw new Error('Zusammenhangsquelle beschädigt.');
  return JSON.parse(r.payload);
};
// Each query returns metadata only. Catalogue bodies and campaign prose load on selection.
const indexSql = `SELECT 'note' refKind,id,json_extract(payload,'$.title') title,json_extract(payload,'$.kind') kind,revision FROM world_note WHERE campaign_id=@cam AND trashed=0 AND instr(lower(json_extract(payload,'$.title')||char(10)||json_extract(payload,'$.readAloud')||char(10)||json_extract(payload,'$.gmNotes')),lower(@text))>0 AND (@kind IN('all','world') OR json_extract(payload,'$.kind')=@kind)
 UNION ALL SELECT 'location',id,json_extract(payload,'$.name'),'location',revision FROM location WHERE campaign_id=@cam AND trashed=0 AND instr(lower(payload),lower(@text))>0 AND @kind IN('all','world','location')
 UNION ALL SELECT 'encounter',id,name,'encounter',revision FROM encounter_plan WHERE campaign_id=@cam AND instr(lower(name||char(10)||json_extract(payload,'$.notes')),lower(@text))>0 AND @kind IN('all','encounter')
 UNION ALL SELECT 'item',id,json_extract(payload,'$.name'),'item',revision FROM item_definition WHERE json_extract(payload,'$.trashed')=0 AND instr(lower(payload),lower(@text))>0 AND @kind IN('all','item')
 UNION ALL SELECT 'item',id,name,'item',revision FROM authored_item WHERE NOT EXISTS(SELECT 1 FROM item_definition d WHERE d.id=authored_item.id) AND instr(lower(name),lower(@text))>0 AND @kind IN('all','item')`;
export function readWorldLinks(db: any, cam: string, q: WorldLinksQuery): WorldLinksPage {
  if (
    !q ||
    typeof q.text !== 'string' ||
    q.text.length > 1000 ||
    !['all', 'world', 'reference', ...Object.keys(worldLinkKinds)].includes(q.kind) ||
    !Number.isSafeInteger(q.offset) ||
    q.offset < 0 ||
    q.offset > 1000000 ||
    (q.focus &&
      (!['note', 'location', 'creature', 'item', 'encounter'].includes(q.focus.kind) ||
        typeof q.focus.id !== 'string' ||
        !q.focus.id ||
        q.focus.id.length > 1000))
  )
    throw new Error('Zusammenhangssuche prüfen.');
  const source = db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?'),
    place = db.prepare('SELECT * FROM location WHERE campaign_id=? AND id=?');
  const resolved = (ref: WorldLinkRef): WorldLinkNode => {
    if (ref.kind === 'note') {
      const r = source.get(cam, ref.id);
      if (!r) return { ref, kind: 'rule', title: 'Nicht verfügbar', revision: 0, available: false };
      const d = worldNoteDocument(decode(r));
      if (d.id !== r.id || d.revision !== r.revision)
        throw new Error('Zusammenhangsquelle widerspricht ihrer Identität.');
      return { ref, kind: d.kind, title: d.title, revision: d.revision, available: !r.trashed };
    }
    if (ref.kind === 'location') {
      const r = place.get(cam, ref.id);
      if (!r)
        return { ref, kind: 'location', title: 'Nicht verfügbar', revision: 0, available: false };
      const d = checkedLocationDocument(decode(r));
      if (d.id !== r.id) throw new Error('Zusammenhangsquelle widerspricht ihrer Identität.');
      return { ref, kind: 'location', title: d.name, revision: r.revision, available: !r.trashed };
    }
    try {
      const d =
        ref.kind === 'creature'
          ? readCreature(ref.id)
          : ref.kind === 'item'
            ? readItemDefinition(db, ref.id)
            : readEncounterPlan(db, cam, ref.id);
      return {
        ref,
        kind: ref.kind,
        title: d.name,
        revision: ref.kind === 'creature' ? 1 : (d as { revision: number }).revision,
        available: ref.kind === 'item' && (d as { trashed?: boolean }).trashed ? false : true,
      };
    } catch {
      return {
        ref,
        kind: ref.kind,
        title: 'Quelle nicht verfügbar',
        revision: 0,
        available: false,
      };
    }
  };
  installTextReferenceReader(db);
  const aliasPage = q.kind === 'reference' ? searchTextReferences(db, cam, q.text, q.offset) : null;
  const params = { cam, text: q.text, kind: q.kind },
    list: WorldLinkNode[] = aliasPage
      ? aliasPage.entries.map((e) =>
          e.unavailable
            ? {
                ref: e.ref,
                kind: e.ref.kind === 'note' ? ('rule' as const) : e.ref.kind,
                title: e.title,
                revision: e.revision,
                available: false,
                alias: e.alias,
              }
            : { ...resolved(e.ref), alias: e.alias },
        )
      : q.kind === 'creature'
        ? []
        : db
            .prepare(indexSql + ' ORDER BY title COLLATE NOCASE,refKind,id LIMIT 41 OFFSET @offset')
            .all({ ...params, offset: q.offset })
            .map((r: any) => resolved({ kind: r.refKind, id: r.id }));
  // All sources share a bounded page: database sources first, then the immutable creature catalogue.
  if ((q.kind === 'all' || q.kind === 'creature') && list.length < 41) {
    const skip =
      q.kind === 'creature'
        ? q.offset
        : list.length
          ? 0
          : Math.max(
              0,
              q.offset - db.prepare('SELECT count(*) n FROM (' + indexSql + ')').get(params).n,
            );
    const p = searchCreatures({ text: q.text, offset: skip, limit: 41 - list.length });
    for (const c of p.rows)
      list.push({
        ref: { kind: 'creature', id: c.id },
        kind: 'creature',
        title: c.name,
        revision: 1,
        available: true,
      });
  }
  const matches = list.slice(0, 40),
    nodes = new Map<string, WorldLinkNode>(),
    edges: WorldLinksPage['edges'] = [],
    edgeKeys = new Set<string>();
  let hiddenLinks = 0;
  const add = (ref: WorldLinkRef): WorldLinkNode | null => {
    const key = worldLinkKey(ref),
      old = nodes.get(key);
    if (old) return old;
    if (nodes.size >= 121) {
      hiddenLinks++;
      return null;
    }
    const n = resolved(ref);
    nodes.set(key, n);
    return n;
  };
  const edge = (
    from: WorldLinkRef,
    to: WorldLinkRef,
    label: string,
    authored = false,
    familyKind?: WorldFamilyRelationKind,
  ) => {
    if (!add(from) || !add(to)) return;
    const key = JSON.stringify([worldLinkKey(from), worldLinkKey(to), label, authored, familyKind]);
    if (edgeKeys.has(key)) return;
    if (edges.length >= 160) {
      hiddenLinks++;
      return;
    }
    edgeKeys.add(key);
    edges.push({
      source: from,
      target: to,
      label,
      authored,
      ...(familyKind ? { familyKind } : {}),
    });
  };
  for (const n of matches) nodes.set(worldLinkKey(n.ref), n);
  const focus = q.focus ? add(q.focus) : (matches[0] ?? null),
    local = new Set(nodes.keys());
  const ids = matches.filter((n) => n.ref.kind === 'note').map((n) => n.ref.id);
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    for (const r of db
      .prepare(
        "SELECT n.id sourceId,json_extract(j.value,'$.targetId') targetId,json_extract(j.value,'$.label') label,json_extract(j.value,'$.familyKind') familyKind FROM world_note n,json_each(n.payload,'$.relations') j WHERE n.campaign_id=? AND n.trashed=0 AND n.id IN(" +
          placeholders +
          ') ORDER BY n.id,j.key',
      )
      .iterate(cam, ...ids))
      if (local.has('note:' + r.targetId))
        edge(
          { kind: 'note', id: r.sourceId },
          { kind: 'note', id: r.targetId },
          r.label,
          true,
          r.familyKind ?? undefined,
        );
  }
  const limited = (sql: string, args: any[], use: (r: any) => void) => {
    const rows = db.prepare(sql + ' LIMIT 41').all(...args);
    for (const row of rows.slice(0, 40)) use(row);
    if (rows.length > 40) hiddenLinks++;
  };
  const encounterEdges = (f: WorldLinkRef) => {
    const p = readEncounterPlan(db, cam, f.id),
      counts = new Map<string, number>(),
      actors = new Set<string>();
    for (const entry of p.entries) {
      counts.set(entry.creatureId, (counts.get(entry.creatureId) ?? 0) + entry.count);
      for (const id of entry.worldActorIds ?? []) actors.add(id);
    }
    for (const [id, count] of [...counts].slice(0, 40))
      edge(f, { kind: 'creature', id }, count + ' × Statblock · Vorlage enthält Quellenstand');
    for (const id of [...actors].slice(0, 40))
      edge(f, { kind: 'note', id }, 'benannter Teilnehmer');
    hiddenLinks += Math.max(0, counts.size - 40) + Math.max(0, actors.size - 40);
  };
  let referenceNotice = aliasPage?.notice;
  if (focus) {
    const f = focus.ref,
      page = readTextReferenceRows(db, cam, { target: f });
    referenceNotice = page.notice ?? referenceNotice;
    for (const r of page.rows)
      edge({ kind: r.sourceKind, id: r.sourceId }, f, 'Textverweis · ' + r.alias);
    if (page.next !== null) hiddenLinks++;
  }

  if (focus && focus.available) {
    const f = focus.ref;
    if (f.kind === 'note') {
      const own = decode(source.get(cam, f.id));
      const refs = documentReferences(own);
      for (const r of refs.slice(0, 40)) edge(f, r.ref, 'Textverweis · ' + r.label);
      hiddenLinks += Math.max(0, refs.length - 40);
      for (const r of own.relations.slice(0, 40))
        edge(f, { kind: 'note', id: r.targetId }, r.label, true, r.familyKind);
      hiddenLinks += Math.max(0, own.relations.length - 40);
      limited(
        "SELECT n.id sourceId,json_extract(j.value,'$.label') label,json_extract(j.value,'$.familyKind') familyKind FROM world_note n,json_each(n.payload,'$.relations') j WHERE n.campaign_id=? AND n.trashed=0 AND json_extract(j.value,'$.targetId')=? ORDER BY json_extract(n.payload,'$.title'),n.id,j.key",
        [cam, f.id],
        (r) => edge({ kind: 'note', id: r.sourceId }, f, r.label, true, r.familyKind ?? undefined),
      );
      if (own.creatureId) edge(f, { kind: 'creature', id: own.creatureId }, 'verwendet Statblock');
      if (own.kind === 'npc') {
        const p = npcPosition(db, cam, f.id);
        if (p.locationId) edge(f, { kind: 'location', id: p.locationId }, 'steht am Ort');
        const record = db
          .prepare('SELECT * FROM npc_record WHERE campaign_id=? AND id=?')
          .get(cam, f.id);
        if (record) {
          const v = decode(record);
          if (v.factionId) edge(f, { kind: 'note', id: v.factionId }, 'gehört zur Fraktion');
        }
        limited(
          "SELECT DISTINCT p.id FROM encounter_plan p,json_each(p.payload,'$.entries') e,json_each(e.value,'$.worldActorIds') a WHERE p.campaign_id=? AND a.value=? ORDER BY p.name,p.id",
          [cam, f.id],
          (r) => edge({ kind: 'encounter', id: r.id }, f, 'benannter Teilnehmer'),
        );
      }
      if (own.kind === 'quest' || own.kind === 'rumor') {
        const row = db
          .prepare('SELECT * FROM narrative_state WHERE campaign_id=? AND note_id=?')
          .get(cam, f.id);
        if (row) {
          const v = decode(row);
          if (v.locationId)
            edge(
              f,
              { kind: 'location', id: v.locationId },
              v.status === 'closed' ? 'abgeschlossen am Ort' : 'offen am Ort',
            );
          for (const item of v.items.slice(0, 40))
            if (item.reference)
              edge(
                f,
                {
                  kind: 'item',
                  id: item.reference.historicalDefinitionId ?? item.reference.definitionId,
                },
                'Belohnung · Quellenstand ' +
                  item.reference.revision +
                  (v.status === 'closed' ? ' · abgeschlossen' : ''),
              );
        }
      }
      if (own.kind === 'faction')
        limited(
          'SELECT id FROM npc_record WHERE campaign_id=? AND faction_id=? ORDER BY id',
          [cam, f.id],
          (r) => edge({ kind: 'note', id: r.id }, f, 'gehört zur Fraktion'),
        );
    } else if (f.kind === 'location') {
      const refs = documentReferences(decode(place.get(cam, f.id)));
      for (const r of refs.slice(0, 40)) edge(f, r.ref, 'Textverweis · ' + r.label);
      hiddenLinks += Math.max(0, refs.length - 40);
      limited(
        "SELECT n.id FROM world_note n LEFT JOIN npc_position p ON p.campaign_id=n.campaign_id AND p.actor_id=n.id WHERE n.campaign_id=? AND n.trashed=0 AND json_extract(n.payload,'$.kind')='npc' AND (p.location_id=? OR p.actor_id IS NULL AND EXISTS(SELECT 1 FROM prepared_group g,json_each(g.payload,'$.actors') a WHERE g.campaign_id=n.campaign_id AND g.location_id=? AND json_extract(a.value,'$.id')=n.id)) ORDER BY json_extract(n.payload,'$.title'),n.id",
        [cam, f.id, f.id],
        (r) => edge({ kind: 'note', id: r.id }, f, 'steht am Ort'),
      );
      limited(
        "SELECT note_id,payload,checksum FROM narrative_state WHERE campaign_id=? AND json_extract(payload,'$.locationId')=? ORDER BY note_id",
        [cam, f.id],
        (r) => {
          const v = decode(r);
          edge(
            { kind: 'note', id: r.note_id },
            f,
            v.status === 'closed' ? 'abgeschlossen am Ort' : 'offen am Ort',
          );
        },
      );
      const row = db
        .prepare("SELECT * FROM world_source WHERE campaign_id=? AND kind='location' AND id=?")
        .get(cam, f.id);
      if (row)
        for (const id of decode(row).factionIds.slice(0, 40))
          edge(f, { kind: 'note', id }, 'Fraktion am Ort');
    } else if (f.kind === 'encounter') encounterEdges(f);
    else if (f.kind === 'creature') {
      limited(
        "SELECT id FROM world_note WHERE campaign_id=? AND trashed=0 AND json_extract(payload,'$.creatureId')=? ORDER BY json_extract(payload,'$.title'),id",
        [cam, f.id],
        (r) => edge({ kind: 'note', id: r.id }, f, 'verwendet Statblock'),
      );
      limited(
        "SELECT p.id,sum(json_extract(e.value,'$.count')) count FROM encounter_plan p,json_each(p.payload,'$.entries') e WHERE p.campaign_id=? AND json_extract(e.value,'$.creatureId')=? GROUP BY p.id ORDER BY p.name,p.id",
        [cam, f.id],
        (r) =>
          edge(
            { kind: 'encounter', id: r.id },
            f,
            r.count + ' × Statblock · Vorlage enthält Quellenstand',
          ),
      );
    } else if (f.kind === 'item') {
      limited(
        "SELECT s.note_id,json_extract(i.value,'$.reference.revision') revision,json_extract(s.payload,'$.status') status FROM narrative_state s,json_each(s.payload,'$.items') i WHERE s.campaign_id=? AND COALESCE(json_extract(i.value,'$.reference.historicalDefinitionId'),json_extract(i.value,'$.reference.definitionId'))=? ORDER BY s.note_id,i.key",
        [cam, f.id],
        (r) =>
          edge(
            { kind: 'note', id: r.note_id },
            f,
            'Belohnung · Quellenstand ' +
              r.revision +
              (r.status === 'closed' ? ' · abgeschlossen' : ''),
          ),
      );
    }
  }
  return {
    matches,
    next: aliasPage ? aliasPage.next : list.length > 40 ? q.offset + 40 : null,
    nodes: [...nodes.values()],
    edges,
    focus,
    hiddenLinks,
    ...(referenceNotice ? { notice: referenceNotice } : {}),
  };
}
