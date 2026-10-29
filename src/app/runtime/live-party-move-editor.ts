import type { LiveAck, LiveAction } from './live-contracts';
import type { EditorSession } from '../shared/editor-session';

type MoveAction = Extract<LiveAction, { kind: 'move' }>;
/** Only the facts needed to choose a move; no mutable LiveView is borrowed. */
export type LivePartyMoveOpening = {
  readonly token: string;
  readonly source: {
    readonly id: string;
    readonly label: string;
    readonly contentRevision: number;
    readonly membershipRevision: number;
    readonly clockRevision: number;
    readonly instantMs: string;
    readonly members: readonly { readonly id: string; readonly name: string }[];
  };
  readonly rosterRevision: number;
  readonly focusRevision: number;
  readonly targets: readonly {
    readonly id: string;
    readonly label: string;
    readonly membershipRevision: number;
    readonly clockRevision: number;
    readonly instantMs: string;
  }[];
};
type MovePorts = {
  document: Document;
  get<T extends HTMLElement = HTMLElement>(id: string): T;
  session: EditorSession;
  blocked(): boolean;
  writing(): boolean;
  execute(action: MoveAction): Promise<LiveAck | null>;
  formatInstant(instantMs: string): string;
  feedback(text: string, error?: boolean): void;
};
type Opening = {
  snapshot: LivePartyMoveOpening;
  lifetime: () => boolean;
  intent: () => boolean;
  posted: MoveAction | null;
};

/** Owns member choice, source revisions, target choice and the modal lifetime.
 * The central Live writer owns execute, command recovery and the write drain. */
