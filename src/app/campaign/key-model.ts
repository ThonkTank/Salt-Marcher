import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { validateKeyContent } from './key-contracts';
import type { Room } from '../shared/contracts';
import type { DungeonGeometry } from '../atlas/dungeon-contracts';
import type { KeyContent, KeyBlock, KeyRendered } from './key-contracts';
import { anchored } from '../atlas/drawing-model';
import { resolvePathAnchor } from '../atlas/path-model';
export function keyAncestors(content: KeyContent, records: KeyContent[]): KeyContent[] {
  validateKeyContent(content);
  if (content.kind === 'surface') {
    const room = records.find((r) => r.id === content.surface?.roomId && r.kind === 'room');
    return [
      ...(room
        ? keyAncestors(room, records)
        : records.filter((r) => r.kind === 'dungeon' && r.scopeId === content.scopeId)),
      content,
    ];
  }
  const dungeon = records.find((r) => r.kind === 'dungeon' && r.scopeId === content.scopeId),
    level = content.levelId
      ? records.find(
          (r) => r.id === content.levelId && r.kind === 'level' && r.scopeId === content.scopeId,
        )
      : null,
    group = content.groupId
      ? records.find(
          (r) => r.id === content.groupId && r.kind === 'group' && r.scopeId === content.scopeId,
        )
      : null;
  const owners = [dungeon, level, group, content].filter((r): r is KeyContent => !!r);
  for (const owner of owners) validateKeyContent(owner);
  return owners;
}
export function keyAttributes(content: KeyContent, records: KeyContent[]) {
  const values = new Map<string, { key: string; value: string | null; origin: string }>();
  for (const owner of keyAncestors(content, records))
    for (const [key, value] of Object.entries(owner.attributes))
      values.set(key, { key, value, origin: owner.name });
  return [...values.values()];
}
export const templateBlockId = (linkId: string, childId: string) =>
  'template:' + bytesToHex(sha256(new TextEncoder().encode(JSON.stringify([linkId, childId]))));
