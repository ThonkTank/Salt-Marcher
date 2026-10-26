import { EditorSession } from '../shared/editor-session';
import { atlasFieldValue, setAtlasFieldValue } from './atlas-units';
import { AtlasPaint, atlasPaint } from './atlas-paint';
import { appendPaint, paintElement, type PaintTarget } from './atlas-paint-dom';
import { drawingGeometryOnly } from './atlas-render-view';
import { atlasDrawingWrite } from './campaign-atlas-author';
import type {
  WorkspaceGeometry,
  Room,
  RoomGeometry,
  Point,
  Polygon,
  Result,
} from '../shared/contracts';
import type { DrawingMapView, DrawingElement, DrawingAction, RoomStyle } from './drawing-contracts';
import { newElement, elementPaint, nearestAnchor, carveRoom } from './drawing-model';
import { drawingToolControls } from './drawing-tool-controls';
import { paint } from '../../compute';
export const editorSession = new EditorSession();
const pendingStyleWork = editorSession.operation<{
  token: string;
  generation: number;
  id: string;
  task: Promise<boolean>;
}>();
const pendingElementWork = editorSession.operation<{
  token: string;
  generation: number;
  id: string;
  task: Promise<boolean>;
}>();

let draftRevision = 0;
function clearDraft() {
  draftRevision++;
  path = [];
  preview = null;
  stroke = null;
}
const el = <T extends Element = HTMLElement>(id: string) =>
    document.getElementById(id) as unknown as T,
  field = (id: string) => el<HTMLInputElement>(id),
  value = (id: string) => atlasFieldValue(field(id)),
  unwrap = <T>(r: Result<T>): T => {
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };
let context: () => WorkspaceGeometry | null,
  selectedRoom: () => Room | null,
  before: () => Promise<boolean>,
  changed: (w: WorkspaceGeometry) => Promise<void>,
  redraw: () => void,
  tell: (s: string, error?: boolean) => void,
  data: DrawingMapView | null = null,
  element: DrawingElement | null = null,
  path: Point[] = [],
  preview: Polygon[] | null = null,
  stroke: number | null = null,
  busy = false,
  dirty = false,
  styleDirty = false;
let styleBasis: { id: string; revision: number | null } | null = null;
let readRequest = 0;
const owned = (token: string | undefined, generation: number) =>
  generation === editorSession.generation && token === context()?.token;
const run = (fn: () => Promise<unknown> | void) => {
  const token = context()?.token,
    generation = editorSession.generation;
  void Promise.resolve()
    .then(() => {
      if (owned(token, generation)) return fn();
    })
    .catch((e) => {
      if (owned(token, generation)) tell(e.message, true);
    });
};