export function createLivePartyMoveEditor(ports: MovePorts) {
  const { document, get, session } = ports;
  let opening: Opening | null = null,
    selected = new Set<string>(),
    targetId = '',
    title = '',
    running: Promise<LiveAck | null> | null = null;
  const dialog = () => get<HTMLDialogElement>('move-dialog');
  function reset() {
    opening = null;
    selected.clear();
    targetId = '';
    title = '';
    dialog().close();
  }
  function cancel() {
    if (running || ports.writing()) return;
    reset();
  }
  function busy(on: boolean) {
    for (const id of ['move-title', 'move-target', 'move-confirm', 'move-all'])
      get<HTMLInputElement | HTMLButtonElement>(id).disabled = on || ports.blocked();
    get<HTMLButtonElement>('move-cancel').disabled = on;
    for (const box of get('move-members').querySelectorAll<HTMLInputElement>('input'))
      box.disabled = on || ports.blocked();
  }
  function current(owner: Opening) {
    return opening === owner && owner.lifetime();
  }
  function renderTime() {
    const target = opening?.snapshot.targets.find((scene) => scene.id === targetId);
    get('move-new-fields').hidden = !!target;
    get('move-time').hidden = !target;
    get('move-confirm').textContent = target ? 'Zur Zielzeit verschieben' : 'Figuren verschieben';
    if (!target || !opening) return;
    get('move-time').textContent =
      'Ausgangsgruppe: ' +
      ports.formatInstant(opening.snapshot.source.instantMs) +
      '. Zielgruppe: ' +
      ports.formatInstant(target.instantMs) +
      '. Mit „Zur Zielzeit verschieben“ wechseln die gewählten Figuren zur Zeit der Zielgruppe. Beide Gruppenzeiten bleiben unverändert. Eine Rast wird dadurch nicht gebucht.';
  }
  function open(snapshot: LivePartyMoveOpening, lifetime: () => boolean, intent: () => boolean) {
    if (running || !lifetime() || !intent()) return false;
    const owner: Opening = { snapshot: structuredClone(snapshot), lifetime, intent, posted: null };
    opening = owner;
    selected = new Set();
    targetId = '';
    title = '';
    get('move-source').textContent =
      snapshot.source.label + ' · ' + ports.formatInstant(snapshot.source.instantMs);
    get('move-members').replaceChildren();
    for (const member of snapshot.source.members) {
      const label = document.createElement('label'),
        box = document.createElement('input');
      box.type = 'checkbox';
      box.value = member.id;
      box.onchange = () => {
        if (!current(owner) || running) return;
        if (box.checked) selected.add(member.id);
        else selected.delete(member.id);
      };
      label.append(box, document.createTextNode(' ' + member.name));
      get('move-members').append(label);
    }
    const select = get<HTMLSelectElement>('move-target');
    select.replaceChildren();
    const fresh = document.createElement('option');
    fresh.value = '';
    fresh.textContent = 'Neue unabhängige Gruppe';
    select.append(fresh);
    for (const target of snapshot.targets.filter((target) => target.id !== snapshot.source.id)) {
      const option = document.createElement('option');
      option.value = target.id;
      option.textContent = target.label + ' · ' + ports.formatInstant(target.instantMs);
      select.append(option);
    }
    select.value = '';
    get<HTMLInputElement>('move-title').value = '';
    // Preserve the existing UI diagnostics; commands use the owned snapshot.
    get('move-title').dataset.clockRevision = String(snapshot.source.clockRevision);
    get('move-title').dataset.contentRevision = String(snapshot.source.contentRevision);
    renderTime();
    busy(false);
    dialog().showModal();
    return true;
  }
  async function submit() {
    const owner = opening;
    if (!owner || running || ports.blocked()) return false;
    if (!current(owner) || !owner.intent()) {
      ports.feedback('Szenenfokus oder Ausgangsgruppe geändert. Auswahl erneut öffnen.', true);
      return false;
    }
    if (!selected.size) {
      ports.feedback('Wähle die Figuren aus, die ihre Gruppe wechseln.', true);
      return false;
    }
    const snapshot = owner.snapshot,
      target = snapshot.targets.find((scene) => scene.id === targetId);
    if (targetId && (!target || target.id === snapshot.source.id)) {
      ports.feedback('Zielgruppe nicht verfügbar. Auswahl erneut öffnen.', true);
      return false;
    }
    const action: MoveAction = {
      kind: 'move',
      sceneId: snapshot.source.id,
      expectedRosterRevision: snapshot.rosterRevision,
      expectedFocusRevision: snapshot.focusRevision,
      expectedSceneMembershipRevision: snapshot.source.membershipRevision,
      expectedClockRevision: snapshot.source.clockRevision,
      memberIds: snapshot.source.members
        .filter((member) => selected.has(member.id))
        .map((member) => member.id),
      target: target
        ? {
            kind: 'existing',
            sceneId: target.id,
            expectedMembershipRevision: target.membershipRevision,
            expectedClockRevision: target.clockRevision,
          }
        : { kind: 'new', title, expectedContentRevision: snapshot.source.contentRevision },
    };
    owner.posted = action;
    const task = ports.execute(action);
    running = task;
    busy(true);
    try {
      const ack = await task;
      if (ack && current(owner)) reset();
      return !!ack;
    } finally {
      if (running === task) running = null;
      if (current(owner)) busy(false);
    }
  }
  /** Only the central writer may acknowledge the submitted original action. */
  function accepted(action: LiveAction) {
    const owner = opening;
    if (owner?.posted === action && current(owner)) reset();
  }
  function init() {
    get('move-all').onclick = () => {
      if (!opening || !current(opening) || running) return;
      selected = new Set(opening.snapshot.source.members.map((member) => member.id));
      for (const box of get('move-members').querySelectorAll<HTMLInputElement>('input'))
        box.checked = selected.has(box.value);
    };
    get('move-target').onchange = () => {
      if (!opening || !current(opening) || running) return;
      targetId = get<HTMLSelectElement>('move-target').value;
      renderTime();
    };
    get('move-title').oninput = () => {
      if (opening && current(opening) && !running)
        title = get<HTMLInputElement>('move-title').value;
    };
    get('move-cancel').onclick = cancel;
    dialog().addEventListener('cancel', (event) => {
      event.preventDefault();
      cancel();
    });
    get('move-form').onsubmit = (event) => {
      event.preventDefault();
      void submit();
    };
  }
  session.onDeactivate(reset);
  return { open, reset, init, busy, submit, accepted };
}
