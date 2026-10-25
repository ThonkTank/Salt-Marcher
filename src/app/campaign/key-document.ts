import type { DungeonGeometry } from '../atlas/dungeon-contracts';
import type { Room } from '../shared/contracts';
import { renderDungeonKey } from './key-model';
import { dungeonSvg } from '../atlas/drawing-model';
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
function roomsFor(g: DungeonGeometry, scopeId: string, publicOnly: boolean) {
  return g.rooms
    .filter(
      (r) =>
        r.scopeId === scopeId &&
        (!publicOnly ||
          (!g.drawing.styles.some((s) => s.id === r.id && s.secret) &&
            !g.drawing.keyContent?.some((k) => k.id === r.id && k.kind === 'room' && k.secret))),
    )
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}
function label(g: DungeonGeometry, r: Room, publicOnly: boolean) {
  const content = g.drawing.keyContent?.find((k) => k.id === r.id && k.kind === 'room'),
    level = g.drawing.keyContent?.find((k) => k.id === content?.levelId),
    name = publicOnly
      ? (g.drawing.styles.find((s) => s.id === r.id)?.publicLabel ?? 'Raum')
      : r.name;
  return (level && !publicOnly ? level.name + ' · ' : '') + r.number + '. ' + name;
}
export function dungeonKeyMarkdown(
  g: DungeonGeometry,
  scopeId: string,
  publicOnly: boolean,
  floorId?: string,
) {
  return roomsFor(g, scopeId, publicOnly)
    .filter((r) => !floorId || r.floorId === floorId)
    .map((room) => {
      const content = g.drawing.keyContent?.find((c) => c.id === room.id && c.kind === 'room'),
        description = renderDungeonKey(room, g.drawing.keyContent ?? [], g, {
          audience: publicOnly ? 'public' : 'gm',
          discovered: new Set(),
          heading: null,
        }).text,
        refs = publicOnly
          ? ''
          : (content?.references ?? []).map((r) => r.kind + ': ' + r.label).join('\n');
      return (
        '# ' +
        label(g, room, publicOnly) +
        '\n\n' +
        description +
        (refs ? '\n\nReferenzen\n' + refs : '')
      );
    })
    .join('\n\n');
}
export function dungeonKeyDocument(g: DungeonGeometry, scopeId: string, publicOnly: boolean) {
  const rooms = roomsFor(g, scopeId, publicOnly),
    floors = g.floors.filter((f) => f.scopeId === scopeId && rooms.some((r) => r.floorId === f.id));
  return (
    '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dungeon – Karte und Key</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:1000px;margin:3rem auto;padding:1rem;color:#262626;background:white}svg{width:100%;max-height:65vh}pre{white-space:pre-wrap;font:inherit}article{break-inside:avoid;margin:2rem 0}nav{columns:2}a{color:inherit}h1,h2{line-height:1.2}@media print{body{margin:0;max-width:none}section{break-after:page}nav{display:none}}</style><h1>Dungeon – Karte und Key</h1><p>' +
    (publicOnly ? 'Öffentliche Fassung' : 'GM-Fassung mit privaten Beschreibungsblöcken') +
    '</p><nav>' +
    rooms
      .map(
        (r) =>
          '<p><a href="#room-' + escape(r.id) + '">' + escape(label(g, r, publicOnly)) + '</a></p>',
      )
      .join('') +
    '</nav>' +
    floors
      .map(
        (f, i) =>
          '<section><h2>' +
          escape(publicOnly ? 'Kartenebene ' + (i + 1) : f.name) +
          '</h2>' +
          dungeonSvg(
            rooms.filter((r) => r.floorId === f.id),
            g.drawing,
            scopeId,
            f.id,
            publicOnly,
          ) +
          '</section>',
      )
      .join('') +
    rooms
      .map(
        (r) =>
          '<article id="room-' +
          escape(r.id) +
          '"><h2>' +
          escape(label(g, r, publicOnly)) +
          '</h2><pre>' +
          escape(
            renderDungeonKey(r, g.drawing.keyContent ?? [], g, {
              audience: publicOnly ? 'public' : 'gm',
              discovered: new Set(),
              heading: null,
            }).text,
          ) +
          '</pre></article>',
      )
      .join('') +
    '</html>'
  );
}
