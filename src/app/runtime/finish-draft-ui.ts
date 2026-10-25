import { EditorSession, type EditorOperation } from '../shared/editor-session';
import type { WorkspaceGeometry } from '../shared/contracts';
import type { FinishDraft, FinishOwner, RewardItemDraft } from './finish-draft-contracts';
export const editorSession = new EditorSession();

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
type Values = Pick<
  FinishDraft,
  'outcome' | 'poolXp' | 'loadXp' | 'noXp' | 'hasLoot' | 'recipientIds' | 'items'
>;
type Session = {
  w: WorkspaceGeometry;
  owner: FinishOwner;
  draft: FinishDraft | null;
  defaults: Values;
  readItems: () => RewardItemDraft[];
  restoreItems: (items: RewardItemDraft[]) => void;
  preview: () => void;
  input: EditorSession['input'];
  operation: EditorOperation<Promise<boolean>>;
  error: string | null;
  loading: boolean;
};
let active: Session | null = null,
  timer: ReturnType<typeof setTimeout> | null = null,
  initialized = false;
function snapshot(s: Pick<Session, 'readItems'>): Values {
  return {
    outcome: get<HTMLTextAreaElement>('combat-outcome').value,
    poolXp: get<HTMLInputElement>('finish-xp').value,
    loadXp: get<HTMLInputElement>('finish-load').value,
    noXp: get<HTMLInputElement>('finish-no-xp').checked,
    hasLoot: get<HTMLInputElement>('finish-has-loot').checked,
    recipientIds: [
      ...get('finish-recipients').querySelectorAll<HTMLInputElement>('input:checked'),
    ].map((b) => b.value),
    items: structuredClone(s.readItems()),
  };
}
function restore(s: Session, v: Values) {
  get<HTMLTextAreaElement>('combat-outcome').value = v.outcome;
  get<HTMLInputElement>('finish-xp').value = v.poolXp;
  get<HTMLInputElement>('finish-load').value = v.loadXp;
  get<HTMLInputElement>('finish-no-xp').checked = v.noXp;
  get<HTMLInputElement>('finish-has-loot').checked = v.hasLoot;
  for (const box of get('finish-recipients').querySelectorAll<HTMLInputElement>('input'))
    box.checked = v.recipientIds.includes(box.value);
  s.restoreItems(structuredClone(v.items));
  s.preview();
}
function changedBasis(s: Session) {
  return (
    !!s.draft &&
    (s.draft.revision !== s.owner.revision ||
      (s.owner.kind === 'narrative' &&
        (s.draft.noteRevision === undefined || s.draft.noteRevision !== s.owner.noteRevision)))
  );
}
function status(s: Session, text?: string) {
  if (active !== s) return;
  get('finish-draft-status').textContent =
    text ??
    s.error ??
    (changedBasis(s)
      ? 'Der Kampf-/Queststand oder die Notizbasis hat sich geändert oder ist unbekannt. Eingabe prüfen und ausdrücklich auf den aktuellen Stand übernehmen.'
      : s.draft
        ? 'Gesicherte Abschlusseingabe wieder geöffnet.'
        : 'Eingaben werden automatisch gesichert; Schließen behält den Entwurf.');
  get('finish-draft-adopt').hidden = !changedBasis(s);
}
export function markFinishDraft() {
  const s = active;
  if (!s) return;
  s.input.version++;
  status(s, 'Abschlusseingabe wird gesichert…');
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void save(s), 250);
}
async function save(s: Session): Promise<boolean> {
  if (active !== s || s.loading) return false;
  if (s.operation.value) {
    if (!(await s.operation.value) || active !== s) return false;
    return s.input.version === s.input.retained ? true : save(s);
  }
  if (s.input.version === s.input.retained) return true;
  const version = s.input.version,
    d: FinishDraft = {
      ...s.owner,
      revision: s.draft?.revision ?? s.owner.revision,
      ...(s.owner.kind === 'narrative'
        ? { noteRevision: s.draft ? s.draft.noteRevision : s.owner.noteRevision }
        : {}),
      ...snapshot(s),
      writeId: crypto.randomUUID(),
    };
  const run = (async () => {
    try {
      const r = await window.campaign.keepFinishDraft(s.w.token, d, s.draft?.writeId ?? null);
      if (active !== s) return false;
      if (!r.ok) throw new Error(r.error);
      s.draft = d;
      s.input.retained = version;
      s.error = null;
      status(s, 'Abschlusseingabe gesichert · beim nächsten Öffnen fortsetzen.');
      return true;
    } catch (e) {
      if (active !== s) return false;
      s.error = (e as Error).message;
      status(s);
      return false;
    }
  })();
  s.operation.value = run;
  const ok = await run;
  s.operation.value = null;
  return active === s && (ok && s.input.version !== s.input.retained ? await save(s) : ok);
}
export async function flushFinishDraft() {
  const s = active;
  return !s || ((await save(s)) && active === s);
}
export function deactivateFinishDraft() {
  editorSession.deactivate();
  active = null;
  if (timer) clearTimeout(timer);
  timer = null;
}
export async function resetFinishDraft() {
  const s = active;
  if (s?.loading && s.input.version === 0) {
    deactivateFinishDraft();
    return true;
  }
  if (s && !(await save(s)) && active === s)
    throw new Error(s.error ?? 'Abschlusseingabe noch nicht gesichert.');
  if (active !== s) return active === null;
  deactivateFinishDraft();
  return true;
}
export async function beginFinishDraft(
  w: WorkspaceGeometry,
  owner: FinishOwner,
  readItems: () => RewardItemDraft[],
  restoreItems: (items: RewardItemDraft[]) => void,
  preview: () => void,
) {
  init();
  const s: Session = {
    w,
    owner,
    draft: null,
    defaults: snapshot({ readItems }),
    readItems,
    restoreItems,
    preview,
    input: { version: 0, retained: 0 },
    operation: editorSession.operation<Promise<boolean>>(),
    error: null,
    loading: true,
  };
  editorSession.generation++;
  active = s;
  let r;
  try {
    r = await window.campaign.finishDraft(w.token, owner);
  } catch (e) {
    if (active !== s) return false;
    throw e;
  }
  if (active !== s) return false;
  if (!r.ok) throw new Error(r.error);
  s.loading = false;
  s.draft = r.value;
  if (s.draft && s.input.version === 0) restore(s, s.draft);
  status(s);
  return true;
}
export async function finishDraftCommit() {
  const s = active;
  if (!s) throw new Error('Abschlussziel zuerst öffnen.');
  if (!(await save(s))) throw new Error(s.error ?? 'Abschlusseingabe noch nicht gesichert.');
  if (active !== s) throw new Error('Abschlussziel inzwischen gewechselt.');
  if (changedBasis(s) || (s.owner.kind === 'narrative' && s.owner.noteRevision === undefined))
    throw new Error('Abschlussstand geändert. Gesicherte Eingabe zuerst prüfen und übernehmen.');
  return {
    writeId: s.draft?.writeId,
    revision: s.owner.revision,
    noteRevision: s.owner.noteRevision,
    consume: () => {
      if (active !== s) return false;
      deactivateFinishDraft();
      return true;
    },
  };
}
function init() {
  if (initialized) return;
  initialized = true;
  const dialog = get<HTMLDialogElement>('combat-finish-dialog');
  dialog.addEventListener('input', markFinishDraft);
  dialog.addEventListener('change', markFinishDraft);
  dialog.addEventListener('close', () => {
    if (active) void save(active);
  });
  get('finish-draft-discard').onclick = () => {
    const s = active;
    void (async () => {
      if (!s || !(await save(s)) || active !== s) return;
      const version = s.input.version;
      const run = (async () => {
        try {
          if (s.draft) {
            const r = await window.campaign.discardFinishDraft(s.w.token, s.owner, s.draft.writeId);
            if (active !== s) return false;
            if (!r.ok) throw new Error(r.error);
          }
          s.draft = null;
          s.error = null;
          if (s.input.version === version) {
            restore(s, s.defaults);
            s.input.retained = s.input.version;
            status(s, 'Entwurf verworfen · vorbereitete Vorgaben wieder geladen.');
          } else status(s, 'Voriger Entwurf verworfen; neuere Eingaben bleiben erhalten.');
          return true;
        } catch (e) {
          if (active === s) {
            s.error = (e as Error).message;
            status(s);
          }
          return false;
        }
      })();
      s.operation.value = run;
      const ok = await run;
      if (s.operation.value === run) s.operation.value = null;
      if (ok && active === s && s.input.version !== s.input.retained) await save(s);
    })().catch((e) => {
      if (s && active === s) {
        s.error = e.message;
        status(s);
      }
    });
  };
  get('finish-draft-adopt').onclick = () => {
    void (async () => {
      const s = active;
      if (!s || !(await save(s)) || active !== s || !s.draft) return;
      if (s.owner.kind === 'narrative' && s.owner.noteRevision === undefined) {
        s.error = 'Notizbasis zuerst erneut lesen.';
        status(s);
        return;
      }
      s.draft.revision = s.owner.revision;
      if (s.owner.kind === 'narrative') s.draft.noteRevision = s.owner.noteRevision;
      s.input.version++;
      await save(s);
      status(s);
    })();
  };
}

editorSession.onDeactivate(() => {
  active = null;
  if (timer) clearTimeout(timer);
  timer = null;
});
editorSession.observeDraft(() => ({
  openInput: !!active && active.input.version !== active.input.retained,
  retainedDraft: !!active?.draft,
  unresolvedCommand: false,
}));
