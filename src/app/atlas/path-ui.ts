import { EditorSession } from '../editor-session';
import { atlasFieldValue, setAtlasFieldValue, lengthLabel } from './atlas-units';
import { atlasDrawingWrite } from './campaign-atlas-author';
import type { WorkspaceGeometry, Room } from '../contracts';
import type { DrawingView, DrawingAction } from './drawing-contracts';
import type {
  DungeonPath,
  PathPreview,
  ConnectionForm,
  PassageSide,
  DungeonPassage,
} from './path-contracts';
import { VOXEL_METERS as U } from './volume-contracts';
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
  draft: DungeonPath | null = null,
  sourceDraft: DungeonPath | null = null,
  sourceRevision: number | null = null,
  preview: PathPreview | null = null;
let readRequest = 0,
  editIntent = 0,
  writing = false;
let locations: { id: string; name: string }[] = [];
const formIds = [
  'path-name',
  'path-notes',
  'path-from',
  'path-to',
  'path-from-pin',
  'path-to-pin',
  'path-from-x',
  'path-from-y',
  'path-from-z',
  'path-from-face',
  'path-to-x',
  'path-to-y',
  'path-to-z',
  'path-to-face',
  'path-waypoints',
  'path-forms',
  'path-widths',
  'path-heights',
  'path-factors',
  'path-medium',
];
type Form = Record<string, string | boolean>;
let formBase: Form | null = null;
function snapshot(): Form {
  return Object.fromEntries(
    formIds.map((id) => [id, field(id).type === 'checkbox' ? field(id).checked : value(id)]),
  );
}
function restore(values: Form) {
  for (const [id, v] of Object.entries(values))
    if (typeof v === 'boolean') field(id).checked = v;
    else setAtlasFieldValue(field(id), v);
}
function sameForm(a: Form, b: Form) {
  return formIds.every((id) => a[id] === b[id]);
}
function pathDirty() {
  return !!draft && !!formBase && !sameForm(snapshot(), formBase);
}
function invalidatePreview() {
  editIntent++;
  preview = null;
  el<HTMLButtonElement>('path-commit').disabled = true;
  el('path-preview-status').textContent =
    'Eingaben geändert. Verbindung erneut vorschlagen lassen.';
  drawPreview();
}
function owner() {
  return { generation: editorSession.generation, token: workspace()?.token };
}
type Owner = ReturnType<typeof owner>;
function current(o: Owner) {
  return o.generation === editorSession.generation && o.token === workspace()?.token;
}
function run(fn: (o: Owner) => Promise<boolean>) {
  if (pendingWork.value) {
    tell('Laufenden Auftrag abwarten.');
    return;
  }
  const o = owner();
  const task = Promise.resolve()
    .then(() => (current(o) ? fn(o) : false))
    .catch((e) => {
      if (current(o)) tell(e.message, true);
      return false;
    })
    .finally(() => {
      if (pendingWork.value === task) {
        pendingWork.clear(task);
        writing = false;
      }
    });
  pendingWork.value = task;
}
function cancelRead() {
  editorSession.generation++;
  readRequest++;
  pendingWork.value = null;
  writing = false;
}
function choose(p: DungeonPath, revision: number | null) {
  draft = structuredClone(p);
  sourceDraft = structuredClone(p);
  sourceRevision = revision;
  preview = null;
  editIntent++;
  drawForm();
  formBase = snapshot();
}
function options(id: string, selection: string) {
  const s = el<HTMLSelectElement>(id);
  s.replaceChildren();
  for (const r of workspace()?.rooms.filter((r) => data?.volumes?.some((v) => v.roomId === r.id)) ??
    []) {
    const o = document.createElement('option');
    o.value = r.id;
    o.textContent = r.number + '. ' + r.name;
    s.append(o);
  }
  if (selection && ![...s.querySelectorAll('option')].some((o) => o.value === selection)) {
    const o = document.createElement('option');
    o.value = selection;
    o.textContent = 'Gespeicherter Endraum fehlt';
    s.append(o);
  }
  s.value = selection;
}
function newPath(selectedId = selected()?.id) {
  const rooms =
    workspace()?.rooms.filter((r) => data?.volumes?.some((v) => v.roomId === r.id)) ?? [];
  const from = rooms.find((r) => r.id === selectedId) ?? rooms[0],
    to = rooms.find((r) => r.id !== from?.id && r.scopeId === from?.scopeId);
  choose(
    {
      id: crypto.randomUUID(),
      revision: 0,
      scopeId: from?.scopeId ?? '',
      name: 'Neue Verbindung',
      notes: '',
      from: { roomId: from?.id ?? '', volumeId: null, pinned: false, local: null },
      to: { roomId: to?.id ?? '', volumeId: null, pinned: false, local: null },
      waypoints: [],
      segments: [{ form: 'corridor', widthSteps: 1, heightSteps: 2, factor: 1 }],
      medium: 'air',
      mode: 'path',
      roomId: null,
      volumeId: null,
      fromPassageId: crypto.randomUUID(),
      toPassageId: crypto.randomUUID(),
      basis: '',
      route: [],
    },
    null,
  );
}
function drawForm() {
  if (!draft) return;
  options('path-from', draft.from.roomId);
  options('path-to', draft.to.roomId);
  field('path-name').value = draft.name;
  el<HTMLTextAreaElement>('path-notes').value = draft.notes;
  field('path-from-pin').checked = draft.from.pinned;
  field('path-to-pin').checked = draft.to.pinned;
  for (const [prefix, anchor] of [
    ['from', draft.from],
    ['to', draft.to],
  ] as const) {
    for (const coord of ['x', 'y', 'z'] as const)
      setAtlasFieldValue(
        field('path-' + prefix + '-' + coord),
        anchor.local ? String(anchor.local[coord]) : '',
      );
    setAtlasFieldValue(field('path-' + prefix + '-face'), anchor.local?.face ?? 'east');
  }
  setAtlasFieldValue(
    field('path-waypoints'),
    draft.waypoints.map((p) => [p.x, p.y, p.z].join(', ')).join('\n'),
  );
  const names: Record<ConnectionForm, string> = {
    corridor: 'Korridor',
    stairs: 'Treppe',
    ramp: 'Rampe',
    ladder: 'Leiter',
    shaft: 'Schacht',
  };
  for (const [id, values] of [
    ['path-forms', draft.segments.map((s) => names[s.form])],
    ['path-widths', draft.segments.map((s) => s.widthSteps)],
    ['path-heights', draft.segments.map((s) => s.heightSteps)],
    ['path-factors', draft.segments.map((s) => s.factor)],
  ] as const)
    setAtlasFieldValue(field(id), values.join(', '));
  field('path-medium').value = draft.medium;
  el<HTMLButtonElement>('path-preview').disabled = draft.mode === 'area';
  el<HTMLButtonElement>('path-commit').disabled = !preview;
  el('path-preview-status').textContent = preview
    ? 'Vorschau ' +
      lengthLabel(preview.distanceMeters) +
      ' · ' +
      preview.volume.columns.length +
      ' Säulen · noch nicht übernommen'
    : 'Endräume wählen und Verbindung vorschlagen lassen.';
  drawPreview();
}
interface SideValues {
  description: string;
  seconds: string;
  kind: PassageSide['target']['kind'];
  targetId: string;
  passable: boolean;
  sight: boolean;
  light: boolean;
  sound: boolean;
}
const sideValues = (side: PassageSide): SideValues => ({
  description: side.description,
  seconds: String(side.additionalSeconds),
  kind: side.target.kind,
  targetId: side.target.id ?? '',
  passable: side.passable,
  sight: side.sight,
  light: side.light,
  sound: side.sound,
});
const sameSide = (a: SideValues, b: SideValues) =>
  Object.keys(a).every((key) => a[key as keyof SideValues] === b[key as keyof SideValues]);
