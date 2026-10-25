import type { PlayerMapCell } from './player-contracts';
import { hexDistance, hexPoint, terrainColors } from './world-model';
import type { Hex, Terrain } from './world-contracts';
/** A bounded GM-only neighbourhood. Searching selects distant hexes without a huge SVG. */
export function renderPlayerMapPicker(
  root: HTMLElement,
  cells: PlayerMapCell[],
  selected: Hex,
  choose: (cell: PlayerMapCell) => void,
) {
  const active = document.activeElement,
    focused = active && root.contains(active) ? active.getAttribute('data-player-cell') : null;
  root.replaceChildren();
  const nearby = cells.filter((c) => hexDistance(c, selected) <= 4);
  if (!nearby.length) {
    root.textContent =
      'Hier sind keine Hexe ausgearbeitet. Suche nach einem Namen oder nutze die Koordinaten.';
    return;
  }
  const ns = 'http://www.w3.org/2000/svg',
    svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '-490 -410 980 820');
  svg.setAttribute('aria-label', 'GM-Karte · nur diese Auswahl bleibt privat');
  // Fit small regions too; relative coordinates avoid precision loss far from the origin.
  const points = nearby.map((c) => hexPoint({ q: c.q - selected.q, r: c.r - selected.r }, 100));
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x - 63);
    maxX = Math.max(maxX, p.x + 63);
    minY = Math.min(minY, p.y - 65);
    maxY = Math.max(maxY, p.y + 65);
  }
  svg.setAttribute(
    'viewBox',
    `${minX} ${minY} ${Math.max(130, maxX - minX)} ${Math.max(130, maxY - minY)}`,
  );
  const tileKey = (cell: Hex) => cell.q + ',' + cell.r;
  const entryIndex = Math.max(
    0,
    nearby.findIndex((cell) =>
      focused ? tileKey(cell) === focused : cell.q === selected.q && cell.r === selected.r,
    ),
  );
  const tiles: SVGGElement[] = [];
  const focusTile = (index: number) => {
    for (const [i, tile] of tiles.entries())
      tile.setAttribute('tabindex', i === index ? '0' : '-1');
    tiles[index]?.focus({ preventScroll: true });
  };
  for (const [index, cell] of nearby.entries()) {
    const p = points[index]!,
      group = document.createElementNS(ns, 'g'),
      polygon = document.createElementNS(ns, 'polygon'),
      label = document.createElementNS(ns, 'text'),
      state = document.createElementNS(ns, 'text');
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', index === entryIndex ? '0' : '-1');
    tiles.push(group);
    group.onfocus = () => {
      for (const tile of tiles) tile.setAttribute('tabindex', tile === group ? '0' : '-1');
    };
    group.setAttribute('aria-label', `${cell.name || cell.terrain} · Hex ${cell.q}, ${cell.r}`);
    group.setAttribute('aria-pressed', String(cell.q === selected.q && cell.r === selected.r));
    group.dataset.playerCell = cell.q + ',' + cell.r;
    polygon.setAttribute(
      'points',
      Array.from({ length: 6 }, (_, i) => {
        const a = ((i * 60 + 30) * Math.PI) / 180;
        return `${p.x + 57 * Math.cos(a)},${p.y + 57 * Math.sin(a)}`;
      }).join(' '),
    );
    polygon.setAttribute('fill', terrainColors[cell.terrain as Terrain] ?? '#8e9c8b');
    polygon.setAttribute(
      'stroke',
      cell.q === selected.q && cell.r === selected.r ? '#155da0' : '#253944',
    );
    polygon.setAttribute(
      'stroke-width',
      cell.q === selected.q && cell.r === selected.r ? '4' : '1',
    );
    const title = document.createElementNS(ns, 'title');
    title.textContent = cell.name || `Hex ${cell.q}, ${cell.r}`;
    group.append(title, polygon);
    for (const [text, y, size] of [
      [label, p.y - 3, '10'],
      [state, p.y + 14, '8'],
    ] as const) {
      text.setAttribute('x', String(p.x));
      text.setAttribute('y', String(y));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', size);
      text.setAttribute('fill', '#10232d');
      text.setAttribute('paint-order', 'stroke');
      text.setAttribute('stroke', '#fff');
      text.setAttribute('stroke-width', '2');
      group.append(text);
    }
    label.textContent = (cell.name || `${cell.q}, ${cell.r}`).slice(0, 17);
    state.textContent = cell.hidden ? 'Verdeckt' : cell.known ? 'Bekannt' : 'Unbekannt';
    group.onclick = () => choose(cell);
    group.onkeydown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        choose(cell);
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        focusTile(event.key === 'Home' ? 0 : tiles.length - 1);
        return;
      }
      const direction = (
        { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] } as Record<
          string,
          number[]
        >
      )[event.key];
      if (!direction) return;
      event.preventDefault();
      const candidates = points
        .map((point, i) => ({ index: i, dx: point.x - p.x, dy: point.y - p.y }))
        .filter((c) => c.dx * direction[0]! + c.dy * direction[1]! > 1)
        .sort((a, b) => {
          const distance = Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy);
          return Math.abs(distance) > 1e-6
            ? distance
            : Math.abs(a.dx * direction[1]! - a.dy * direction[0]!) -
                Math.abs(b.dx * direction[1]! - b.dy * direction[0]!);
        });
      if (candidates[0]) focusTile(candidates[0].index);
    };
    svg.append(group);
  }
  root.append(svg);
  if (focused && tiles[entryIndex]?.getAttribute('data-player-cell') === focused)
    focusTile(entryIndex);
}
