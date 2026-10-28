import { EditorSession } from '../shared/editor-session';
import { atlasFieldValue, setAtlasFieldValue } from './atlas-units';
import { atlasDrawingWrite } from './campaign-atlas-author';
import type { WorkspaceGeometry, Room, RoomGeometry } from '../shared/contracts';
import type { DrawingView } from './drawing-view-contracts';
import type { DungeonVolume, VolumeCell, VolumeAction } from './volume-contracts';
import { VOXEL_METERS as U } from './volume-contracts';
import { volumeFromRoom, volumeProjection, isometricVolume } from './volume-model';
import { roomPath } from './drawing-model';
import { brushStroke, volumeArea, extendStroke, voxelKey, type VolumeBrush } from './volume-stroke';
export const editorSession = new EditorSession();
const pendingWork = editorSession.operation<Promise<boolean>>();

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const field = (id: string) => el<HTMLInputElement>(id),
  value = (id: string) => atlasFieldValue(field(id));
let workspace: () => WorkspaceGeometry | null,
  selected: () => Room | null,
  before: () => Promise<boolean>,
  changed: (w: WorkspaceGeometry) => Promise<void>,
  tell: (s: string, error?: boolean) => void;
let data: DrawingView | null = null,
  readRequest = 0,
  roomId: string | null = null,
  gesture: number | null = null;
let writing = false;
let cells = new Map<string, VolumeCell>();
type EditOptions = Pick<
  Extract<VolumeAction, { kind: 'volume-edit' }>,
  'operation' | 'enabled' | 'medium' | 'side'
>;
let basis: { roomRevision: number; volumeRevision: number | null; options: EditOptions } | null =
  null;
let stroke: { start: VolumeCell; last: VolumeCell; brush: VolumeBrush } | null = null;
type Camera = { x: number; y: number; width: number; height: number };
let camera: Camera | null = null;
let pan: { id: number; x: number; y: number; camera: Camera } | null = null;
function editOptions(): EditOptions {
  return {
    operation: value('volume-operation') as EditOptions['operation'],
    enabled: field('volume-enabled').checked,
    medium: value('volume-medium') as EditOptions['medium'],
    side: value('volume-side') as EditOptions['side'],
  };
}
function brush(): VolumeBrush {
  return {
    tool: value('volume-tool') as VolumeBrush['tool'],
    shape: value('volume-brush-shape') as VolumeBrush['shape'],
    radius: Number(value('volume-brush-radius')),
  };
}
function captureBasis() {
  const r = room()!;
  basis = {
    roomRevision: r.revision,
    volumeRevision: data?.volumes?.find((v) => v.roomId === r.id)?.revision ?? null,
    options: editOptions(),
  };
}
function syncControls() {
  const locked = !!pendingWork.value || gesture !== null || !!cells.size;
  for (const id of [
    'volume-initialize',
    'volume-height',
    'volume-operation',
    'volume-enabled',
    'volume-side',
    'volume-medium',
    'volume-tool',
    'volume-brush-shape',
    'volume-brush-radius',
    'volume-box-preview',
    'volume-reload',
  ])
    el<HTMLButtonElement>(id).disabled = locked;
  el<HTMLButtonElement>('volume-apply').disabled =
    !!pendingWork.value || gesture !== null || !cells.size;
  el<HTMLButtonElement>('volume-discard').disabled =
    !!pendingWork.value || (gesture === null && !cells.size);
  el<HTMLButtonElement>('volume-close').disabled = !!pendingWork.value;
}
function setCamera() {
  if (camera)
    el('volume-slice-map').setAttribute(
      'viewBox',
      `${camera.x} ${camera.y} ${camera.width} ${camera.height}`,
    );
}
function zoom(factor: number, point?: { x: number; y: number }) {
  if (!camera) return;
  const center = point ?? { x: camera.x + camera.width / 2, y: camera.y + camera.height / 2 },
    width = Math.max(U * 2, Math.min(U * 10000, camera.width * factor)),
    height = (width * camera.height) / camera.width,
    ratio = width / camera.width;
  camera = {
    x: center.x - (center.x - camera.x) * ratio,
    y: center.y - (center.y - camera.y) * ratio,
    width,
    height,
  };
  setCamera();
}
function clearStroke() {
  gesture = null;
  stroke = null;
  cells.clear();
  basis = null;
  renderCells();
  syncControls();
}
function message(text: string, error = false) {
  el('volume-stroke-status').textContent = text;
  el('volume-stroke-status').setAttribute('role', error ? 'alert' : 'status');
}