const passageDrafts = new Map<
  string,
  { base: DungeonPassage; side: 'outbound' | 'inbound'; values: SideValues }
>();
function sideKey(id: string, side: string) {
  return id + ':' + side;
}
function acknowledgePassage(
  a: Extract<DrawingAction, { kind: 'passage' }>,
  submitted?: SideValues,
  submittedSide?: 'outbound' | 'inbound',
) {
  const confirmed = data?.passages?.find((p) => p.id === a.passage.id);
  if (!confirmed) return;
  for (const [key, d] of passageDrafts) {
    if (d.base.id !== confirmed.id || d.base.revision !== a.expectedRevision) continue;
    if (
      (d.side === submittedSide && submitted && sameSide(d.values, submitted)) ||
      sameSide(d.values, sideValues(confirmed[d.side]))
    )
      passageDrafts.delete(key);
    else d.base = confirmed;
  }
}
async function command(
  a: DrawingAction,
  o: Owner,
  confirmed?: (view: DrawingView) => void,
  side?: { key: 'outbound' | 'inbound'; values: SideValues },
) {
  if (!(await before()) || !current(o)) return false;
  const w = workspace();
  if (!w) return false;
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
  ++readRequest;
  const committedView = result.value.view;
  data = committedView;
  if (a.kind === 'passage') acknowledgePassage(a, side?.values, side?.key);
  await changed(result.value.workspace);
  if (!current(o)) return false;
  invalidatePreview();
  confirmed?.(committedView);
  drawList();
  return true;
}
function perform(
  a: DrawingAction,
  message: string,
  after?: (view: DrawingView) => void,
  side?: { key: 'outbound' | 'inbound'; values: SideValues },
) {
  const captured = structuredClone(a),
    submitted = side ? structuredClone(side) : undefined;
  run(async (o) => {
    if (!(await command(captured, o, after, submitted))) return false;
    tell(message);
    return true;
  });
}
function collect(): DungeonPath {
  if (!draft || !workspace()) throw new Error('Pfad öffnen.');
  const forms: Record<string, ConnectionForm> = {
    korridor: 'corridor',
    treppe: 'stairs',
    rampe: 'ramp',
    leiter: 'ladder',
    schacht: 'shaft',
    corridor: 'corridor',
    stairs: 'stairs',
    ramp: 'ramp',
    ladder: 'ladder',
    shaft: 'shaft',
  };
  const waypoints = value('path-waypoints').trim()
    ? value('path-waypoints')
        .trim()
        .split('\n')
        .map((line) => {
          const coordinates = line
            .trim()
            .split(/[;,\s]+/)
            .map(Number);
          if (coordinates.length !== 3 || coordinates.some((n) => !Number.isFinite(n)))
            throw new Error('Wegpunkte: je Zeile X, Y, Höhe in der gewählten Maßeinheit.');
          return { x: coordinates[0]!, y: coordinates[1]!, z: coordinates[2]! };
        })
    : [];
  const total = waypoints.length + 1;
  const series = (id: string) => {
    const entries = value(id)
      .split(',')
      .map((s) => s.trim());
    if (entries.some((v) => !v) || entries.length > total)
      throw new Error(
        'Je Segment einen Wert eingeben oder einen Wert für alle Segmente verwenden.',
      );
    return entries;
  };
  const names = series('path-forms').map((s) => forms[s.toLowerCase()]);
  const widths = series('path-widths').map(Number),
    heights = series('path-heights').map(Number),
    factors = series('path-factors').map(Number);
  if (
    names.some((n) => !n) ||
    [...widths, ...heights].some((n) => !Number.isInteger(n) || n < 1 || n > 20) ||
    factors.some((n) => !Number.isFinite(n) || n < 0.1 || n > 100)
  )
    throw new Error(
      'Segmentformen, Breite/Höhe (1–20 Schritte) und Zeitfaktor (0.1–100; Dezimalpunkt) prüfen.',
    );
  const anchor = (prefix: 'from' | 'to') => {
    const roomId = value('path-' + prefix),
      volume = data?.volumes?.find((v) => v.roomId === roomId);
    if (!volume) throw new Error('Endräume benötigen Volumen.');
    const coordinates = ['x', 'y', 'z'].map((c) => value('path-' + prefix + '-' + c));
    if (coordinates.some((s) => s !== '') && !coordinates.every((s) => s !== ''))
      throw new Error(
        'Anker benötigen X, Y und Höhe zusammen; für automatische Vorschläge alle drei leer lassen.',
      );
    const numbers = coordinates.map(Number);
    if (coordinates.every((s) => s !== '') && numbers.some((n) => !Number.isSafeInteger(n)))
      throw new Error('Anker benötigen ganze Rasterkoordinaten.');
    return {
      roomId,
      volumeId: volume.id,
      pinned: field('path-' + prefix + '-pin').checked,
      local: coordinates.every((s) => s !== '')
        ? {
            x: numbers[0]!,
            y: numbers[1]!,
            z: numbers[2]!,
            face: value('path-' + prefix + '-face') as import('./path-contracts').BoundaryFace,
          }
        : null,
    };
  };
  const from = anchor('from'),
    to = anchor('to'),
    volume = data!.volumes!.find((v) => v.id === from.volumeId)!;
  const segments = Array.from({ length: total }, (_, i) => ({
    form: names[i] ?? names.at(-1)!,
    widthSteps: widths[i] ?? widths.at(-1)!,
    heightSteps: heights[i] ?? heights.at(-1)!,
    factor: factors[i] ?? factors.at(-1)!,
  }));
  return {
    ...draft,
    scopeId: volume.scopeId,
    name: value('path-name'),
    notes: value('path-notes'),
    from,
    to,
    waypoints,
    segments,
    medium: value('path-medium') as 'air' | 'water',
  };
}
function drawPreview() {
  const svg = el<SVGSVGElement & HTMLElement>('path-map'),
    ns = 'http://www.w3.org/2000/svg';
  svg.replaceChildren();
  if (!preview) return;
  const points = preview.path.route.map((p) => ({
      x: (p.x + 0.5) * U,
      y: (p.y + 0.5) * U,
      z: p.z * U,
    })),
    all = [preview.fromWorld, ...points, preview.toWorld],
    minX = Math.min(...all.map((p) => p.x)) - U,
    minY = Math.min(...all.map((p) => p.y)) - U,
    maxX = Math.max(...all.map((p) => p.x)) + U,
    maxY = Math.max(...all.map((p) => p.y)) + U;
  svg.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
  const line = document.createElementNS(ns, 'polyline');
  line.setAttribute('points', all.map((p) => p.x + ',' + p.y).join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#b16d45');
  line.setAttribute('stroke-width', '.2');
  svg.append(line);
  for (const p of all) {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', String(p.x));
    c.setAttribute('cy', String(p.y));
    c.setAttribute('r', '.15');
    c.setAttribute('fill', '#497c92');
    svg.append(c);
  }
  for (const [p, label] of [
    [preview.fromWorld, 'A'],
    [preview.toWorld, 'B'],
  ] as const) {
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', String(p.x));
    t.setAttribute('y', String(p.y - 0.35));
    t.setAttribute('font-size', '.6');
    t.textContent = label + ' · ' + lengthLabel(p.z);
    svg.append(t);
  }
}
function drawList() {
  if (!data) return;
  const list = el('path-list');
  list.replaceChildren();
  for (const p of data.paths ?? []) {
    const card = document.createElement('article'),
      title = document.createElement('h3'),
      open = document.createElement('button'),
      convert = document.createElement('button');
    title.textContent = p.name + ' · ' + p.status;
    open.textContent = 'Pfad bearbeiten / neu vorschlagen';
    open.disabled = p.mode === 'area';
    open.onclick = () => {
      if (writing || pathDirty() || preview) {
        tell('Offene Pfadeingabe zuerst übernehmen oder verwerfen.', true);
        return;
      }
      cancelRead();
      choose(p, p.revision);
    };
    convert.textContent = 'In feste Area umwandeln';
    convert.disabled = p.mode === 'area';
    convert.onclick = () => {
      if (draft?.id === p.id && (pathDirty() || preview)) {
        tell('Offene Pfadeingabe zuerst übernehmen oder verwerfen.', true);
        return;
      }
      perform(
        { kind: 'path-convert', id: p.id, expectedRevision: p.revision },
        'Volumen bleibt erhalten; automatische Pfadführung beendet.',
        (view) => {
          const saved = view.paths?.find((x) => x.id === p.id);
          if (draft?.id === p.id && saved) choose(saved, saved.revision);
        },
      );
    };
    card.append(title, open, convert);
    list.append(card);
  }
  const passages = el('path-passages'),
    expanded = new Set(
      [...passages.querySelectorAll<HTMLElement>('details[open][data-passage-id]')].map(
        (e) => e.dataset.passageId,
      ),
    );
  passages.replaceChildren();
  for (const p of data.passages ?? []) {
    const details = document.createElement('details'),
      summary = document.createElement('summary');
    details.dataset.passageId = p.id;
    if (expanded.has(p.id)) details.setAttribute('open', '');
    summary.textContent =
      'Passage ' +
      (workspace()?.rooms.find((r) => r.id === p.roomId)?.name ?? p.roomId) +
      (p.assigned ? '' : ' · ungebunden');
    details.append(summary);
    for (const [key, title] of [
      ['outbound', 'Aus dem Endraum'],
      ['inbound', 'Zurück in den Endraum'],
    ] as const) {
      const entry = passageDrafts.get(sideKey(p.id, key)),
        base = entry?.base ?? p,
        initial = entry?.values ?? sideValues(p[key]);
      const section = document.createElement('fieldset'),
        legend = document.createElement('legend'),
        description = document.createElement('textarea'),
        seconds = document.createElement('input'),
        kind = document.createElement('select'),
        target = document.createElement('select'),
        save = document.createElement('button');
      section.dataset.passageId = p.id;
      section.dataset.side = key;
      legend.textContent =
        title + ' · ' + (data.passageStatuses?.find((s) => s.id === p.id)?.[key] ?? '');
      description.value = initial.description;
      description.setAttribute('aria-label', title + ' Beschreibung');
      seconds.type = 'number';
      seconds.min = '0';
      seconds.value = initial.seconds;
      seconds.setAttribute('aria-label', title + ' Zusatzzeit s');
      section.append(legend, description);
      const flags = {} as Record<'passable' | 'sight' | 'light' | 'sound', HTMLInputElement>;
      for (const [flag, label] of [
        ['passable', 'Begehbar'],
        ['sight', 'Sicht'],
        ['light', 'Licht'],
        ['sound', 'Schall'],
      ] as const) {
        const l = document.createElement('label'),
          input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = initial[flag];
        input.dataset.side = key;
        input.dataset.passageId = p.id;
        input.dataset.flag = flag;
        flags[flag] = input;
        l.append(input, label);
        section.append(l);
      }
      for (const [id, label] of [
        ['geometry', 'Geometrische Verbindung'],
        ['passage', 'Andere Passage'],
        ['location', 'Kampagnenort'],
      ]) {
        const option = document.createElement('option');
        option.value = id!;
        option.textContent = label!;
        kind.append(option);
      }
      kind.value = initial.kind;
      const targets = (selection: string) => {
        target.replaceChildren();
        const choices =
          kind.value === 'geometry'
            ? (workspace()?.rooms ?? []).map((r) => ({ id: r.id, name: r.number + '. ' + r.name }))
            : kind.value === 'passage'
              ? (data?.passages ?? [])
                  .filter((q) => q.id !== p.id)
                  .map((q) => ({
                    id: q.id,
                    name:
                      (workspace()?.rooms.find((r) => r.id === q.roomId)?.name ??
                        'Ungebundene Passage') +
                      ' · ' +
                      (q.anchor.local?.face ?? 'Fläche'),
                  }))
              : locations;
        for (const choice of [{ id: '', name: 'Ziel wählen' }, ...choices]) {
          const option = document.createElement('option');
          option.value = choice.id;
          option.textContent = choice.name;
          target.append(option);
        }
        if (selection && !choices.some((c) => c.id === selection)) {
          const missing = document.createElement('option');
          missing.value = selection;
          missing.textContent = 'Gespeichertes Ziel fehlt';
          target.append(missing);
        }
        target.value = selection;
      };
      const collectSide = (): SideValues => ({
        description: description.value,
        seconds: seconds.value,
        kind: kind.value as SideValues['kind'],
        targetId: target.value,
        passable: flags.passable.checked,
        sight: flags.sight.checked,
        light: flags.light.checked,
        sound: flags.sound.checked,
      });
      const remember = () => {
        const values = collectSide();
        if (sameSide(values, sideValues(base[key]))) passageDrafts.delete(sideKey(p.id, key));
        else passageDrafts.set(sideKey(p.id, key), { base, side: key, values });
      };
      description.oninput = remember;
      seconds.oninput = remember;
      for (const input of Object.values(flags)) input.onchange = remember;
      kind.onchange = () => {
        targets('');
        remember();
      };
      target.onchange = remember;
      targets(initial.targetId);
      target.setAttribute('aria-label', title + ' Ziel');
      save.textContent = title + ' übernehmen';
      save.onclick = () => {
        const values = collectSide(),
          basis = passageDrafts.get(sideKey(p.id, key))?.base ?? base;
        const updated: PassageSide = {
          description: values.description,
          additionalSeconds: Number(values.seconds),
          target: { kind: values.kind, id: values.targetId || null },
          passable: values.passable,
          sight: values.sight,
          light: values.light,
          sound: values.sound,
        };
        perform(
          {
            kind: 'passage',
            passage: { ...basis, [key]: updated },
            expectedRevision: basis.revision,
          },
          'Passagenseite gespeichert. Gegenrichtung bleibt unabhängig.',
          undefined,
          { key, values },
        );
      };
      section.append(seconds, kind, target, save);
      details.append(section);
    }
    const detach = document.createElement('button');
    detach.textContent = p.assigned ? 'Passagengeometrie entfernen' : 'Passage wieder zuordnen';
    detach.onclick = () =>
      perform(
        { kind: 'passage', passage: { ...p, assigned: !p.assigned }, expectedRevision: p.revision },
        'Passagenzuordnung gespeichert.',
      );
    details.append(detach);
    passages.append(details);
  }
}
function close() {
  if (writing || pathDirty() || preview || passageDrafts.size) {
    tell('Offene Eingaben zuerst übernehmen oder verwerfen; laufende Speicherung abwarten.', true);
    return false;
  }
  cancelRead();
  draft = null;
  sourceDraft = null;
  formBase = null;
  preview = null;
  el<HTMLDialogElement>('path-dialog').close();
  return true;
}
export function initPaths(
  status: typeof tell,
  w: typeof workspace,
  r: typeof selected,
  drain: typeof before,
  publish: typeof changed,
) {
  tell = status;
  workspace = w;
  selected = r;
  before = drain;
  changed = publish;
  const dialog = el<HTMLDialogElement>('path-dialog');
  const edit = (event: Event) => {
    if (formIds.includes((event.target as HTMLElement).id)) invalidatePreview();
  };
  dialog.addEventListener('input', edit);
  dialog.addEventListener('change', edit);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  el('path-open').onclick = () => {
    if (pendingWork.value) return;
    const selectedId = selected()?.id;
    dialog.showModal();
    el('path-preview-status').textContent = 'Verbindungen werden geladen …';
    run(async (o) => {
      if (!(await before()) || !current(o) || !(await openPaths()) || !current(o)) return false;
      newPath(selectedId);
      return true;
    });
  };
  el('path-close').onclick = () => {
    close();
  };
  el('path-new').onclick = () => {
    if (writing || pathDirty() || preview) {
      tell('Offene Pfadeingabe zuerst übernehmen oder verwerfen.', true);
      return;
    }
    cancelRead();
    newPath();
  };
  el('path-discard').onclick = () => {
    if (writing) {
      tell('Laufende Speicherung abwarten.', true);
      return;
    }
    cancelRead();
    passageDrafts.clear();
    preview = null;
    const saved = sourceRevision !== null ? data?.paths?.find((p) => p.id === draft?.id) : null;
    if (saved) choose(saved, saved.revision);
    else if (sourceDraft && formBase) {
      draft = structuredClone(sourceDraft);
      drawForm();
      restore(formBase);
      editIntent++;
    }
    drawList();
  };
  el('path-refresh').onclick = () =>
    run(async (o) => (!(await before()) || !current(o) ? false : openPaths()));
  el('path-preview').onclick = () => {
    try {
      const path = structuredClone(collect()),
        inputs = snapshot(),
        intent = editIntent;
      el('path-preview-status').textContent = 'Verbindung wird vorgeschlagen …';
      run(async (o) => {
        if (
          !(await before()) ||
          !current(o) ||
          intent !== editIntent ||
          !sameForm(inputs, snapshot())
        )
          return false;
        const w = workspace();
        if (!w) return false;
        const result = await window.campaign.previewPath(w.token, path);
        if (!current(o) || intent !== editIntent || !sameForm(inputs, snapshot())) return false;
        if (!result.ok) throw new Error(result.error);
        preview = result.value;
        draft = structuredClone(preview.path);
        drawForm();
        return true;
      });
    } catch (e) {
      tell((e as Error).message, true);
    }
  };
  el('path-commit').onclick = () => {
    if (!preview || !draft) return;
    const candidate = structuredClone(preview),
      inputs = snapshot(),
      id = draft.id,
      revision = sourceRevision;
    perform(
      { kind: 'path-publish', preview: candidate, expectedRevision: revision },
      'Pfadvolumen und beide Passagen gemeinsam übernommen.',
      (view) => {
        const saved = view.paths?.find((p) => p.id === id);
        if (!saved || draft?.id !== id) return;
        const currentInputs = snapshot();
        choose(saved, saved.revision);
        const changes = Object.fromEntries(
          formIds
            .filter((key) => currentInputs[key] !== inputs[key])
            .map((key) => [key, currentInputs[key]!]),
        );
        restore(changes);
      },
    );
  };
  el('passage-create').onclick = () => {
    try {
      const roomId = value('path-from'),
        v = data?.volumes?.find((v) => v.roomId === roomId);
      if (!v) throw new Error('Endraum A als Volumen wählen.');
      if (!['x', 'y', 'z'].every((c) => value('path-from-' + c) !== ''))
        throw new Error('Anker A mit ganzen X-/Y-/Z-Schritten und Grenzfläche setzen.');
      const inputs = snapshot(),
        anchor = {
          roomId,
          volumeId: v.id,
          pinned: true,
          local: {
            x: Number(value('path-from-x')),
            y: Number(value('path-from-y')),
            z: Number(value('path-from-z')),
            face: value('path-from-face') as import('./path-contracts').BoundaryFace,
          },
        };
      const side: PassageSide = {
        description: '',
        passable: true,
        sight: true,
        light: true,
        sound: true,
        additionalSeconds: 0,
        target: { kind: 'location', id: null },
      };
      const passage: DungeonPassage = {
        id: crypto.randomUUID(),
        revision: 0,
        scopeId: v.scopeId,
        roomId,
        volumeId: v.id,
        pathId: null,
        otherRoomId: null,
        anchor,
        widthSteps: Number(value('path-widths').split(',')[0]),
        heightSteps: Number(value('path-heights').split(',')[0]),
        outbound: structuredClone(side),
        inbound: structuredClone(side),
        assigned: true,
      };
      perform(
        { kind: 'passage', passage, expectedRevision: null },
        'Eigenständige Passage angelegt. Ziel und beide Seiten unten auswählen.',
        () => {
          if (formBase && sourceRevision === null)
            for (const key of [
              'path-from',
              'path-from-pin',
              'path-from-x',
              'path-from-y',
              'path-from-z',
              'path-from-face',
              'path-widths',
              'path-heights',
            ])
              formBase[key] = inputs[key]!;
        },
      );
    } catch (e) {
      tell((e as Error).message, true);
    }
  };
}
export async function openPaths() {
  const w = workspace(),
    o = owner(),
    request = ++readRequest;
  if (!w) return false;
  const result = await window.campaign.drawing(w.token);
  if (!current(o) || request !== readRequest) return false;
  if (!result.ok) throw new Error(result.error);
  const prep = await window.campaign.preparation(w.token, '');
  if (!current(o) || request !== readRequest) return false;
  if (!prep.ok) throw new Error(prep.error);
  locations = prep.value.locations
    .filter((l) => !l.trashed)
    .map((l) => ({ id: l.document.id, name: l.document.name }));
  data = result.value;
  drawList();
  return true;
}
export function activatePaths() {
  editorSession.generation++;
  readRequest++;
  editIntent++;
  pendingWork.value = null;
  writing = false;
  data = null;
  draft = null;
  sourceDraft = null;
  sourceRevision = null;
  formBase = null;
  preview = null;
  locations = [];
  passageDrafts.clear();
  el<HTMLDialogElement>('path-dialog').close();
}
export async function flushPaths() {
  const o = owner(),
    job = pendingWork.value;
  if (job && !(await job)) return false;
  if (!current(o)) return false;
  if (pathDirty() || preview || passageDrafts.size) {
    tell('Offene Pfad-/Passageneingaben zuerst übernehmen oder verwerfen.', true);
    return false;
  }
  return true;
}
