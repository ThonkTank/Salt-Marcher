import { volumeOrigin } from './volume-model';
import type { KeyContent } from '../campaign/key-contracts';
import type { DungeonGeometry } from './dungeon-geometry-contracts';
import { isSurfaceFace, surfaceFaceKey, connectedSurface } from './surface-model';
import { type SurfaceFace, type SurfaceSide } from './surface-contracts';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
export function drawSurfaceKey(c: KeyContent, g: DungeonGeometry | null, changed: () => void) {
  const panel = el('key-surface-editor');
  panel.hidden = c.kind !== 'surface';
  if (c.kind !== 'surface' || !g) return;
  const select = el<HTMLSelectElement>('key-surface-volume'),
    volumes = g.drawing.volumes?.filter((v) => v.scopeId === c.scopeId && v.columns.length) ?? [],
    current = select.value,
    first = c.surface?.fragments.find((f) => !f.unbound);
  select.replaceChildren();
  for (const v of volumes) {
    const o = document.createElement('option'),
      room = g.rooms.find((r) => r.id === v.roomId);
    o.value = v.id;
    o.textContent = (room?.number ?? '') + ' ' + (room?.name ?? v.roomId);
    select.append(o);
  }
  select.value = volumes.some((v) => v.id === current)
    ? current
    : (first?.volumeId ??
      volumes.find((v) => v.roomId === c.surface?.roomId)?.id ??
      volumes[0]?.id ??
      '');
  let draft = c.surface ?? { roomId: volumes[0]?.roomId ?? '', fragments: [] };
  c.surface = draft;
  const canvas = el<HTMLCanvasElement>('key-surface-canvas'),
    ctx = canvas.getContext('2d')!,
    z = el<HTMLInputElement>('key-surface-z'),
    side = el<HTMLSelectElement>('key-surface-side');
  let candidates: SurfaceFace[] = [],
    bounds = { x: 0, y: 0, scale: 20 },
    dragging = false,
    erase = false;
  function volume() {
    return volumes.find((v) => v.id === select.value);
  }
  function fragment() {
    const v = volume();
    if (!v) return;
    let f = draft.fragments.find((f) => !f.unbound && f.volumeId === v.id);
    if (!f) {
      f = { id: crypto.randomUUID(), volumeId: v.id, faces: [] };
      draft.fragments.push(f);
    }
    return f;
  }
  function draw() {
    const v = volume();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!v) return;
    const o = volumeOrigin(v);
    let maxX = -Infinity,
      maxY = -Infinity;
    for (const col of v.columns) {
      maxX = Math.max(maxX, col.x);
      maxY = Math.max(maxY, col.y);
    }
    const width = maxX - o.x + 1,
      height = maxY - o.y + 1,
      scale = Math.min(44, (canvas.width - 24) / width, (canvas.height - 24) / height);
    bounds = { x: o.x, y: o.y, scale };
    const worldZ = Number(z.value),
      direction = side.value as SurfaceSide;
    candidates = v.columns
      .slice(0, 20000)
      .map((col) => ({ x: col.x, y: col.y, z: worldZ, side: direction }))
      .filter((f) => isSurfaceFace(v, f));
    const selected = new Set(
      draft.fragments
        .filter((f) => !f.unbound && f.volumeId === v.id)
        .flatMap((f) => f.faces.map(surfaceFaceKey)),
    );
    for (const col of v.columns.slice(0, 20000)) {
      const x = 12 + (col.x - o.x) * scale,
        y = 12 + (col.y - o.y) * scale,
        f = { x: col.x, y: col.y, z: worldZ, side: direction },
        eligible = isSurfaceFace(v, f),
        marked = selected.has(surfaceFaceKey({ ...f, x: f.x - o.x, y: f.y - o.y, z: f.z - o.z }));
      ctx.fillStyle = marked ? '#bd7541' : eligible ? '#c8c9c0' : '#333b40';
      ctx.fillRect(x, y, scale - 1, scale - 1);
    }
    const n = draft.fragments.reduce(
      (n, f) => n + f.faces.length + (f.orphanedWorld?.faces.length ?? 0),
      0,
    );
    el('key-surface-status').textContent =
      n +
      ' markierte Flächen · ' +
      draft.fragments
        .filter((f) => f.unbound)
        .reduce((n, f) => n + (f.orphanedWorld?.faces.length ?? 0), 0) +
      ' ungebunden · orange: markiert, hell: beschreibbare Fläche';
  }
  function paint(event: PointerEvent) {
    const v = volume(),
      f = fragment();
    if (!v || !f) return;
    const r = canvas.getBoundingClientRect(),
      x =
        Math.floor((((event.clientX - r.left) * canvas.width) / r.width - 12) / bounds.scale) +
        bounds.x,
      y =
        Math.floor((((event.clientY - r.top) * canvas.height) / r.height - 12) / bounds.scale) +
        bounds.y,
      world = { x, y, z: Number(z.value), side: side.value as SurfaceSide };
    if (!isSurfaceFace(v, world)) return;
    const o = volumeOrigin(v),
      local = { ...world, x: x - o.x, y: y - o.y, z: world.z - o.z },
      key = surfaceFaceKey(local);
    f.faces = f.faces.filter((p) => surfaceFaceKey(p) !== key);
    if (!erase) f.faces.push(local);
    draft.roomId = v.roomId;
    changed();
    draw();
  }
  canvas.onpointerdown = (e) => {
    dragging = true;
    erase = e.button === 2 || e.altKey;
    canvas.setPointerCapture(e.pointerId);
    paint(e);
  };
  canvas.onpointermove = (e) => {
    if (dragging) paint(e);
  };
  canvas.onpointerup = () => {
    dragging = false;
  };
  canvas.oncontextmenu = (e) => e.preventDefault();
  select.onchange = () => {
    const v = volume();
    if (v) z.value = String(volumeOrigin(v).z);
    draw();
  };
  side.onchange = draw;
  z.oninput = draw;
  el('key-surface-all').onclick = () => {
    const v = volume(),
      f = fragment();
    if (!v || !f || !candidates.length) return;
    const o = volumeOrigin(v),
      faces = candidates.map((p) => ({ ...p, x: p.x - o.x, y: p.y - o.y, z: p.z - o.z }));
    if (!connectedSurface(faces)) {
      el('key-surface-status').textContent =
        'Getrennte Flächen einzeln markieren; pro Bereich eine zusammenhängende Oberfläche.';
      return;
    }
    f.faces = [
      ...f.faces.filter((p) => p.side !== side.value || p.z !== Number(z.value) - o.z),
      ...faces,
    ];
    draft.roomId = v.roomId;
    changed();
    draw();
  };
  el('key-surface-clear').onclick = () => {
    const v = volume();
    if (!v) return;
    draft.fragments = draft.fragments.filter((f) => f.unbound || f.volumeId !== v.id);
    changed();
    draw();
  };
  el('key-surface-remove-orphans').onclick = () => {
    draft.fragments = draft.fragments.filter((f) => !f.unbound);
    changed();
    draw();
  };
  const v = volume();
  if (v && (z.value === '' || !Number.isFinite(Number(z.value))))
    z.value = String(volumeOrigin(v).z);
  draw();
}