async function prepare() {
  const token = context()?.token,
    generation = editorSession.generation;
  return (await before()) && owned(token, generation);
}
function floor() {
  const w = context();
  if (!w) throw new Error('Kampagne öffnen.');
  try {
    const [scopeId, floorId] = JSON.parse(el<HTMLSelectElement>('floors').value);
    return { scopeId, floorId };
  } catch {
    const f = w.floors[0];
    if (!f) throw new Error('Geschoss anlegen.');
    return { scopeId: f.scopeId, floorId: f.id };
  }
}
function roomOnFloor() {
  const room = selectedRoom(),
    current = floor();
  return room && room.scopeId === current.scopeId && room.floorId === current.floorId ? room : null;
}
function options(
  id: string,
  rows: { id: string; name: string }[],
  selected: string | null,
  empty = true,
) {
  const s = el<HTMLSelectElement>(id);
  s.replaceChildren();
  for (const row of [...(empty ? [{ id: '', name: 'Keine Bindung' }] : []), ...rows]) {
    const o = document.createElement('option');
    o.value = row.id;
    o.textContent = row.name;
    s.append(o);
  }
  if (selected && rows.some((r) => r.id === selected)) s.value = selected;
}
function syncToolControls() {
  field('drawing-snap').closest('label')!.hidden = value('drawing-tool') === 'door';
  const atlas = el('campaign-atlas');
  if (atlas) (atlas as HTMLElement).dataset.drawingTool = value('drawing-tool');
  const atlasRectangle = (atlas as HTMLElement | null)?.dataset.roomDraw === 'true',
    append = field('drawing-append'),
    state = drawingToolControls(
      value('drawing-tool'),
      !!roomOnFloor(),
      append.checked,
      path.length,
    );
  if (!state.append) append.checked = false;
  el('drawing-brush-field').toggleAttribute('hidden', !state.brush);
  el('drawing-append-field').toggleAttribute('hidden', !state.append);
  el('drawing-room-name-field').toggleAttribute('hidden', !state.roomName);
  el<HTMLButtonElement>('drawing-finish').toggleAttribute(
    'hidden',
    !state.active || !path.length || value('drawing-tool') === 'door' || atlasRectangle,
  );
  el<HTMLButtonElement>('drawing-cancel').toggleAttribute(
    'hidden',
    !state.active || !path.length || value('drawing-tool') === 'door' || atlasRectangle,
  );
  el<HTMLButtonElement>('drawing-finish').disabled = !state.actionEnabled;
  el<HTMLButtonElement>('drawing-cancel').disabled =
    !path.length && value('drawing-tool') !== 'door';
  el('drawing-tool-options').toggleAttribute('hidden', !state.options);
  el('drawing-object-field').toggleAttribute('hidden', !state.object);
  el('drawing-element-size-field').toggleAttribute('hidden', !state.object);
  el('drawing-light-radius-field').toggleAttribute('hidden', !state.light);
  el('drawing-text-field').toggleAttribute('hidden', !state.text);
  el('map-hint').textContent = atlasRectangle
    ? 'Rechteck ziehen oder zwei gegenüberliegende Ecken anklicken. Escape verwirft.'
    : state.instruction;
}
export async function activateDrawing(w: WorkspaceGeometry, load = true) {
  const generation = ++editorSession.generation;
  readRequest++;
  pendingElementWork.value = null;
  pendingStyleWork.value = null;
  styleBasis = null;
  busy = false;
  data = null;
  element = null;
  clearDraft();
  dirty = false;
  styleDirty = false;
  if (!load) return;
  const r = await window.campaign.drawingMap(w.token, selectedRoom()?.id ?? '');
  if (generation !== editorSession.generation || context()?.token !== w.token) return;
  data = unwrap(r);
  renderInspector();
  redraw();
}
export async function reloadDrawing(full = false) {
  const w = context(),
    generation = editorSession.generation,
    request = ++readRequest;
  if (!w) return;
  const response = await window.campaign.drawingMap(
    w.token,
    full ? undefined : (selectedRoom()?.id ?? ''),
  );
  if (!owned(w.token, generation) || request !== readRequest) return;
  data = unwrap(response);
  if (element && !dirty) await selectElement(element.id);
  inspectedRoom = null;
  renderInspector();
  redraw();
}
let elementRead = 0;
export function selectedDrawingElementId() {
  return element?.id ?? null;
}
export async function selectElement(id: string) {
  const w = context(),
    generation = editorSession.generation,
    request = ++elementRead;
  if (!w) return;
  element = null;
  dirty = false;
  renderInspector();
  const result = await window.campaign.drawingElement(w.token, id);
  if (!owned(w.token, generation) || request !== elementRead) return;
  const source = unwrap(result);
  if (!data || source.kind === 'feature') {
    const extra = unwrap(await window.campaign.drawingMap(w.token, selectedRoom()?.id ?? '', id));
    if (!owned(w.token, generation) || request !== elementRead) return;
    data ??= extra;
    data.features = [...data.features.filter((f) => f.id !== id), ...extra.features];
  }
  element = structuredClone(source);
  dirty = false;
  if (data) {
    const { notes: unused, content: unusedContent, ...projection } = element;
    data.elements = [...data.elements.filter((e) => e.id !== id), projection];
  }
  renderInspector();
}
async function execute(action: DrawingAction) {
  const w = context(),
    generation = editorSession.generation;
  if (!w) throw new Error('Kampagne öffnen.');
  const command = {
    commandId: crypto.randomUUID(),
    token: w.token,
    campaignId: w.campaign.id,
    action,
  };
  if (!(await prepare())) throw new Error('Vorherige Eingabe abschließen.');
  if (!owned(w.token, generation)) throw new Error('Zeichnungskontext gewechselt.');
  readRequest++;
  const response = await atlasDrawingWrite(command);
  if (!owned(w.token, generation)) throw new Error('Zeichnungskontext gewechselt.');
  const result = unwrap(response);
  readRequest++;
  data = drawingGeometryOnly(result.view);
  if (
    !(
      action.kind === 'element' &&
      action.element.kind === 'door' &&
      value('drawing-tool') === 'door' &&
      !path.length
    )
  )
    clearDraft();
  await changed(result.workspace);
  if (!owned(w.token, generation)) throw new Error('Zeichnungskontext gewechselt.');
  renderInspector();
  redraw();
  tell('Dungeonänderung gespeichert.');
  return result;
}
function renderInspector() {
  const w = context();
  if (!w || !data) return;
  const properties = el<HTMLDetailsElement>('drawing-element-properties');
  if (properties && properties.dataset.element !== element?.id) {
    properties.open = element?.kind !== 'path';
    properties.dataset.element = element?.id ?? '';
  }
  const hint = el('drawing-path-edit-hint');
  if (hint) hint.hidden = element?.kind !== 'path';
  const floors = el<HTMLSelectElement>('floors');
  if (floors.options.length !== w.floors.length) {
    const current = floors.value;
    floors.replaceChildren();
    for (const f of w.floors) {
      const o = document.createElement('option');
      o.value = JSON.stringify([f.scopeId, f.id]);
      o.textContent = f.name;
      floors.append(o);
    }
    if ([...floors.options].some((o) => o.value === current)) floors.value = current;
  }
  const r = selectedRoom(),
    f = floor();
  options(
    'drawing-merge-room',
    w.rooms
      .filter((x) => x.scopeId === f.scopeId && x.floorId === f.floorId && x.id !== r?.id)
      .map((x) => ({ id: x.id, name: x.number + '. ' + x.name })),
    null,
  );
  options(
    'drawing-room-bind',
    w.rooms
      .filter((x) => x.scopeId === f.scopeId && x.floorId === f.floorId)
      .map((x) => ({ id: x.id, name: x.number + '. ' + x.name })),
    dirty ? value('drawing-room-bind') || null : (element?.roomId ?? null),
  );
  options(
    'drawing-target-room',
    w.rooms.map((x) => ({ id: x.id, name: x.number + '. ' + x.name })),
    dirty ? value('drawing-target-room') || null : (element?.targetRoomId ?? null),
  );
  options(
    'drawing-target-floor',
    w.floors.filter((x) => x.scopeId === f.scopeId).map((x) => ({ id: x.id, name: x.name })),
    dirty ? value('drawing-target-floor') || null : (element?.targetFloorId ?? null),
  );
  const style = data.styles.find((s) => s.id === r?.id);
  if (r && !styleDirty) {
    styleBasis = {
      id: r.id,
      revision:
        style && Object.hasOwn(style, 'authorRevision')
          ? (style.authorRevision ?? null)
          : (style?.revision ?? null),
    };
    const volume = data.volumes?.find((v) => v.roomId === r.id);
    field('drawing-ceiling').disabled = !!volume;
    setAtlasFieldValue(
      field('drawing-ceiling'),
      String(
        volume
          ? Math.max(...volume.columns.flatMap((c) => c.spans.map((s) => s.z + s.height))) * 1.524
          : (style?.ceilingMeters ?? 3.048),
      ),
    );
    field('drawing-fill').value = style?.fill ?? '#d8cbb5';
    field('drawing-wall-color').value = style?.wall ?? '#574b3f';
    field('drawing-public-label').value = style?.publicLabel ?? '';
    field('drawing-room-secret').checked = style?.secret ?? false;
    field('drawing-track-surface').value = style?.trackSurface ?? 'stone';
  }
  el('drawing-element-form').toggleAttribute('hidden', !element);
  el('drawing-feature-runtime').toggleAttribute('hidden', element?.kind !== 'feature');
  if (element && !dirty) {
    const heightLabel = field('drawing-height').closest('label')?.firstChild;
    if (heightLabel)
      heightLabel.textContent = element.kind === 'object' ? 'Planlänge m ' : 'Zeichenhöhe m ';
    el('drawing-element-kind').textContent = {
      wall: 'Wand',
      door: 'Tür / Portal',
      stairs: 'Geschossverbindung',
      light: 'Lichtquelle',
      object: 'Objekt',
      path: 'Pfad',
      terrain: 'Terrain',
      water: 'Wasser',
      roof: 'Dach',
      text: 'Text',
      feature: 'Feature',
    }[element.kind];
    for (const [id, v] of Object.entries({
      'drawing-element-name': element.name,
      'drawing-element-notes': element.notes,
      'drawing-width': String(element.width),
      'drawing-height': String(element.height),
      'drawing-z-offset': String(element.zOffsetMeters ?? 0),
      'drawing-vertical': String(
        element.verticalMeters ?? (element.kind === 'object' ? 1 : element.height),
      ),
      'drawing-angle': String(element.angle),
      'drawing-color': element.color,
      'drawing-variant': element.variant,
      'drawing-state': element.state,
      'drawing-element-points': element.points.map((p) => p.x + ', ' + p.y).join('\n'),
      'drawing-feature-type': element.feature,
      'drawing-max-charges': String(element.maxCharges),
      'drawing-reset-minutes': String(element.resetSeconds / 60),
      'drawing-reset-mode': element.resetMode,
      'drawing-trigger-radius': String(element.triggerRadius),
      'drawing-sound-range': String(element.sound?.rangeMeters ?? 18),
      'drawing-sound-dc': String(element.sound?.dc ?? 10),
      'drawing-sound-text': element.sound?.publicText ?? '',
    }))
      setAtlasFieldValue(field(id), v);
    field('drawing-secret').checked = element.secret;
    field('drawing-sound-enabled').checked = element.sound?.enabled ?? false;
    field('drawing-blocks-sight').checked = element.blocksSight;
    field('drawing-blocks-sound').checked = element.blocksSound;
    field('drawing-passable').checked = element.passable;
    el('drawing-feature-fields').toggleAttribute('hidden', element.kind !== 'feature');
    const state = data.features.find((s) => s.id === element!.id);
    el('drawing-feature-status').textContent = state
      ? state.charges +
        '/' +
        element.maxCharges +
        ' Charges' +
        (state.resetStartedMs ? ' · Reset läuft in bestätigter Gruppenzeit' : '')
      : '';
  }
  const archive = el('drawing-archive');
  archive.replaceChildren();
  if (data.coverage === 'selected') {
    const hint = document.createElement('p');
    hint.textContent = 'Weitere Raum- und Archivwerkzeuge über „Neu laden“ laden.';
    archive.append(hint);
  }
  for (const room of data.hiddenRooms) {
    const b = document.createElement('button');
    b.textContent = 'Raum ' + room.number + ' wiederherstellen: ' + room.name;
    b.onclick = () => run(() => execute({ kind: 'room-hide', roomId: room.id, hidden: false }));
    archive.append(b);
  }
  for (const f of data.hiddenFloors) {
    const b = document.createElement('button');
    b.textContent = 'Geschoss wiederherstellen: ' + f.name;
    b.onclick = () =>
      run(() =>
        execute({
          kind: 'floor',
          scopeId: f.scopeId,
          id: f.id,
          name: f.name,
          elevation: f.sourceElevation,
          cloneId: null,
          hidden: false,
        }),
      );
    archive.append(b);
  }
  for (const e of data.elements.filter((e) => e.archived)) {
    const b = document.createElement('button');
    b.textContent = 'Element wiederherstellen: ' + (e.name || e.kind);
    b.onclick = () =>
      run(() =>
        execute({ kind: 'element-hide', id: e.id, expectedRevision: e.revision, archived: false }),
      );
    archive.append(b);
  }
}
export function roomDrawingStyle(id: string) {
  return data?.styles.find((s) => s.id === id) ?? null;
}
let inspectedRoom: string | null = null;
export function syncDrawingControls() {
  if (!data || !context()) return;
  syncToolControls();
  if (selectedRoom()?.id !== inspectedRoom) {
    inspectedRoom = selectedRoom()?.id ?? null;
    renderInspector();
  }
  el('drawing-path-status').textContent =
    el<HTMLElement>('campaign-atlas')?.dataset.roomDraw === 'true'
      ? 'Loslassen oder zweite Ecke bestätigt den Raum.'
      : value('drawing-tool') === 'door'
        ? 'Rückgängig entfernt die zuletzt gesetzte Tür.'
        : path.length
          ? 'Vorschau: ' +
            path.length +
            ' Punkte · Enter/Zug übernehmen bestätigt · Escape verwirft'
          : value('drawing-tool') === 'select'
            ? 'Auswahlwerkzeug aktiv.'
            : 'Klicken zeichnet Punkte; Pinsel und Streuen folgen gedrückter Maustaste. Alle Maße in Metern.';
  drawSection();
}
export function drawingOverlay(svg: PaintTarget, draftsOnly = false) {
  if (!data || !context()) return;
  syncDrawingControls();
  const f = floor(),
    w = context()!,
    shape = atlasPaint;
  for (const e of (draftsOnly ? (element ? [element] : []) : data.elements).filter(
    (e) => e.scopeId === f.scopeId && e.floorId === f.floorId && !e.archived,
  )) {
    const node = elementPaint(
      e,
      w.rooms,
      data.elements.filter(
        (x) => x.scopeId === f.scopeId && x.floorId === f.floorId && !x.archived,
      ),
    );
    if (svg instanceof AtlasPaint) {
      node.data.atlasObject = 'true';
      node.data.kind = 'element';
      node.data.id = e.id;
      svg.append(node);
    } else {
      const g = paintElement(node, svg.ownerDocument);
      g.addEventListener('click', (event) => {
        if (value('drawing-tool') !== 'select') return;
        event.stopPropagation();
        run(async () => {
          if (!(await flushDrawing())) return;
          await selectElement(e.id);
        });
      });
      svg.append(g);
    }
  }
  if (preview)
    appendPaint(
      svg,
      shape('polygons', {
        polygons: preview,
        style: { fill: '#4f9da2', fillOpacity: 0.35, stroke: '#236871', lineWidth: 0.1 },
      }),
    );
  if (path.length)
    appendPaint(
      svg,
      shape('polyline', { points: path, style: { fill: null, stroke: '#236871', lineWidth: 0.1 } }),
    );
}
function drawSection() {
  const canvas = el<SVGSVGElement>('drawing-section');
  canvas.replaceChildren();
  if (!field('drawing-show-section').checked || !context() || !data) {
    canvas.toggleAttribute('hidden', true);
    return;
  }
  canvas.toggleAttribute('hidden', false);
  const f = floor(),
    y = Number(value('drawing-slice-y')),
    base =
      context()!.floors.find((x) => x.scopeId === f.scopeId && x.id === f.floorId)
        ?.sourceElevation ?? 0,
    ns = 'http://www.w3.org/2000/svg';
  let min = Infinity,
    max = -Infinity,
    top = base + 3.048;
  for (const r of context()!.rooms.filter(
    (r) => r.scopeId === f.scopeId && r.floorId === f.floorId,
  )) {
    const cuts: number[] = [];
    for (const ring of r.polygons.flatMap((p) => [p.outer, ...p.holes]))
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]!,
          b = ring[(i + 1) % ring.length]!;
        if (a.y > y !== b.y > y) cuts.push(a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y));
      }
    cuts.sort((a, b) => a - b);
    const height = data.styles.find((s) => s.id === r.id)?.ceilingMeters ?? 3.048;
    for (let i = 0; i < cuts.length - 1; i += 2) {
      const x = cuts[i]!,
        end = cuts[i + 1]!;
      min = Math.min(min, x);
      max = Math.max(max, end);
      top = Math.max(top, base + height);
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(-base - height));
      rect.setAttribute('width', String(end - x));
      rect.setAttribute('height', String(height));
      rect.setAttribute('fill', '#bcb59e');
      rect.setAttribute('stroke', '#514a3b');
      rect.setAttribute('stroke-width', '.08');
      canvas.append(rect);
    }
  }
  if (!Number.isFinite(min)) {
    min = 0;
    max = 10;
  }
  canvas.setAttribute(
    'viewBox',
    `${min - 1} ${-top - 1} ${Math.max(2, max - min + 2)} ${top - base + 2}`,
  );
}
function point(event: PointerEvent) {
  const svg = el<SVGSVGElement>('map'),
    p = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse()),
    grid = field('drawing-snap').checked ? Number(value('drawing-grid')) : 0;
  return {
    x: grid > 0 ? Math.round(p.x / grid) * grid : Math.round(p.x * 1000) / 1000,
    y: grid > 0 ? Math.round(p.y / grid) * grid : Math.round(p.y * 1000) / 1000,
  };
}
function shape() {
  const tool = value('drawing-tool'),
    r = selectedRoom();
  if (tool === 'room-rectangle' && path.length >= 2) {
    const a = path[0]!,
      b = path.at(-1)!;
    return [
      {
        outer: [
          { x: a.x, y: a.y },
          { x: b.x, y: a.y },
          { x: b.x, y: b.y },
          { x: a.x, y: b.y },
        ],
        holes: [],
      },
    ];
  }
  if (tool === 'room-cave' || tool === 'room-erase') {
    return paint({
      kind: 'paint',
      polygons:
        tool === 'room-erase'
          ? (r?.polygons ?? [])
          : field('drawing-append').checked
            ? (r?.polygons ?? [])
            : [],
      points: path,
      radius: Number(value('drawing-brush')),
      erase: tool === 'room-erase',
    }).map((p) => ({ outer: [...p.outer], holes: p.holes.map((h) => [...h]) }));
  }
  if (tool === 'room-hole')
    return r && path.length >= 3 ? carveRoom(r.polygons, [{ outer: path, holes: [] }]) : null;
  if (tool === 'room-polygon' && path.length >= 3) return [{ outer: [...path], holes: [] }];
  return null;
}
async function finish() {
  if (
    !context() ||
    !drawingToolControls(
      value('drawing-tool'),
      !!roomOnFloor(),
      field('drawing-append').checked,
      path.length,
    ).actionEnabled ||
    busy
  )
    return;
  const token = context()!.token,
    generation = editorSession.generation;
  busy = true;
  try {
    const tool = value('drawing-tool'),
      f = floor(),
      r = roomOnFloor();
    let result;
    if (tool.startsWith('room-')) {
      const polygons = shape();
      if (!polygons?.length)
        throw new Error(
          'Kontur benötigt eine Fläche. Vollständiges Entfernen erfolgt über das Raumarchiv.',
        );
      if (tool === 'room-hole' || tool === 'room-erase' || field('drawing-append').checked) {
        if (!r) throw new Error('Raum auf diesem Geschoss auswählen.');
        const combined =
          ['room-rectangle', 'room-polygon'].includes(tool) && field('drawing-append').checked
            ? [...r.polygons, ...polygons]
            : polygons;
        result = await execute({
          kind: 'shape',
          roomId: r.id,
          expectedRevision: r.revision,
          polygons: combined,
        });
      } else
        result = await execute({
          kind: 'create-room',
          scopeId: f.scopeId,
          floorId: f.floorId,
          name: value('drawing-room-name') || 'Neuer Raum',
          polygons,
        });
    } else if (tool === 'scatter') {
      const elements: DrawingElement[] = [];
      for (const p of path) {
        const e = newElement('object', f.scopeId, f.floorId, r?.id ?? null, [p]);
        e.variant = value('drawing-object');
        e.width = Number(value('drawing-element-size'));
        e.height = e.width;
        elements.push(e);
      }
      result = await execute({ kind: 'elements', elements });
    } else {
      const kind = tool as DrawingElement['kind'],
        e = newElement(kind, f.scopeId, f.floorId, r?.id ?? null, [...path]);
      e.variant = kind === 'object' ? value('drawing-object') : e.variant;
      e.name = kind === 'text' ? value('drawing-text') : kind === 'feature' ? 'Neue Falle' : '';
      if (kind === 'door' && r) {
        const a = nearestAnchor(path[0]!, r);
        e.anchor = a ? { roomId: r.id, polygon: a.polygon, edge: a.edge, t: a.t } : null;
      }
      if (kind === 'light') e.width = Number(value('drawing-light-radius'));
      if (kind === 'object') {
        e.width = Number(value('drawing-element-size'));
        e.height = e.width;
      }
      result = await execute({ kind: 'element', element: e, expectedRevision: null });
      await selectElement(e.id);
    }
    field('drawing-tool').value = 'select';
    redraw();
    return result;
  } finally {
    if (owned(token, generation)) busy = false;
  }
}
function elementFields() {
  return JSON.stringify(
    [
      ...el('drawing-element-form').querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >('input,textarea,select'),
    ].map((i) => [
      i.id,
      i.type === 'checkbox' ? (i as HTMLInputElement).checked : atlasFieldValue(i),
    ]),
  );
}
function collectElement(base: DrawingElement) {
  const points = value('drawing-element-points')
      .split(/\r?\n/)
      .filter((s) => s.trim())
      .map((s) => {
        const [x, y] = s.split(',').map(Number);
        if (!Number.isFinite(x) || !Number.isFinite(y))
          throw new Error('Ein Punkt pro Zeile: x, y.');
        return { x: x!, y: y! };
      }),
    e = {
      ...base,
      name: value('drawing-element-name'),
      notes: value('drawing-element-notes'),
      points,
      width: Number(value('drawing-width')),
      height: Number(value('drawing-height')),
      zOffsetMeters: Number(value('drawing-z-offset')),
      verticalMeters: Number(value('drawing-vertical')),
      angle: Number(value('drawing-angle')),
      color: value('drawing-color'),
      variant: value('drawing-variant'),
      secret: field('drawing-secret').checked,
      blocksSight: field('drawing-blocks-sight').checked,
      blocksSound: field('drawing-blocks-sound').checked,
      passable: field('drawing-passable').checked,
      state: value('drawing-state') as DrawingElement['state'],
      roomId: value('drawing-room-bind') || null,
      targetRoomId: value('drawing-target-room') || null,
      targetFloorId: value('drawing-target-floor') || null,
      feature: value('drawing-feature-type') as DrawingElement['feature'],
      maxCharges: Number(value('drawing-max-charges')),
      resetSeconds: Math.round(Number(value('drawing-reset-minutes')) * 60),
      resetMode: value('drawing-reset-mode') as DrawingElement['resetMode'],
      triggerRadius: Number(value('drawing-trigger-radius')),
      sound: {
        enabled: field('drawing-sound-enabled').checked,
        rangeMeters: Number(value('drawing-sound-range')),
        dc: Number(value('drawing-sound-dc')),
        publicText: value('drawing-sound-text'),
      },
    };
  return e;
}
function saveElement(): Promise<boolean> {
  const w = context(),
    generation = editorSession.generation,
    id = element?.id;
  if (!w || !id || !dirty) return Promise.resolve(true);
  if (
    pendingElementWork.value?.token === w.token &&
    pendingElementWork.value.generation === generation &&
    pendingElementWork.value.id === id
  )
    return pendingElementWork.value.task;
  const state = { token: w.token, generation, id, task: Promise.resolve(false) };
  state.task = Promise.resolve().then(async () => {
    try {
      while (owned(w.token, generation) && element?.id === id && dirty) {
        const fields = elementFields(),
          base = element,
          e = collectElement(base);
        const result = await execute({
          kind: 'element',
          element: e,
          expectedRevision: base.revision,
        });
        if (!owned(w.token, generation) || element?.id !== id) return false;
        const saved = result.view.elements.find((x) => x.id === id);
        if (!saved) throw new Error('Gespeichertes Element fehlt.');
        element = structuredClone(saved);
        dirty = fields !== elementFields();
        renderInspector();
      }
      return owned(w.token, generation);
    } catch (error) {
      if (owned(w.token, generation)) tell((error as Error).message, true);
      return false;
    }
  });
  pendingElementWork.value = state;
  return state.task;
}

