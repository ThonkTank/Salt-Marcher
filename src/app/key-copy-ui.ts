import type { Room } from './contracts';
import type { DungeonGeometry } from './atlas/dungeon-contracts';
import type { KeyContent, KeyAction, KeyCopyOptions } from './key-contracts';
import { emptyKey } from './key-contracts';
import { copyKeyPatch, keyCopyDependencies, keyCopyFields } from './key-copy-model';
import { renderDungeonKey } from './key-model';

interface CopyContext {
  identity: string;
  source: Room;
  rooms: Room[];
  records: KeyContent[];
  geometry: DungeonGeometry;
  targets: string[];
}
interface CopyPorts {
  context(): CopyContext | null;
  prepare(): Promise<boolean>;
  commit(action: Extract<KeyAction, { kind: 'key-copy' }>): Promise<boolean>;
}
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const node = (tag: string, text?: string) => {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  return n;
};
let ports: CopyPorts,
  serial = 0,
  prepared: {
    identity: string;
    selection: string;
    action: Extract<KeyAction, { kind: 'key-copy' }>;
  } | null = null;
const selection = (c: CopyContext) =>
  c.targets
    .filter((id) => id !== c.source.id)
    .sort()
    .join('|');
export function invalidateKeyCopy() {
  serial++;
  prepared = null;
  const apply = document.getElementById('key-copy-apply') as HTMLButtonElement | null;
  if (apply) apply.disabled = true;
  const result = document.getElementById('key-copy-preview');
  if (result) result.replaceChildren();
}
export function syncKeyCopyControl() {
  const apply = document.getElementById('key-copy-apply') as HTMLButtonElement | null;
  if (apply) apply.disabled = !prepared;
}
function options(): KeyCopyOptions {
  return {
    fields: [...el('key-copy-fields').querySelectorAll<HTMLInputElement>('input:checked')].map(
      (i) => i.value as KeyCopyOptions['fields'][number],
    ),
    mode: el<HTMLSelectElement>('key-copy-mode').value as KeyCopyOptions['mode'],
    attributes: el<HTMLSelectElement>('key-copy-attributes').value as KeyCopyOptions['attributes'],
  };
}
async function preview() {
  invalidateKeyCopy();
  const request = serial,
    initial = ports.context();
  if (!initial) {
    el('key-copy-status').textContent = 'Einen Quellraum öffnen.';
    return;
  }
  el('key-copy-status').textContent = 'Aktuelle Quelle und Zielräume werden geladen…';
  try {
    if (!(await ports.prepare()) || request !== serial) return;
    const c = ports.context();
    if (!c || c.identity !== initial.identity) return;
    const targets = c.rooms.filter((r) => r.id !== c.source.id && c.targets.includes(r.id));
    if (!targets.length || targets.length > 100)
      throw new Error('1–100 Zielräume links markieren; der geöffnete Quellraum wird ausgelassen.');
    const config = options(),
      guard = (r: Room) => ({
        id: r.id,
        expectedRevision: r.revision,
        keyRevision: c.records.find((k) => k.id === r.id && k.kind === 'room')?.revision ?? null,
      });
    const action: Extract<KeyAction, { kind: 'key-copy' }> = {
      kind: 'key-copy',
      source: guard(c.source),
      dependencies: keyCopyDependencies(c.source, c.records, config),
      rooms: targets.map(guard),
      options: config,
    };
    const result = el('key-copy-preview');
    let index = 0;
    for (const target of targets) {
      const patch = copyKeyPatch(
          c.source,
          target,
          c.records,
          config,
          () => `preview:${target.id}:${index++}`,
        ),
        current =
          c.records.find((k) => k.id === target.id && k.kind === 'room') ?? emptyKey(target),
        after = {
          ...current,
          ...Object.fromEntries(
            ['blocks', 'tags', 'references', 'secret', 'status']
              .filter((f) => (patch as Record<string, unknown>)[f] !== undefined)
              .map((f) => [f, (patch as Record<string, unknown>)[f]]),
          ),
          attributes: patch.attributes
            ? patch.attributeMode === 'replace'
              ? patch.attributes
              : { ...current.attributes, ...patch.attributes }
            : current.attributes,
        } as KeyContent;
      const room = { ...target, name: patch.name ? c.source.name : target.name };
      after.name = room.name;
      const detail = node('details'),
        title = node(
          'summary',
          target.number + '. ' + target.name + (patch.name ? ' → ' + c.source.name : ''),
        );
      detail.append(title);
      if (targets.indexOf(target) < 10) {
        const records = [...c.records.filter((k) => k.id !== target.id), after];
        for (const [audience, label] of [
          ['public', 'Vorlesbar danach'],
          ['gm', 'GM danach · enthält private/verborgene Texte'],
        ] as const) {
          const text = renderDungeonKey(room, records, c.geometry, {
            audience,
            discovered: new Set(),
            heading: null,
          }).text;
          detail.append(node('h4', label), node('pre', text || 'Kein Text.'));
        }
        detail.append(
          node(
            'p',
            'Eigene Attribute: ' +
              Object.entries(after.attributes)
                .map(([k, v]) => k + '=' + String(v ?? 'unterdrückt'))
                .join(', ') +
              ' · Tags: ' +
              after.tags.join(', ') +
              ' · Referenzen: ' +
              after.references.map((r) => r.label).join(', ') +
              ' · Key geheim: ' +
              (after.secret ? 'ja' : 'nein') +
              ' · Status: ' +
              after.status,
          ),
        );
      } else
        detail.append(
          node(
            'p',
            'In dieser Vorschau nur aufgelistet. Dieselben gewählten Felder werden übernommen.',
          ),
        );
      result.append(detail);
    }
    prepared = { identity: c.identity, selection: selection(c), action };
    el<HTMLButtonElement>('key-copy-apply').disabled = false;
    el('key-copy-status').textContent =
      'Quelle: ' +
      c.source.number +
      '. ' +
      c.source.name +
      ' · ' +
      targets.length +
      ' Zielräume · ' +
      (config.mode === 'append' ? 'Ergänzen' : 'Ersetzen') +
      ' · ' +
      config.fields.map((f) => keyCopyFields[f]).join(', ') +
      '. Noch nichts kopiert.';
  } catch (error) {
    prepared = null;
    el('key-copy-preview').replaceChildren();
    el('key-copy-status').textContent = (error as Error).message;
  }
}
async function apply() {
  const captured = prepared,
    c = ports.context();
  if (!captured || !c || c.identity !== captured.identity || selection(c) !== captured.selection) {
    invalidateKeyCopy();
    el('key-copy-status').textContent =
      'Quelle oder Zielauswahl geändert. Neue Vorschau erstellen.';
    return;
  }
  const request = ++serial;
  el<HTMLButtonElement>('key-copy-apply').disabled = true;
  el('key-copy-status').textContent = 'Rauminhalte werden gemeinsam übernommen…';
  try {
    const ok = await ports.commit(captured.action);
    if (request !== serial) return;
    prepared = null;
    syncKeyCopyControl();
    el('key-copy-status').textContent = ok
      ? 'Rauminhalte als unabhängige Kopien übernommen. Rückgängig stellt die vorherigen Zielinhalte gemeinsam wieder her.'
      : 'Übernahme nicht bestätigt. Speicherstatus prüfen und Vorschau neu erstellen.';
  } catch (error) {
    if (request === serial) {
      prepared = null;
      el('key-copy-status').textContent = (error as Error).message;
    }
  }
}
export function initKeyCopy(next: CopyPorts) {
  ports = next;
  const fields = el('key-copy-fields');
  for (const [value, label] of Object.entries(keyCopyFields)) {
    const l = node('label'),
      input = document.createElement('input');
    input.type = 'checkbox';
    input.value = value;
    input.checked = ['public', 'gm', 'attributes', 'tags'].includes(value);
    l.className = 'check-label';
    l.append(input, document.createTextNode(label));
    fields.append(l);
  }
  fields.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (!input.checked) return;
    for (const other of fields.querySelectorAll<HTMLInputElement>('input'))
      if (
        (input.value === 'blocks' && ['public', 'gm'].includes(other.value)) ||
        (['public', 'gm'].includes(input.value) && other.value === 'blocks')
      )
        other.checked = false;
  });
  el('key-copy-show').onclick = () => void preview();
  el('key-copy-apply').onclick = () => void apply();
  for (const event of ['input', 'change'])
    el('key-dialog').addEventListener(event, () => invalidateKeyCopy());
  for (const id of ['key-select-visible', 'key-select-none'])
    el(id).addEventListener('click', invalidateKeyCopy);
}