let acknowledgedRoom: Room | null = null;
let derived: { room: RoomGeometry; height: number; volume: DungeonVolume } | null = null;
let renderedVolume: DungeonVolume | null = null,
  renderedSlice = NaN,
  isometricSource: DungeonVolume | null = null;
function room() {
  const current =
    roomId === null
      ? null
      : (workspace()?.rooms.find((r) => r.id === roomId) ??
        data?.hiddenRooms.find((r) => r.id === roomId) ??
        null);
  return acknowledgedRoom?.id === roomId &&
    (!current || acknowledgedRoom.revision > current.revision)
    ? acknowledgedRoom
    : current;
}
function currentVolume() {
  const r = room();
  if (!r) return null;
  const stored = data?.volumes?.find((v) => v.roomId === r.id);
  if (stored) return stored;
  const height = Number(value('volume-height'));
  if (!Number.isSafeInteger(height) || height < 1 || height > 40)
    throw new Error('Höhe benötigt 1–40 Fünf-Fuß-Schritte.');
  if (!derived || derived.room !== r || derived.height !== height)
    derived = { room: r, height, volume: volumeFromRoom(r, height) };
  return derived.volume;
}
function owner() {
  return { generation: editorSession.generation, token: workspace()?.token, roomId };
}
type Owner = ReturnType<typeof owner>;
function current(o: Owner) {
  return (
    editorSession.generation === o.generation &&
    workspace()?.token === o.token &&
    roomId === o.roomId
  );
}
function run(fn: (o: Owner) => Promise<boolean>) {
  if (pendingWork.value) return;
  const o = owner();
  const task = Promise.resolve()
    .then(() => (current(o) ? fn(o) : false))
    .catch((e) => {
      if (current(o)) {
        tell(e.message, true);
        message(e.message, true);
      }
      return false;
    })
    .finally(() => {
      if (pendingWork.value === task) {
        pendingWork.clear(task);
        writing = false;
        syncControls();
      }
    });
  pendingWork.value = task;
  syncControls();
}
async function command(a: VolumeAction, o: Owner) {
  const w = workspace();
  if (!w || !current(o)) return false;
  writing = true;
  ++readRequest;
  const result = await atlasDrawingWrite({
    commandId: crypto.randomUUID(),
    token: w.token,
    campaignId: w.campaign.id,
    action: a,
  });
  if (!current(o)) return false;
  if (!result.ok) throw new Error(result.error);
  data = result.value.view;
  acknowledgedRoom = null;
  await changed(result.value.workspace);
  if (!current(o)) return false;
  render();
  tell('3D-Volumen und Raumzuordnung gespeichert.');
  return true;
}
function renderCells() {
  const svg = el<SVGSVGElement & HTMLElement>('volume-slice-map'),
    ns = 'http://www.w3.org/2000/svg';
  svg.querySelector('[data-volume-pending]')?.remove();
  const group = document.createElementNS(ns, 'g');
  group.setAttribute('data-volume-pending', '');
  const slice = Number(value('volume-slice'));
  for (const c of cells.values())
    if (c.z === slice) {
      const rect = document.createElementNS(ns, 'rect');
      for (const [k, v] of Object.entries({
        x: String(c.x * U),
        y: String(c.y * U),
        width: String(U),
        height: String(U),
        fill: basis?.options.operation === 'erase' ? '#bd5550' : '#c27a51',
        opacity: '.45',
      }))
        rect.setAttribute(k, v);
      group.append(rect);
    }
  svg.append(group);
  const zs = [...cells.values()].map((c) => c.z),
    currentCount = zs.filter((z) => z === slice).length;
  if (cells.size)
    message(
      `${cells.size} markierte Zellen · ${currentCount} im Schnitt · ${Math.min(...zs) * 5} bis ${Math.max(...zs) * 5} Fuß. ${gesture !== null ? 'Loslassen speichert den ganzen Zug; Escape verwirft ihn.' : 'Vorschau übernehmen oder verwerfen.'}`,
    );
  else if (!pendingWork.value)
    message(
      'Ziehen zeichnet direkt. Mausrad zoomt, mittlere Maustaste verschiebt; Escape verwirft den laufenden Zug.',
    );
  syncControls();
}
function render() {
  const r = room();
  if (!r || !data) return;
  const v = currentVolume()!,
    slice = Number(value('volume-slice'));
  if (v === renderedVolume && slice === renderedSlice) {
    renderCells();
    return;
  }
  const svg = el<SVGSVGElement & HTMLElement>('volume-slice-map'),
    ns = 'http://www.w3.org/2000/svg';
  svg.replaceChildren();
  const points = v.columns.length ? v.columns : volumeFromRoom(r, 2).columns;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const c of points) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  }
  if (!camera)
    camera = {
      x: (minX - 3) * U,
      y: (minY - 3) * U,
      width: (maxX - minX + 7) * U,
      height: (maxY - minY + 7) * U,
    };
  setCamera();
  const draw = (tag: string, attrs: Record<string, string>) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, value] of Object.entries(attrs)) e.setAttribute(k, value);
    svg.append(e);
  };
  for (const [z, color, opacity] of [
    [slice - 1, '#758d9b', '.2'],
    [slice + 2, '#bd886c', '.2'],
    [slice + 1, '#b9ccbf', '.5'],
    [slice, '#d2dfcc', '1'],
  ] as const) {
    const polygons = volumeProjection(v, z);
    if (polygons.length)
      draw('path', {
        d: roomPath(polygons),
        fill: color,
        opacity,
        stroke: '#55716d',
        'stroke-width': '.06',
        'fill-rule': 'evenodd',
      });
  }
  for (const c of v.columns) {
    const span = c.spans.find((s) => slice >= s.z && slice < s.z + s.height);
    if (!span) continue;
    draw('rect', {
      x: String(c.x * U),
      y: String(c.y * U),
      width: String(U),
      height: String(U),
      fill: span.medium === 'water' ? '#77b6d7' : 'none',
      stroke: '#739089',
      'stroke-width': '.04',
    });
    if (span.floor && span.z === slice)
      draw('path', {
        d: `M${c.x * U + 0.15},${c.y * U + 0.2}L${(c.x + 1) * U - 0.15},${c.y * U + 0.2}`,
        stroke: '#6c875c',
        'stroke-width': '.12',
      });
    if (span.ceiling && span.z + span.height - 1 === slice + 1)
      draw('path', {
        d: `M${c.x * U + 0.15},${(c.y + 1) * U - 0.2}L${(c.x + 1) * U - 0.15},${(c.y + 1) * U - 0.2}`,
        stroke: '#a28663',
        'stroke-width': '.12',
      });
  }
  if (v !== isometricSource) {
    const iso = el<SVGSVGElement & HTMLElement>('volume-isometric');
    iso.replaceChildren();
    const polygons = isometricVolume(v);
    let x = Infinity,
      y = Infinity,
      right = -Infinity,
      bottom = -Infinity;
    for (const polygon of polygons)
      for (const pair of polygon.points.split(' ')) {
        const [px, py] = pair.split(',').map(Number);
        x = Math.min(x, px!);
        right = Math.max(right, px!);
        y = Math.min(y, py!);
        bottom = Math.max(bottom, py!);
      }
    if (polygons.length) {
      iso.setAttribute('viewBox', `${x - 1} ${y - 1} ${right - x + 2} ${bottom - y + 2}`);
      for (const p of polygons) {
        const e = document.createElementNS(ns, 'polygon');
        e.setAttribute('points', p.points);
        e.setAttribute('fill', p.fill);
        e.setAttribute('stroke', '#3d545b');
        e.setAttribute('stroke-width', '.025');
        iso.append(e);
      }
    }
    isometricSource = v;
  }
  renderedVolume = v;
  renderedSlice = slice;
  renderCells();
  el('volume-status').textContent =
    r.number +
    '. ' +
    r.name +
    ' · ' +
    v.columns.length +
    ' Säulen · ' +
    v.columns.reduce((n, c) => n + c.spans.reduce((n, s) => n + s.height, 0), 0) +
    ' Raumzellen · Schnitt ' +
    slice * 5 +
    ' bis ' +
    (slice + 2) * 5 +
    ' Fuß relativ zum Zeichnungsanker' +
    (data.volumes?.some((v) => v.roomId === r.id) ? ' · gespeichert' : ' · Konturvorschau') +
    (!v.columns.length ? ' · Raum-Key erhalten, Geometrie leer. Zum Neuaufbau zeichnen.' : '');
}
function eventCell(event: PointerEvent) {
  const svg = el<SVGSVGElement & HTMLElement>('volume-slice-map'),
    matrix = svg.getScreenCTM();
  if (!matrix) throw new Error('Rasterdarstellung ist noch nicht verfügbar.');
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: Math.floor(p.x / U), y: Math.floor(p.y / U), z: Number(value('volume-slice')) };
}
function paintCell(cell: VolumeCell) {
  if (!stroke) return;
  try {
    if (stroke.brush.tool === 'brush')
      cells = extendStroke(cells, brushStroke(stroke.last, cell, stroke.brush));
    else
      cells = new Map(
        volumeArea(stroke.start, cell, stroke.brush.tool).map((p) => [voxelKey(p), p]),
      );
    stroke.last = cell;
    renderCells();
  } catch (e) {
    clearStroke();
    message((e as Error).message, true);
    tell((e as Error).message, true);
  }
}
function applyCells() {
  const r = room();
  if (!r || !data || !cells.size || !basis || gesture !== null || pendingWork.value) return;
  const submitted = new Map(cells),
    captured = basis;
  const action: VolumeAction = {
    kind: 'volume-edit',
    roomId: r.id,
    expectedRoomRevision: captured.roomRevision,
    expectedVolumeRevision: captured.volumeRevision,
    cells: [...submitted.values()],
    ...captured.options,
  };
  run(async (o) => {
    if (!(await before()) || !current(o) || !(await command(action, o)) || !current(o))
      return false;
    clearStroke();
    message('Ganzer Volumenzug gespeichert. Rückgängig stellt den vorherigen Zustand wieder her.');
    return true;
  });
}
function close() {
  if (pendingWork.value || writing || gesture !== null || cells.size) {
    tell('Volumenzug zuerst übernehmen oder verwerfen; laufende Speicherung abwarten.', true);
    return false;
  }
  editorSession.generation++;
  readRequest++;
  pendingWork.value = null;
  data = null;
  roomId = null;
  acknowledgedRoom = null;
  derived = null;
  camera = null;
  pan = null;
  el<HTMLDialogElement>('volume-dialog').close();
  return true;
}
function safeRender() {
  try {
    render();
  } catch (e) {
    tell((e as Error).message, true);
  }
}
export function initVolume(
  status: typeof tell,
  getWorkspace: typeof workspace,
  getRoom: typeof selected,
  drain: typeof before,
  publish: typeof changed,
) {
  tell = status;
  workspace = getWorkspace;
  selected = getRoom;
  before = drain;
  changed = publish;
  el('volume-open').onclick = () => {
    if (pendingWork.value) return;
    const r = selected();
    if (!r) {
      tell('Zuerst einen Raum wählen.', true);
      return;
    }
    roomId = r.id;
    el('volume-status').textContent = 'Volumen wird geladen …';
    el<HTMLDialogElement>('volume-dialog').showModal();
    run(async (o) => {
      if (!(await before()) || !current(o)) return false;
      await openVolume();
      return current(o);
    });
  };
  el('volume-close').onclick = () => {
    close();
  };
  el('volume-dialog').addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  el('volume-slice').oninput = () => {
    safeRender();
    if (stroke) paintCell({ ...stroke.last, z: Number(value('volume-slice')) });
  };
  el('volume-height').oninput = safeRender;
  const shift = (n: number) => {
    setAtlasFieldValue(field('volume-slice'), String(Number(value('volume-slice')) + n));
    safeRender();
    if (stroke) paintCell({ ...stroke.last, z: Number(value('volume-slice')) });
  };
  el('volume-lower').onclick = () => shift(-1);
  el('volume-higher').onclick = () => shift(1);
  el('volume-initialize').onclick = () => {
    const r = room();
    if (!r || !data) return;
    if (cells.size || gesture !== null) {
      tell('Volumenzug zuerst übernehmen oder verwerfen.', true);
      return;
    }
    const action: VolumeAction = {
      kind: 'volume-initialize',
      roomId: r.id,
      expectedRoomRevision: r.revision,
      expectedVolumeRevision: data.volumes?.find((v) => v.roomId === r.id)?.revision ?? null,
      heightSteps: Number(value('volume-height')),
      medium: value('volume-medium') as 'air' | 'water',
    };
    run(async (o) => ((await before()) && current(o) ? command(action, o) : false));
  };
  el('volume-discard').onclick = () => {
    if (pendingWork.value) return;
    clearStroke();
  };
  el('volume-apply').onclick = applyCells;
  el('volume-reload').onclick = () => {
    if (!pendingWork.value && !cells.size)
      run(async () => {
        await openVolume();
        return true;
      });
  };
  el('volume-box-preview').onclick = () => {
    if (!data || !room() || pendingWork.value || cells.size || gesture !== null) return;
    try {
      const corner = (suffix: string) => ({
        x: Number(value('volume-box-x' + suffix)),
        y: Number(value('volume-box-y' + suffix)),
        z: Number(value('volume-box-z' + suffix)),
      });
      const shape = value('volume-tool') === 'ellipse' ? 'ellipse' : 'rectangle',
        area = volumeArea(corner('0'), corner('1'), shape);
      captureBasis();
      cells = new Map(area.map((p) => [voxelKey(p), p]));
      renderCells();
    } catch (e) {
      message((e as Error).message, true);
    }
  };
  el('volume-zoom-in').onclick = () => zoom(0.75);
  el('volume-zoom-out').onclick = () => zoom(1 / 0.75);
  el('volume-fit').onclick = () => {
    camera = null;
    renderedVolume = null;
    safeRender();
  };
  const svg = el<SVGSVGElement & HTMLElement>('volume-slice-map');
  svg.onpointerdown = (e) => {
    if (e.button === 1 && camera) {
      e.preventDefault();
      pan = { id: e.pointerId, x: e.clientX, y: e.clientY, camera: { ...camera } };
      svg.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0 || !data || pendingWork.value || gesture !== null) return;
    if (cells.size) {
      message('Vorhandene Bereichsvorschau zuerst übernehmen oder verwerfen.', true);
      return;
    }
    e.preventDefault();
    svg.focus();
    try {
      const cell = eventCell(e);
      captureBasis();
      stroke = { start: cell, last: cell, brush: brush() };
      gesture = e.pointerId;
      svg.setPointerCapture(e.pointerId);
      paintCell(cell);
    } catch (error) {
      clearStroke();
      message((error as Error).message, true);
    }
  };
  svg.onpointermove = (e) => {
    if (pan?.id === e.pointerId) {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      camera = {
        ...pan.camera,
        x: pan.camera.x - (e.clientX - pan.x) / matrix.a,
        y: pan.camera.y - (e.clientY - pan.y) / matrix.d,
      };
      setCamera();
      return;
    }
    if (gesture === e.pointerId) paintCell(eventCell(e));
  };
  svg.onpointerup = (e) => {
    if (pan?.id === e.pointerId) {
      pan = null;
      if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
      return;
    }
    if (gesture !== e.pointerId) return;
    paintCell(eventCell(e));
    if (gesture === null) return;
    gesture = null;
    stroke = null;
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    applyCells();
  };
  svg.onpointercancel = (e) => {
    if (pan?.id === e.pointerId) pan = null;
    if (gesture === e.pointerId) {
      clearStroke();
      message('Zeichenbewegung abgebrochen; nichts gespeichert.');
    }
  };
  svg.onlostpointercapture = (e) => {
    if (pan?.id === e.pointerId) pan = null;
    if (gesture === e.pointerId) {
      clearStroke();
      message('Zeichenbewegung abgebrochen; nichts gespeichert.');
    }
  };
  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const matrix = svg.getScreenCTM();
      if (!matrix || gesture !== null) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
      zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, p);
    },
    { passive: false },
  );
  el('volume-dialog').addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && (gesture !== null || cells.size)) {
      event.preventDefault();
      event.stopPropagation();
      if (!pendingWork.value) clearStroke();
      return;
    }
    if (
      (event.key === 'PageUp' || event.key === 'PageDown') &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)
    ) {
      event.preventDefault();
      shift(event.key === 'PageUp' ? 1 : -1);
    }
    if (
      event.target === svg &&
      camera &&
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    ) {
      event.preventDefault();
      camera.x += event.key === 'ArrowRight' ? U : event.key === 'ArrowLeft' ? -U : 0;
      camera.y += event.key === 'ArrowDown' ? U : event.key === 'ArrowUp' ? -U : 0;
      setCamera();
    }
  });
}
export async function openVolume() {
  const w = workspace(),
    o = owner(),
    request = ++readRequest;
  if (!w || !room()) return;
  const result = await window.campaign.dungeonAuthoring(w.token);
  if (!current(o) || request !== readRequest) return;
  if (!result.ok) throw new Error(result.error);
  // A read must not silently advance the revision underneath an unsubmitted stroke.
  if (cells.size || gesture !== null) return;
  acknowledgedRoom =
    result.value.rooms.find((r) => r.id === roomId) ??
    result.value.drawing.hiddenRooms.find((r) => r.id === roomId) ??
    null;
  data = result.value.drawing;
  render();
  syncControls();
}
export function activateVolume() {
  editorSession.generation++;
  readRequest++;
  data = null;
  roomId = null;
  acknowledgedRoom = null;
  gesture = null;
  stroke = null;
  basis = null;
  camera = null;
  pan = null;
  cells.clear();
  pendingWork.value = null;
  writing = false;
  syncControls();
  derived = null;
  renderedVolume = null;
  isometricSource = null;
  renderedSlice = NaN;
  el<HTMLDialogElement>('volume-dialog').close();
}
export async function flushVolume() {
  const o = owner(),
    task = pendingWork.value;
  if (task && !(await task)) return false;
  if (!current(o)) return false;
  if (gesture !== null || cells.size) {
    tell('Volumenzug übernehmen oder verwerfen.', true);
    return false;
  }
  return true;
}
