import { openUpdates } from '../workspace/update-ui';
import type { Result } from '../shared/contracts';
import type {
  GeneratorRegistry,
  GeneratorPreset,
  PresetAction,
  PresetCommand,
  PresetReceipt,
} from './generation-contracts';
import {
  generatorRoles,
  generatorChallengeRatings,
  roleAt,
  updateRoleCell,
  type GeneratorRoleCell,
} from './generation/model';
import { checkedGeneratorConfig } from './generation/config';
import { presetWithFixedCount } from './preset-fixed-count';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T,
  value = (id: string) => get<HTMLInputElement>(id).value;
const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
let registry: GeneratorRegistry | null = null,
  presetDraft: GeneratorPreset | null = null,
  presetBaseline = '',
  campaignId: string | null = null,
  generation = 0,
  busy = false,
  initialized = false,
  conflict = false,
  focus: HTMLElement | null = null;
let brush: GeneratorRoleCell = 'standard',
  painting = false,
  paintFrame: number | null = null,
  paintCells = new Map<string, HTMLButtonElement>();
let discard: () => void = () => {},
  pending: PresetCommand | null = null;
const key = 'generator-registry-pending';
const weights = ['trivial', 'easy', 'medium', 'hard', 'deadly'] as const;
const labels = ['Trivial', 'Leicht', 'Mittel', 'Schwer', 'Tödlich'];
const dirty = () => !!presetDraft && JSON.stringify(presetDraft) !== presetBaseline;
const status = (s: string) => {
  get('preset-status').textContent = s;
};
function options() {
  const list = get<HTMLSelectElement>('preset-selection');
  list.replaceChildren();
  for (const p of registry?.presets ?? []) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name + (p.system ? ' · geschützt' : '');
    list.append(o);
  }
  if (presetDraft && !registry?.presets.some((p) => p.id === presetDraft!.id)) {
    const o = document.createElement('option');
    o.value = presetDraft.id;
    o.textContent = presetDraft.name + ' · Entwurf';
    list.append(o);
  }
  list.value = presetDraft?.id ?? registry?.effectiveId ?? '';
  get('preset-effective').textContent = !registry
    ? busy
      ? 'Generatorregeln und Zuweisung werden geladen…'
      : 'Generatorregeln und Zuweisung nicht verfügbar.'
    : campaignId
      ? 'Wirksam für die gewählte Kampagne: ' +
        (registry?.presets.find((p) => p.id === registry?.effectiveId)?.name ?? 'Systempreset')
      : 'Installation · keine Kampagnenzuweisung ausgewählt';
}
// Extension installation owns its own registry and persisted recovery state.
function lock() {
  get('preset-form').hidden = !presetDraft;
  for (const c of get('preset-manager').querySelectorAll<
    HTMLInputElement | HTMLButtonElement | HTMLSelectElement
  >('button:not(#extensions-open),input,select,textarea'))
    c.disabled = busy || !!pending;
  if (!busy && !pending) {
    if (presetDraft) renderPreset();
    get<HTMLButtonElement>('preset-save').disabled = !presetDraft || presetDraft.system || conflict;
    if (!presetDraft)
      for (const id of ['preset-copy', 'preset-reset', 'preset-delete', 'preset-assign'])
        get<HTMLButtonElement>(id).disabled = true;
    get<HTMLButtonElement>('preset-conflict-load').disabled = !conflict;
    get<HTMLButtonElement>('preset-conflict-copy').disabled = !conflict;
  }
  get<HTMLButtonElement>('preset-check').hidden = !pending;
  get<HTMLButtonElement>('preset-check').disabled = busy;
  get('preset-conflict').hidden = !conflict;
}
function choose(id: string) {
  clearPaint();
  const p = registry?.presets.find((p) => p.id === id);
  if (!p) return;
  presetDraft = structuredClone(p);
  presetBaseline = JSON.stringify(presetDraft);
  conflict = false;
  options();
  lock();
  status('Kopieren und Speichern ändern keine Kampagnenzuweisung.');
}
function confirmDiscard(run: () => void) {
  if (dirty()) {
    discard = run;
    get<HTMLDialogElement>('preset-discard').showModal();
  } else run();
}
function close() {
  if (busy || pending) return;
  flushBoundary();
  finishPaint();
  confirmDiscard(() => {
    clearPaint();
    generation++;
    get<HTMLDialogElement>('preset-manager').close();
    presetDraft = null;
    focus?.focus();
    window.dispatchEvent(new Event('generator-registry-changed'));
  });
}
async function reload(nextCampaignId = campaignId) {
  // Assignment identity and its registry snapshot are one confirmed read.
  try {
    const next = unwrap(await window.campaign.presetRegistry(nextCampaignId));
    registry = next;
    campaignId = nextCampaignId;
    options();
  } finally {
    get<HTMLSelectElement>('preset-context').value = campaignId ?? '';
  }
}
function copy() {
  if (!presetDraft) return;
  clearPaint();
  presetDraft = {
    ...structuredClone(presetDraft),
    id: crypto.randomUUID(),
    revision: 0,
    system: false,
    name: presetDraft.name + ' (Kopie)',
  };
  conflict = false;
  options();
  lock();
  status('Neue Kopie. Erst speichern, danach ausdrücklich zuweisen.');
}
function clearPending() {
  pending = null;
  localStorage.removeItem(key);
}
async function accepted(receipt: PresetReceipt) {
  clearPending();
  registry = receipt.registry;
  if (receipt.kind === 'preset-save' && receipt.preset) {
    presetDraft = structuredClone(receipt.preset);
    presetBaseline = JSON.stringify(presetDraft);
  } else if (receipt.kind === 'preset-delete' || !presetDraft) choose(registry!.effectiveId);
  conflict = false;
  options();
  status(
    receipt.kind === 'preset-assign'
      ? 'Zuweisung gespeichert.'
      : receipt.kind === 'preset-delete'
        ? 'Preset gelöscht. ' +
          receipt.affectedCampaignIds.length +
          ' Kampagne(n) verwenden jetzt das Systempreset.'
        : 'Preset gespeichert. Kampagnenzuweisungen bleiben unverändert.',
  );
}
async function execute(action: PresetAction) {
  if (busy || pending) return;
  busy = true;
  status('Presetauftrag wird gespeichert…');
  pending = { commandId: crypto.randomUUID(), campaignId, action: structuredClone(action) };
  localStorage.setItem(key, JSON.stringify(pending));
  lock();
  try {
    const result = await window.campaign.presetCommand(pending);
    if (result.ok) {
      await accepted(result.value);
      return;
    }
    const outcome = unwrap(await window.campaign.presetOutcome(pending));
    if (outcome) {
      await accepted(outcome);
      return;
    }
    clearPending();
    await reload();
    conflict = action.kind === 'preset-save' && /geändert/.test(result.error);
    status(
      conflict
        ? 'Registry wurde geändert. Dein Entwurf bleibt erhalten. Neueste Version laden oder als neue Kopie speichern.'
        : result.error,
    );
  } catch (e) {
    status(
      (e as Error).message +
        (pending
          ? ' · Ergebnis offen. Nur Buchungsstatus prüfen.'
          : ' · Auftrag wurde nicht gebucht; Entwurf bleibt erhalten.'),
    );
  } finally {
    busy = false;
    options();
    lock();
  }
}
async function check() {
  if (!pending || busy) return;
  busy = true;
  lock();
  try {
    const receipt = unwrap(await window.campaign.presetOutcome(pending));
    if (receipt) await accepted(receipt);
    else {
      clearPending();
      await reload();
      status(
        'Kein Beleg vorhanden. Entwurf erhalten; neuer Versuch erfordert einen bewussten Klick.',
      );
    }
  } catch (e) {
    status((e as Error).message);
  } finally {
    busy = false;
    lock();
  }
}
function renderMatrix() {
  if (!presetDraft) return;
  const root = get('preset-matrix');
  root.replaceChildren();
  const header = document.createElement('div');
  header.className = 'preset-matrix-row preset-matrix-header';
  const caption = document.createElement('span');
  caption.textContent = 'Level';
  header.append(caption);
  for (const cr of generatorChallengeRatings) {
    const c = document.createElement('span');
    c.textContent = cr;
    header.append(c);
  }
  root.append(header);
  for (let level = 1; level <= 20; level++) {
    const row = document.createElement('div');
    row.className = 'preset-matrix-row';
    const caption = document.createElement('span');
    caption.textContent = String(level);
    row.append(caption);
    for (let cr = 0; cr < 34; cr++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.level = String(level);
      button.dataset.cr = String(cr);
      cellAppearance(button, roleAt(presetDraft.config.composition.roleMatrix, level, cr));
      button.disabled = presetDraft.system;
      button.onpointerdown = (event) => {
        if (presetDraft?.system) return;
        event.preventDefault();
        button.focus();
        painting = true;
        queuePaint(button, event.button === 2 ? 'none' : brush);
      };
      button.onpointerenter = (event) => {
        if (painting && (event.buttons & 1 || event.buttons & 2))
          queuePaint(button, event.buttons & 2 ? 'none' : brush);
      };
      button.oncontextmenu = (event) => event.preventDefault();
      button.onkeydown = (event) => {
        let target = cr,
          nextLevel = level;
        if (event.key === 'ArrowRight') target++;
        else if (event.key === 'ArrowLeft') target--;
        else if (event.key === 'ArrowUp') nextLevel--;
        else if (event.key === 'ArrowDown') nextLevel++;
        else if (event.key === 'Home') target = 0;
        else if (event.key === 'End') target = 33;
        else if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          finishPaint();
          paint(button, brush);
          return;
        } else return;
        event.preventDefault();
        get('preset-matrix')
          .querySelector<HTMLButtonElement>(
            'button[data-level="' +
              Math.max(1, Math.min(20, nextLevel)) +
              '"][data-cr="' +
              Math.max(0, Math.min(33, target)) +
              '"]',
          )
          ?.focus();
      };
      row.append(button);
    }
    root.append(row);
  }
}
function cellAppearance(button: HTMLButtonElement, role: GeneratorRoleCell) {
  button.dataset.role = role;
  button.textContent = (
    { none: '·', minion: 'M', support: 'S', standard: 'N', elite: 'E', boss: 'B' } as const
  )[role];
  button.setAttribute(
    'aria-label',
    'Level ' +
      button.dataset.level +
      ', HG ' +
      generatorChallengeRatings[Number(button.dataset.cr)] +
      ', ' +
      role,
  );
  button.title = button.getAttribute('aria-label')!;
}
function paint(button: HTMLButtonElement, role: GeneratorRoleCell) {
  if (!presetDraft || presetDraft.system) return;
  presetDraft.config.composition.roleMatrix = updateRoleCell(
    presetDraft.config.composition.roleMatrix,
    Number(button.dataset.level),
    Number(button.dataset.cr),
    role,
  );
  cellAppearance(button, role);
  get<HTMLButtonElement>('preset-assign').disabled = true;
}
function clearPaint() {
  if (paintFrame !== null) cancelAnimationFrame(paintFrame);
  paintFrame = null;
  paintCells.clear();
  painting = false;
}
function finishPaint() {
  if (paintFrame !== null) cancelAnimationFrame(paintFrame);
  paintFrame = null;
  for (const b of paintCells.values()) paint(b, b.dataset.pendingRole as GeneratorRoleCell);
  paintCells.clear();
}
function queuePaint(button: HTMLButtonElement, role: GeneratorRoleCell) {
  button.dataset.pendingRole = role;
  paintCells.set(button.dataset.level + '|' + button.dataset.cr, button);
  if (paintFrame === null) {
    const draft = presetDraft,
      g = generation;
    paintFrame = requestAnimationFrame(() => {
      if (g === generation && presetDraft === draft) finishPaint();
      else clearPaint();
    });
  }
}