export function expandedKeyBlocks(content: KeyContent, records: KeyContent[]) {
  validateKeyContent(content);
  const out: KeyBlock[] = [];
  for (const b of content.blocks) {
    if (b.kind !== 'template') {
      out.push({ ...b });
      continue;
    }
    const template = records.find(
      (t) => t.id === b.templateId && t.kind === 'template' && t.scopeId === content.scopeId,
    );
    if (!template) {
      out.push({
        ...b,
        kind: 'text',
        visibility: 'gm',
        text: 'Vorlage fehlt; Verknüpfung bleibt erhalten.',
      });
      continue;
    }
    validateKeyContent(template);
    for (const child of template.blocks) {
      out.push({
        ...child,
        id: templateBlockId(b.id, child.id),
        visibility:
          b.visibility === 'gm' || child.visibility === 'gm'
            ? 'gm'
            : b.visibility === 'secret' || child.visibility === 'secret'
              ? 'secret'
              : 'public',
        searchMethod: b.searchMethod || child.searchMethod,
        dc: b.dc ?? child.dc,
        discoveryNotes: b.discoveryNotes || child.discoveryNotes,
      });
    }
  }
  if (new Set(out.map((b) => b.id)).size !== out.length)
    throw new Error('Beschreibungsabschnitte benötigen eindeutige Kennungen.');
  return out;
}
function direction(dx: number, dy: number, heading: number | null) {
  if (heading !== null) {
    const angle = (Math.atan2(dx, -dy) * 180) / Math.PI - heading,
      turn = ((((angle + 180) % 360) + 360) % 360) - 180;
    return Math.abs(turn) < 45
      ? 'vor euch'
      : Math.abs(turn) > 135
        ? 'hinter euch'
        : turn > 0
          ? 'rechts von euch'
          : 'links von euch';
  }
  const a = Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) / 45) % 8;
  return [
    'im Norden',
    'im Nordosten',
    'im Osten',
    'im Südosten',
    'im Süden',
    'im Südwesten',
    'im Westen',
    'im Nordwesten',
  ][a]!;
}
export function renderDungeonKey(
  room: Room,
  records: KeyContent[],
  g: DungeonGeometry,
  options: {
    audience: 'gm' | 'public';
    discovered: Set<string>;
    heading: number | null;
    allSecrets?: boolean;
    surfaceIds?: Set<string>;
    surfaceOnly?: KeyContent;
  },
): KeyRendered {
  const content = options.surfaceOnly ?? records.find((r) => r.kind === 'room' && r.id === room.id),
    attrs = content ? keyAttributes(content, records) : [],
    volume = g.drawing.volumes?.find((v) => v.roomId === room.id),
    bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const polygon of room.polygons)
    for (const point of polygon.outer) {
      bounds.minX = Math.min(bounds.minX, point.x);
      bounds.maxX = Math.max(bounds.maxX, point.x);
      bounds.minY = Math.min(bounds.minY, point.y);
      bounds.maxY = Math.max(bounds.maxY, point.y);
    }
  const { minX, maxX, minY, maxY } = bounds,
    center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  let minHeight = Infinity,
    maxHeight = -Infinity;
  if (volume)
    for (const column of volume.columns)
      for (const span of column.spans) {
        minHeight = Math.min(minHeight, span.height);
        maxHeight = Math.max(maxHeight, span.height);
      }
  const facts = [
    {
      key: 'size',
      text: `Der Raum erstreckt sich über ${(maxX - minX).toFixed(1)} × ${(maxY - minY).toFixed(1)} Meter.`,
    },
    {
      key: 'height',
      text: volume
        ? `Die lichte Höhe beträgt ${minHeight * 1.524} bis ${maxHeight * 1.524} Meter.`
        : `Die lichte Höhe beträgt ${g.drawing.styles.find((s) => s.id === room.id)?.ceilingMeters ?? 3.048} Meter.`,
    },
  ];
  const exits: string[] = [];
  for (const p of g.drawing.passages ?? []) {
    if (!p.assigned || (p.roomId !== room.id && p.otherRoomId !== room.id)) continue;
    try {
      const a = resolvePathAnchor(g, p.anchor),
        side = p.roomId === room.id ? p.outbound : p.inbound,
        face = p.anchor.local!.face,
        d =
          face === 'up'
            ? 'nach oben'
            : face === 'down'
              ? 'nach unten'
              : direction(a.world.x - center.x, a.world.y - center.y, options.heading);
      exits.push(`Eine Passage ${d}${side.description ? ': ' + side.description : '.'}`);
    } catch {}
  }
  for (const e of g.drawing.elements) {
    if (
      e.archived ||
      e.secret ||
      !['door', 'stairs'].includes(e.kind) ||
      (e.roomId !== room.id && e.targetRoomId !== room.id)
    )
      continue;
    const at = anchored(e, g.rooms)[0];
    if (at)
      exits.push(
        `${e.kind === 'door' ? 'Eine Tür' : 'Eine Treppe'} ${direction(at.x - center.x, at.y - center.y, options.heading)}.`,
      );
  }
  const source = content
      ? expandedKeyBlocks(content, records)
      : [
          {
            id: room.id,
            kind: 'legacy' as const,
            visibility: 'gm' as const,
            text: '',
            templateId: null,
            suppressed: [],
            searchMethod: '',
            dc: null,
            discoveryNotes: '',
            revealedText: '',
          },
          {
            id: 'geometry',
            kind: 'geometry' as const,
            visibility: 'public' as const,
            text: '',
            templateId: null,
            suppressed: [],
            searchMethod: '',
            dc: null,
            discoveryNotes: '',
            revealedText: '',
          },
          {
            id: 'exits',
            kind: 'exits' as const,
            visibility: 'public' as const,
            text: '',
            templateId: null,
            suppressed: [],
            searchMethod: '',
            dc: null,
            discoveryNotes: '',
            revealedText: '',
          },
        ],
    blocks: KeyRendered['blocks'] = [],
    ambiguous = new Set(
      content?.blocks
        .filter((b) => b.kind === 'template' && options.discovered.has(b.id))
        .flatMap((b) =>
          (
            records.find(
              (t) =>
                t.id === b.templateId && t.kind === 'template' && t.scopeId === content.scopeId,
            )?.blocks ?? []
          ).map((child) => templateBlockId(b.id, child.id)),
        ) ?? [],
    );
  for (const b of source) {
    if (content?.secret && content.kind === 'surface' && b.visibility === 'public')
      b.visibility = 'secret';
    const discovered = !!options.allSecrets || options.discovered.has(b.id);
    if (
      options.audience === 'public' &&
      (b.visibility === 'gm' || (b.visibility === 'secret' && !discovered))
    )
      continue;
    let text =
      b.kind === 'text'
        ? b.visibility === 'secret' && discovered && b.revealedText
          ? b.revealedText
          : b.text
        : b.kind === 'geometry'
          ? facts
              .filter((f) => !b.suppressed.includes(f.key))
              .map((f) => f.text)
              .join('\n')
          : b.kind === 'attributes'
            ? attrs
                .filter((a) => a.value !== null && !b.suppressed.includes(a.key))
                .map((a) => a.key + ': ' + a.value)
                .join('\n')
            : b.kind === 'exits'
              ? exits.join('\n')
              : b.kind === 'legacy'
                ? room.sections
                    .filter((s) => s.kind === 'markdown')
                    .map((s) => s.markdown ?? '')
                    .join('\n\n')
                : '';
    if (text)
      blocks.push({
        id: b.id,
        visibility: b.visibility,
        text,
        discovered,
        dc: b.dc,
        searchMethod: b.searchMethod,
        discoveryNotes:
          options.audience === 'gm'
            ? [
                b.discoveryNotes,
                b.visibility === 'secret' && !discovered && ambiguous.has(b.id)
                  ? 'Frühere Vorlagenfreigabe: diesen Abschnitt einzeln prüfen und freigeben.'
                  : '',
              ]
                .filter(Boolean)
                .join('\n')
            : '',
      });
  }
  if (!options.surfaceOnly)
    for (const region of records.filter(
      (r) =>
        r.kind === 'surface' &&
        r.surface?.fragments.some(
          (f) =>
            !f.unbound &&
            g.drawing.volumes?.some((v) => v.id === f.volumeId && v.roomId === room.id),
        ) &&
        (!options.surfaceIds || options.surfaceIds.has(r.id)),
    )) {
      const rendered = renderDungeonKey(room, records, g, { ...options, surfaceOnly: region });
      if (rendered.blocks.length)
        blocks.push(...rendered.blocks.map((b) => ({ ...b, text: region.name + ': ' + b.text })));
    }
  return { text: blocks.map((b) => b.text).join('\n\n'), blocks, attributes: attrs };
}
export function editKeyText(value: string, edit: import('./key-contracts').KeyTextEdit) {
  if (edit.mode === 'replace') return edit.text;
  if (edit.mode === 'prepend') return edit.text + value;
  if (edit.mode === 'append') return value + edit.text;
  if (!edit.search) throw new Error('Suchtext darf nicht leer sein.');
  return value.split(edit.search).join(edit.text);
}