const styleFields = () =>
  JSON.stringify(
    [
      'drawing-ceiling',
      'drawing-fill',
      'drawing-wall-color',
      'drawing-public-label',
      'drawing-room-secret',
      'drawing-track-surface',
    ].map((id) => [id, id === 'drawing-room-secret' ? field(id).checked : value(id)]),
  );
function saveStyle(): Promise<boolean> {
  const w = context(),
    r = selectedRoom(),
    generation = editorSession.generation;
  if (!styleDirty) return Promise.resolve(true);
  if (!w || !r) return Promise.resolve(false);
  if (
    pendingStyleWork.value?.token === w.token &&
    pendingStyleWork.value.generation === generation &&
    pendingStyleWork.value.id === r.id
  )
    return pendingStyleWork.value.task;
  const state = { token: w.token, generation, id: r.id, task: Promise.resolve(false) };
  state.task = Promise.resolve().then(async () => {
    try {
      while (owned(w.token, generation) && selectedRoom()?.id === r.id && styleDirty) {
        if (styleBasis?.id !== r.id) throw new Error('Raumstil gehört zu einer anderen Auswahl.');
        const fields = styleFields(),
          expected = styleBasis.revision,
          style: RoomStyle = {
            id: r.id,
            scopeId: r.scopeId,
            revision: expected ?? 0,
            ceilingMeters: Number(value('drawing-ceiling')),
            fill: value('drawing-fill'),
            wall: value('drawing-wall-color'),
            publicLabel: value('drawing-public-label'),
            secret: field('drawing-room-secret').checked,
            trackSurface: value('drawing-track-surface') as RoomStyle['trackSurface'],
          };
        const result = await execute({ kind: 'style', style, expectedRevision: expected });
        if (!owned(w.token, generation) || selectedRoom()?.id !== r.id) return false;
        const saved = result.view.styles.find((s) => s.id === r.id);
        if (!saved) throw new Error('Gespeicherter Raumstil fehlt.');
        styleBasis = { id: r.id, revision: saved.revision };
        styleDirty = fields !== styleFields();
        renderInspector();
      }
      return owned(w.token, generation) && selectedRoom()?.id === r.id;
    } catch (error) {
      if (owned(w.token, generation)) tell((error as Error).message, true);
      return false;
    }
  });
  pendingStyleWork.value = state;
  return state.task;
}
export async function flushDrawing() {
  const token = context()?.token,
    generation = editorSession.generation;
  if (busy || stroke !== null || path.length) {
    tell('Dungeonzug zuerst abschließen oder verwerfen.', true);
    return false;
  }
  if (!(await saveStyle()) || !owned(token, generation)) return false;
  return (await saveElement()) && owned(token, generation);
}
export function atlasDrawingUndoPoint() {
  path.pop();
  draftRevision++;
  preview = shape();
  redraw();
}
export function atlasDrawingMeasurement(hover?: Point) {
  const tool = value('drawing-tool'),
    points = [...path];
  if (hover && !['select', 'room-cave', 'room-erase', 'scatter'].includes(tool))
    points.push(atlasDrawingSnapPoint(hover));
  let selected = element;
  if (selected && dirty) {
    try {
      selected = collectElement(selected);
    } catch {
      return null;
    }
  }
  let polygons = preview;
  if (tool === 'room-rectangle' && points.length >= 2) {
    const a = points[0]!,
      b = points.at(-1)!;
    polygons = [{ outer: [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }], holes: [] }];
  }
  if (tool === 'room-polygon' && points.length >= 3) polygons = [{ outer: points, holes: [] }];
  const kind = tool === 'scatter' ? 'object' : (tool as DrawingElement['kind']);
  const draft =
    tool === 'select'
      ? selected
      : points.length && !tool.startsWith('room-')
        ? newElement(kind, floor().scopeId, floor().floorId, null, points)
        : null;
  if (draft && tool !== 'select') {
    if (kind === 'light') draft.width = Number(value('drawing-light-radius'));
    if (kind === 'object') draft.width = draft.height = Number(value('drawing-element-size'));
  }
  return {
    tool,
    points,
    polygons,
    element: draft,
    radius: Number(value('drawing-brush')),
    floor: floor(),
  };
}
export function atlasDrawingHasDraft() {
  return (
    busy ||
    dirty ||
    styleDirty ||
    !!pendingElementWork.value ||
    !!pendingStyleWork.value ||
    path.length > 0 ||
    preview !== null
  );
}
export function atlasDrawingDraft() {
  return {
    polygons: preview,
    path: [...path],
    floor: floor(),
    element:
      !dirty && !pendingElementWork.value && value('drawing-tool') === 'select' ? element : null,
  };
}
/** The Atlas drag adapter shares the same name, grid, append rules and writer as point tools. */
export function atlasDrawingSnapPoint(p: Point): Point {
  const grid = field('drawing-snap').checked ? Number(value('drawing-grid')) : 0;
  return {
    x: grid > 0 ? Math.round(p.x / grid) * grid : p.x,
    y: grid > 0 ? Math.round(p.y / grid) * grid : p.y,
  };
}
export async function atlasDrawingRectangle(a: Point, b: Point) {
  const w = context(),
    generation = editorSession.generation,
    revision = draftRevision;
  if (!w || busy || path.length || value('drawing-tool') !== 'room-rectangle') return;
  const f = floor();
  if (
    !(await prepare()) ||
    !owned(w.token, generation) ||
    revision !== draftRevision ||
    value('drawing-tool') !== 'room-rectangle' ||
    f.scopeId !== floor().scopeId ||
    f.floorId !== floor().floorId
  )
    return;
  const start = atlasDrawingSnapPoint(a),
    end = atlasDrawingSnapPoint(b);
  if (Math.abs(start.x - end.x) < 0.01 || Math.abs(start.y - end.y) < 0.01)
    throw Error('Raum benötigt eine Fläche. Zweite Ecke erneut wählen.');
  const staged = [start, end];
  path = staged;
  preview = shape();
  redraw();
  try {
    return await finish();
  } finally {
    if (owned(w.token, generation) && path === staged) clearDraft();
  }
}
/** Capture draft ownership before waiting for earlier brush points or preparation. */
export async function atlasDrawingPoint(
  p: Point,
  after?: Promise<unknown>,
  doorRoom?: () => Promise<{ room: RoomGeometry; maxDistance: number }>,
) {
  const w = context(),
    generation = editorSession.generation,
    revision = draftRevision;
  if (!w) return;
  const current = () =>
    owned(w.token, generation) &&
    revision === draftRevision &&
    value('drawing-tool') !== 'select' &&
    !busy;
  if (after) await after;
  if (!current()) return;
  if (!path.length && !(await prepare())) return;
  if (!current()) return;
  if (value('drawing-tool') === 'door') {
    busy = true;
    tell('Tür wird gespeichert…');
    try {
      const target = doorRoom ? await doorRoom() : { room: roomOnFloor(), maxDistance: 0.5 };
      if (
        !owned(w.token, generation) ||
        revision !== draftRevision ||
        value('drawing-tool') !== 'door'
      )
        return;
      const f = floor(),
        r = target.room;
      if (!r || r.scopeId !== f.scopeId || r.floorId !== f.floorId)
        throw new Error('Eine Raumwand auf diesem Geschoss anklicken.');
      const anchor = nearestAnchor(p, r);
      if (!anchor || anchor.distance > target.maxDistance)
        throw new Error('Tür an einer Raumwand platzieren.');
      const a = r.polygons[anchor.polygon]!.outer[anchor.edge]!,
        b =
          r.polygons[anchor.polygon]!.outer[
            (anchor.edge + 1) % r.polygons[anchor.polygon]!.outer.length
          ]!;
      const e = newElement('door', f.scopeId, f.floorId, r.id, [
        { x: a.x + (b.x - a.x) * anchor.t, y: a.y + (b.y - a.y) * anchor.t },
      ]);
      e.anchor = { roomId: r.id, polygon: anchor.polygon, edge: anchor.edge, t: anchor.t };
      await execute({
        kind: 'element',
        element: e,
        expectedRevision: null,
        expectedRoom: { id: r.id, revision: r.revision },
      });
    } finally {
      if (owned(w.token, generation)) {
        busy = false;
        redraw();
      }
    }
    return;
  }
  path.push(atlasDrawingSnapPoint(p));
  preview = shape();
  redraw();
}
export function initDrawing(
  status: typeof tell,
  getContext: typeof context,
  getSelected: typeof selectedRoom,
  flush: typeof before,
  apply: typeof changed,
  draw: typeof redraw,
) {
  tell = status;
  context = getContext;
  selectedRoom = getSelected;
  before = flush;
  changed = apply;
  redraw = draw;
  const form = el('drawing-element-form'),
    properties = document.createElement('details'),
    summary = document.createElement('summary'),
    hint = document.createElement('p');
  properties.id = 'drawing-element-properties';
  summary.textContent = 'Koordinaten und weitere Eigenschaften';
  properties.append(summary);
  hint.id = 'drawing-path-edit-hint';
  hint.textContent =
    'Weiße Punkte ziehen: Verlauf ändern. Blaue Segmentmitte ziehen: Knickpunkt einfügen. Loslassen speichert; Escape verwirft.';
  hint.hidden = true;
  for (const node of [...form.children])
    if (
      node.tagName !== 'H3' &&
      node.tagName !== 'BUTTON' &&
      !node.querySelector('#drawing-element-name,#drawing-width,#drawing-color')
    )
      properties.append(node);
  form.querySelector('h3')!.after(hint);
  form.querySelector('button')!.before(properties);
  let selectedTool = value('drawing-tool');
  el('drawing-tool').addEventListener('change', () => {
    if (path.length || stroke !== null) {
      field('drawing-tool').value = selectedTool;
      tell('Dungeonzug zuerst abschließen oder verwerfen.', true);
      return;
    }
    selectedTool = value('drawing-tool');
    clearDraft();
    redraw();
  });
  field('drawing-append').addEventListener('change', syncToolControls);
  el('drawing-finish').onclick = () => run(finish);
  el('drawing-cancel').onclick = () => {
    clearDraft();
    if (value('drawing-tool') === 'door') field('drawing-tool').value = 'select';
    redraw();
  };
  el('drawing-refresh').onclick = () =>
    run(async () => {
      const w = context();
      if (!w || !(await prepare())) return;
      await changed(unwrap(await window.campaign.workspaceGeometry(w.token)));
      await reloadDrawing(true);
    });
  el('drawing-show-section').onchange = el('drawing-slice-y').oninput = drawSection;
  const map = el<SVGSVGElement>('map');
  map.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 || value('drawing-tool') === 'select') return;
      event.stopImmediatePropagation();
      event.preventDefault();
      run(async () => {
        if (value('drawing-tool') === 'door') {
          await atlasDrawingPoint(point(event));
          map.focus();
          return;
        }
        if (!path.length && !(await prepare())) return;
        const p = point(event);
        path.push(p);
        map.focus();
        if (['room-cave', 'room-erase', 'scatter'].includes(value('drawing-tool'))) {
          stroke = event.pointerId;
          map.setPointerCapture(stroke);
        }
        preview = shape();
        redraw();
      });
    },
    true,
  );
  map.addEventListener(
    'pointermove',
    (event) => {
      if (stroke !== event.pointerId) return;
      event.stopImmediatePropagation();
      const p = point(event);
      if (
        path.length &&
        Math.hypot(path.at(-1)!.x - p.x, path.at(-1)!.y - p.y) <
          Math.max(0.05, Number(value('drawing-brush')) / 4)
      )
        return;
      path.push(p);
      preview = shape();
      redraw();
    },
    true,
  );
  map.addEventListener(
    'pointerup',
    (event) => {
      if (stroke === event.pointerId) {
        event.stopImmediatePropagation();
        stroke = null;
      }
    },
    true,
  );
  map.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      run(finish);
    }
    if (event.key === 'Escape') {
      clearDraft();
      if (value('drawing-tool') === 'door') field('drawing-tool').value = 'select';
      redraw();
    }
  });
  el<HTMLFormElement>('drawing-element-form').onsubmit = (e) => {
    e.preventDefault();
    dirty = true;
    run(saveElement);
  };
  el('drawing-element-form').addEventListener('input', () => {
    dirty = true;
  });
  el('drawing-element-hide').onclick = () =>
    run(async () => {
      if (!element || !(await flushDrawing())) return;
      await execute({
        kind: 'element-hide',
        id: element.id,
        expectedRevision: element.revision,
        archived: true,
      });
      element = null;
      renderInspector();
    });
  el('drawing-transform').onclick = () =>
    run(async () => {
      const r = selectedRoom();
      if (!r) throw new Error('Raum auswählen.');
      let x = 0,
        y = 0,
        n = 0;
      for (const p of r.polygons.flatMap((p) => p.outer)) {
        x += p.x;
        y += p.y;
        n++;
      }
      x /= n;
      y /= n;
      const scale = Number(value('drawing-scale')),
        angle = (Number(value('drawing-rotate')) * Math.PI) / 180,
        dx = Number(value('drawing-dx')),
        dy = Number(value('drawing-dy'));
      if (!Number.isFinite(scale + angle + dx + dy) || scale <= 0)
        throw new Error('Positive Skalierung und gültige Pose eingeben.');
      const transform = (p: Point) => ({
        x: x + (p.x - x) * scale * Math.cos(angle) - (p.y - y) * scale * Math.sin(angle) + dx,
        y: y + (p.x - x) * scale * Math.sin(angle) + (p.y - y) * scale * Math.cos(angle) + dy,
      });
      await execute({
        kind: 'shape',
        roomId: r.id,
        expectedRevision: r.revision,
        transform: { dx, dy, scale, angle, origin: { x, y } },
        polygons: r.polygons.map((p) => ({
          outer: p.outer.map(transform),
          holes: p.holes.map((h) => h.map(transform)),
        })),
      });
    });
  el('drawing-merge').onclick = () =>
    run(async () => {
      const r = selectedRoom(),
        other = context()?.rooms.find((x) => x.id === value('drawing-merge-room'));
      if (!r || !other) throw new Error('Zwei Räume auswählen.');
      await execute({
        kind: 'merge',
        roomIds: [r.id, other.id],
        expectedRevisions: [r.revision, other.revision],
      });
    });
  el('drawing-hide-room').onclick = () =>
    run(async () => {
      const r = selectedRoom();
      if (r) await execute({ kind: 'room-hide', roomId: r.id, hidden: true });
    });
  for (const id of [
    'drawing-ceiling',
    'drawing-fill',
    'drawing-wall-color',
    'drawing-public-label',
    'drawing-room-secret',
    'drawing-track-surface',
  ])
    el(id).addEventListener('input', () => {
      styleDirty = true;
    });
  el('drawing-save-style').onclick = () =>
    run(async () => {
      styleDirty = true;
      await saveStyle();
    });
  for (const kind of ['add', 'clone', 'clone-all', 'rename', 'hide'])
    el('drawing-floor-' + kind).onclick = () =>
      run(async () => {
        const f = floor(),
          w = context()!,
          current = w.floors.find((x) => x.id === f.floorId && x.scopeId === f.scopeId),
          id =
            kind === 'add' || kind === 'clone' || kind === 'clone-all'
              ? crypto.randomUUID()
              : f.floorId;
        await execute({
          kind: 'floor',
          scopeId: f.scopeId,
          id,
          name: value('drawing-floor-name') || current?.name || 'Neues Geschoss',
          elevation: Number(value('drawing-floor-elevation')),
          cloneId: kind === 'clone' || kind === 'clone-all' ? f.floorId : null,
          copyKeys: kind === 'clone-all',
          hidden: kind === 'hide',
        });
        if (kind === 'add' || kind === 'clone' || kind === 'clone-all') {
          el<HTMLSelectElement>('floors').value = JSON.stringify([f.scopeId, id]);
          el('floors').dispatchEvent(new Event('change'));
          redraw();
        }
      });
  for (const format of ['svg', 'json', 'keys', 'document'] as const)
    el('drawing-export-' + format).onclick = () =>
      run(async () => {
        const w = context(),
          generation = editorSession.generation;
        if (!w) return;
        const f = floor(),
          publicOnly = field('drawing-public-export').checked;
        if (!(await prepare())) return;
        const response = await window.campaign.exportDrawing(
          w.token,
          f.scopeId,
          f.floorId,
          format,
          publicOnly,
        );
        if (owned(w.token, generation)) {
          const result = unwrap(response);
          tell(result.cancelled ? 'Dungeon-Ausgabe abgebrochen.' : 'Dungeon ausgegeben.');
        }
      });
  for (const action of ['activate', 'reset', 'correct'] as const)
    el('drawing-feature-' + action).onclick = () =>
      run(async () => {
        const w = context(),
          generation = editorSession.generation,
          id = element?.id,
          charges = action === 'correct' ? Number(value('drawing-correct-charges')) : null;
        if (!w || !id) return;
        if (!(await flushDrawing()) || !owned(w.token, generation) || element?.id !== id || !data)
          return;
        const expected = data.features.find((s) => s.id === id)?.revision ?? 0,
          response = await window.campaign.live(w.token);
        if (!owned(w.token, generation) || element?.id !== id) return;
        const live = unwrap(response);
        if (!live.focusId) throw new Error('Gruppe zuerst unter Party & Leiten fortsetzen.');
        const result = await window.campaign.activateFeature(
          w.token,
          id,
          live.focusId,
          expected,
          action,
          charges,
          crypto.randomUUID(),
        );
        if (!owned(w.token, generation) || element?.id !== id) return;
        data = unwrap(result);
        readRequest++;
        renderInspector();
        redraw();
        tell(
          action === 'activate'
            ? 'Tatsächliche Feature-Aktivierung bestätigt.'
            : 'Featurezustand aktualisiert.',
        );
      });
}

editorSession.observeDraft(() => ({
  openInput: dirty || styleDirty || path.length > 0 || stroke !== null,
  retainedDraft: false,
  unresolvedCommand: false,
}));