function renderPreset() {
  if (!presetDraft) return;
  get<HTMLInputElement>('preset-name').value = presetDraft.name;
  renderMatrix();
  const c = presetDraft.config;
  for (const role of generatorRoles)
    for (const bound of ['min', 'max'] as const)
      get<HTMLInputElement>('preset-' + role + '-' + bound).value = String(
        c.composition.roleQuantities[role][bound],
      );
  for (const key of ['crBlocks', 'statblocks'] as const)
    for (const bound of ['min', 'max'] as const)
      get<HTMLInputElement>('preset-' + key + '-' + bound).value = String(
        c.composition[key][bound],
      );
  for (const key of ['monsters', 'initiativeSlots'] as const)
    for (const bound of ['min', 'max'] as const) {
      get<HTMLInputElement>('preset-' + key + '-' + bound).value = String(
        c.composition[key][bound].value,
      );
      get<HTMLInputElement>('preset-' + key + '-' + bound + '-scaled').checked =
        c.composition[key][bound].perPlayer;
    }
  get<HTMLSelectElement>('preset-mixing').value = c.composition.mixing;
  get<HTMLInputElement>('preset-mob').value = String(c.combat.mobThreshold);
  get<HTMLTextAreaElement>('preset-combinations').value = c.composition.roleCombinations
    .map((r) => r.join(' + '))
    .join('\n');
  for (const k of ['difficulty', 'amount', 'balance', 'diversity'] as const)
    get<HTMLSelectElement>('preset-default-' + k).value = c.generationDefaults[k];
  for (const k of ['trivial', 'easy', 'medium', 'hard', 'deadly'] as const)
    get<HTMLInputElement>('preset-weight-' + k).value = String(c.scene.difficultyWeights[k]);
  for (const control of get('preset-form').querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >('input,select,textarea'))
    control.disabled = presetDraft.system;
  get<HTMLButtonElement>('preset-save').disabled = presetDraft.system;
  get<HTMLButtonElement>('preset-delete').disabled = presetDraft.system || !presetDraft.revision;
  get<HTMLButtonElement>('preset-assign').disabled =
    !presetDraft.revision || !campaignId || dirty();
  get<HTMLButtonElement>('preset-reset').disabled = presetDraft.system;
  get<HTMLButtonElement>('preset-fixed-apply').disabled = presetDraft.system || conflict;
  renderWeights();
}
function readPresetFields() {
  finishPaint();
  if (!presetDraft || presetDraft.system) return;
  const c = presetDraft.config;
  presetDraft.name = value('preset-name');
  const option = Array.from(get<HTMLSelectElement>('preset-selection').options).find(
    (o) => o.value === presetDraft!.id,
  );
  if (option) option.textContent = presetDraft.name + (!presetDraft.revision ? ' · Entwurf' : '');
  for (const role of generatorRoles)
    for (const bound of ['min', 'max'] as const)
      c.composition.roleQuantities[role][bound] = Number(value('preset-' + role + '-' + bound));
  for (const key of ['crBlocks', 'statblocks'] as const)
    for (const bound of ['min', 'max'] as const)
      c.composition[key][bound] = Number(value('preset-' + key + '-' + bound));
  for (const key of ['monsters', 'initiativeSlots'] as const)
    for (const bound of ['min', 'max'] as const)
      c.composition[key][bound] = {
        value: Number(value('preset-' + key + '-' + bound)),
        perPlayer: get<HTMLInputElement>('preset-' + key + '-' + bound + '-scaled').checked,
      };
  c.composition.mixing = value('preset-mixing') as typeof c.composition.mixing;
  c.combat.mobThreshold = Number(value('preset-mob'));
  c.composition.roleCombinations = value('preset-combinations')
    .split('\n')
    .filter((s) => s.trim())
    .map(
      (s) => s.split('+').map((r) => r.trim()) as (typeof c.composition.roleCombinations)[number],
    );
  for (const k of ['difficulty', 'amount', 'balance', 'diversity'] as const)
    (c.generationDefaults as unknown as Record<string, string>)[k] = value('preset-default-' + k);
  for (const k of ['trivial', 'easy', 'medium', 'hard', 'deadly'] as const)
    c.scene.difficultyWeights[k] = Number(value('preset-weight-' + k));
  renderWeights();
  get<HTMLButtonElement>('preset-assign').disabled =
    !presetDraft.revision || !campaignId || dirty();
}
function renderWeights() {
  const c = presetDraft?.config.scene.difficultyWeights;
  if (!c) return;
  let sum = 0;
  const track = get('preset-weight-track');
  // Keep invalid typed values editable without placing separators beyond the dialog.
  const valid =
    weights.every((k) => Number.isSafeInteger(c[k]) && c[k] >= 0) &&
    weights.reduce((n, k) => n + c[k], 0) === 100;
  track.style.visibility = valid ? '' : 'hidden';
  if (!valid) return;
  if (!track.children.length) {
    for (let i = 0; i < 4; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.separator = String(i);
      b.setAttribute('role', 'separator');
      b.setAttribute('aria-orientation', 'vertical');
      b.setAttribute('aria-label', labels[i] + ' / ' + labels[i + 1]);
      b.onkeydown = (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          moveBoundary(
            i,
            Number(b.getAttribute('aria-valuenow')) +
              (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 5 : 1),
          );
        }
      };
      b.onpointerdown = (e) => {
        if (b.disabled) return;
        e.preventDefault();
        b.focus();
        b.setPointerCapture(e.pointerId);
        drag = e.pointerId;
        dragIndex = i;
        queueBoundary(e.clientX);
      };
      b.onpointermove = (e) => {
        if (drag === e.pointerId) queueBoundary(e.clientX);
      };
      b.onpointerup = (e) => {
        if (drag === e.pointerId) {
          flushBoundary();
          drag = null;
          b.releasePointerCapture(e.pointerId);
        }
      };
      b.onlostpointercapture = () => {
        flushBoundary();
        drag = null;
      };
      track.append(b);
    }
  }
  for (let i = 0; i < 4; i++) {
    sum += c[weights[i]!];
    const b = track.children[i] as HTMLButtonElement,
      lo = sum - c[weights[i]!],
      hi = sum + c[weights[i + 1]!];
    b.style.left = sum + '%';
    b.setAttribute('aria-valuemin', String(lo));
    b.setAttribute('aria-valuemax', String(hi));
    b.setAttribute('aria-valuenow', String(sum));
    b.textContent = String(sum);
    b.disabled = !!presetDraft?.system || busy || !!pending;
  }
  track.style.background = 'linear-gradient(to right, var(--surface) 0%, var(--selected) 100%)';
}
let drag: number | null = null,
  dragIndex = 0,
  dragX: number | null = null,
  weightFrame: number | null = null;
function queueBoundary(x: number) {
  dragX = x;
  if (weightFrame === null) weightFrame = requestAnimationFrame(flushBoundary);
}
function flushBoundary() {
  if (weightFrame !== null) cancelAnimationFrame(weightFrame);
  weightFrame = null;
  if (dragX === null) return;
  const x = dragX;
  dragX = null;
  const box = get('preset-weight-track').getBoundingClientRect();
  if (box.width) moveBoundary(dragIndex, Math.round(((x - box.left) * 100) / box.width));
}
function moveBoundary(index: number, target: number) {
  if (!presetDraft || presetDraft.system || busy || pending) return;
  finishPaint();
  const c = presetDraft.config.scene.difficultyWeights,
    lo = weights.slice(0, index).reduce((n, k) => n + c[k], 0),
    pair = c[weights[index]!] + c[weights[index + 1]!],
    v = Math.max(lo, Math.min(lo + pair, target));
  c[weights[index]!] = v - lo;
  c[weights[index + 1]!] = pair - (v - lo);
  for (const k of weights) get<HTMLInputElement>('preset-weight-' + k).value = String(c[k]);
  renderWeights();
  get<HTMLButtonElement>('preset-assign').disabled = true;
}
function init() {
  if (initialized) return;
  initialized = true;
  get('preset-fixed-count').onkeydown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      get<HTMLButtonElement>('preset-fixed-apply').click();
    }
  };
  get('preset-fixed-apply').onclick = () => {
    if (!presetDraft || presetDraft.system || busy || pending || conflict) return;
    try {
      readPresetFields();
      presetDraft.config = presetWithFixedCount(
        presetDraft.config,
        Number(value('preset-fixed-count')),
      );
      renderPreset();
      get<HTMLButtonElement>('preset-assign').disabled = true;
      status(
        'Feste Gegnerzahl im Entwurf übernommen. Preset speichern, um sie dauerhaft zu verwenden.',
      );
    } catch (error) {
      status((error as Error).message);
    }
  };
  const updates = document.createElement('button');
  updates.type = 'button';
  updates.textContent = 'Updates';
  updates.id = 'settings-updates';
  updates.onclick = () => {
    if (busy || pending) return;
    flushBoundary();
    finishPaint();
    if (dirty()) {
      status(
        'Preset zuerst speichern oder die Bearbeitung ausdrücklich verwerfen, bevor du Updates öffnest.',
      );
      return;
    }
    // The workspace close guard correctly refuses an open preset editor.
    // Finish its normal lifecycle before opening the update dialog.
    close();
    if (get<HTMLDialogElement>('preset-manager').open) return;
    get(
      document.body.classList.contains('atlas-workspace')
        ? 'atlas-navigation'
        : 'application-trigger',
    ).focus();
    openUpdates();
  };
  get('preset-close').before(updates);
  get('preset-close').onclick = close;
  get<HTMLDialogElement>('preset-manager').oncancel = (e) => {
    e.preventDefault();
    close();
  };
  get('preset-discard-keep').onclick = () => get<HTMLDialogElement>('preset-discard').close();
  get('preset-discard-confirm').onclick = () => {
    get<HTMLDialogElement>('preset-discard').close();
    discard();
  };
  get('preset-selection').onchange = () => {
    const id = value('preset-selection');
    get<HTMLSelectElement>('preset-selection').value = presetDraft?.id ?? '';
    finishPaint();
    confirmDiscard(() => choose(id));
  };
  get('preset-context').onchange = () => {
    if (busy || pending) return;
    const nextCampaignId = value('preset-context') || null;
    get<HTMLSelectElement>('preset-context').value = campaignId ?? '';
    busy = true;
    status('Kampagnenzuweisung wird geladen…');
    lock();
    void reload(nextCampaignId)
      .then(() =>
        status('Kampagnenzuweisung geladen. Der bearbeitete Presetentwurf bleibt unverändert.'),
      )
      .catch((e) => status(e.message))
      .finally(() => {
        busy = false;
        lock();
      });
  };
  get('preset-copy').onclick = () => {
    if (busy || pending) return;
    readPresetFields();
    copy();
  };
  get('preset-reset').onclick = () => {
    if (!presetDraft || presetDraft.system || busy || pending) return;
    clearPaint();
    presetDraft.config = structuredClone(registry!.presets.find((p) => p.system)!.config);
    renderPreset();
  };
  get('preset-form').oninput = () => {
    if (!busy && !pending) readPresetFields();
  };
  get('preset-form').onsubmit = (e) => {
    e.preventDefault();
    if (!presetDraft || presetDraft.system || !registry || busy || pending || conflict) return;
    try {
      flushBoundary();
      readPresetFields();
      checkedGeneratorConfig(presetDraft.config);
      void execute({
        kind: 'preset-save',
        preset: presetDraft,
        expectedRegistryRevision: registry.revision,
      });
    } catch (error) {
      status((error as Error).message);
    }
  };
  get('preset-assign').onclick = () => {
    if (presetDraft && registry && campaignId && !dirty())
      void execute({
        kind: 'preset-assign',
        id: presetDraft.id,
        expectedRegistryRevision: registry.revision,
      });
  };
  get('preset-delete').onclick = () => {
    if (presetDraft && registry && !presetDraft.system)
      void execute({
        kind: 'preset-delete',
        id: presetDraft.id,
        expectedRegistryRevision: registry.revision,
      });
  };
  get('preset-conflict-load').onclick = () =>
    choose(
      registry?.presets.some((p) => p.id === presetDraft?.id)
        ? presetDraft!.id
        : registry!.effectiveId,
    );
  get('preset-conflict-copy').onclick = () => {
    if (busy || pending || !registry || !presetDraft) return;
    readPresetFields();
    copy();
    try {
      checkedGeneratorConfig(presetDraft.config);
      void execute({
        kind: 'preset-save',
        preset: presetDraft,
        expectedRegistryRevision: registry.revision,
      });
    } catch (error) {
      status((error as Error).message);
    }
  };
  get('preset-check').onclick = () => void check();
  for (const b of get('preset-brushes').querySelectorAll<HTMLButtonElement>('button'))
    b.onclick = () => {
      brush = b.dataset.role as GeneratorRoleCell;
      for (const peer of get('preset-brushes').querySelectorAll('button'))
        peer.setAttribute('aria-pressed', String(peer === b));
    };
  get('preset-manager').addEventListener('pointerup', () => {
    painting = false;
  });
}
let stylesheet: Promise<void> | null = null;
function styles() {
  return (stylesheet ??= new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'preset-settings.css';
    link.onload = () => resolve();
    link.onerror = () => {
      stylesheet = null;
      link.remove();
      reject(new Error('Generatorstylesheet konnte nicht geladen werden.'));
    };
    document.head.append(link);
  }));
}
export async function openPresetSettings(contextId: string | null = null, id?: string) {
  await styles();
  init();
  if (get<HTMLDialogElement>('preset-manager').open) return;
  focus = document.activeElement as HTMLElement;
  generation++;
  clearPaint();
  try {
    pending = JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    pending = null;
  }
  campaignId = pending ? pending.campaignId : contextId;
  registry = null;
  conflict = false;
  busy = true;
  presetDraft = null;
  get('preset-context').replaceChildren();
  options();
  status('Generatorregeln werden geladen…');
  get<HTMLDialogElement>('preset-manager').showModal();
  lock();
  try {
    const campaigns = unwrap(await window.campaign.campaignOverview()).filter((c) => !c.trashed),
      select = get<HTMLSelectElement>('preset-context');
    select.replaceChildren();
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Keine · nur installationsweite Regeln bearbeiten';
    select.append(empty);
    for (const c of campaigns) {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name + ' · ' + c.id.slice(0, 8);
      select.append(o);
    }
    select.value = campaignId ?? '';
    await reload();
    choose(id && registry!.presets.some((p) => p.id === id) ? id : registry!.effectiveId);
    if (pending?.action.kind === 'preset-save') {
      presetDraft = structuredClone(pending.action.preset);
    }
    if (pending) status('Offener Presetauftrag. Buchungsstatus prüfen, bevor du fortfährst.');
  } catch (e) {
    status((e as Error).message);
  } finally {
    busy = false;
    options();
    lock();
  }
}
