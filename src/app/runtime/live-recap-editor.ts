import type { Result, WorkspaceGeometry } from '../shared/contracts';
import { EditorSession, type EditorOperation } from '../shared/editor-session';
import { createEditorSurface } from '../shared/editor-surface';
import { acknowledgeFields } from '../shared/editor-transition';
import { preserveLiteralEdit } from '../shared/literal-text-edit';
import { type LiveAck, type LiveAction, type LiveView } from './live-contracts';

type Host = {
  readonly context: WorkspaceGeometry | null;
  readonly get: ReturnType<typeof createEditorSurface>['get'];
  readonly value: (id: string) => string;
  readonly window: { campaign: Window['campaign']; confirm: (message: string) => boolean };
  readonly unwrap: <T>(result: Result<T>) => T;
  readonly equal: (a: unknown, b: unknown) => boolean;
  readonly editorSession: EditorSession;
  readonly renderLiveSession: () => void;
  readonly blocked: boolean;
};

export function createLiveRecapEditor(host: Host) {
  type RecapText = import('./live-scene-contracts').SessionRecapDraft;
  type RecapWork = {
    text: RecapText;
    basis: RecapText | null;
    dirty: boolean;
    error: string;
    readError?: string;
    publishing?: boolean;
    saving: EditorOperation<Promise<boolean>>;
  };
  const recapDrafts = new Map<string, RecapWork>();
  function recapFields(
    review = (host.get('live-session-close-dialog') as HTMLDialogElement | null)?.open,
  ): RecapText {
    const before = host.context && recapDrafts.get(host.context.campaign.id)?.text;
    return {
      summary: preserveLiteralEdit(
        before?.summary ?? '',
        host.value(review ? 'live-session-close-summary' : 'live-session-summary'),
      ),
      handoff: preserveLiteralEdit(
        before?.handoff ?? '',
        host.value(review ? 'live-session-close-handoff' : 'live-session-handoff'),
      ),
    };
  }
  function recapReadError() {
    return host.context && recapDrafts.get(host.context.campaign.id)?.readError;
  }
  function showRecapSave() {
    const state = host.context && recapDrafts.get(host.context.campaign.id),
      text =
        state?.readError ||
        state?.error ||
        (state?.dirty
          ? 'Rückblickentwurf wird gesichert…'
          : state && (state.text.summary || state.text.handoff)
            ? 'Rückblickentwurf gespeichert.'
            : '');
    for (const id of ['live-session-draft-status', 'live-session-close-draft-status']) {
      const label = host.get(id);
      if (label) label.textContent = text;
    }
    for (const id of ['live-session-draft-retry', 'live-session-close-draft-retry']) {
      const button = host.get(id);
      if (button) {
        button.hidden = !(state?.error || state?.readError);
        button.textContent = state?.readError
          ? 'Rückblick erneut laden'
          : 'Eigene Fassung erneut sichern…';
      }
    }
    for (const id of [
      'live-session-summary',
      'live-session-handoff',
      'live-session-close-summary',
      'live-session-close-handoff',
    ]) {
      const field = host.get(id) as HTMLTextAreaElement | null;
      if (field) field.readOnly = !state || !!state.readError;
    }
    if (state?.readError)
      for (const id of [
        'live-session-close-confirm',
        'live-session-close-prepare',
        'live-session-close-use-suggestion',
      ]) {
        const button = host.get(id) as HTMLButtonElement | null;
        if (button) button.disabled = true;
      }
  }
  async function retryRecapSave() {
    const w = host.context,
      state = w && recapDrafts.get(w.campaign.id);
    if (!w || !state) return;
    try {
      if (state.saving.value) await state.saving.value;
      if (host.context !== w) return;
      const text = { ...state.text },
        basis = state.basis,
        readError = state.readError;
      const view = host.unwrap(await host.window.campaign.live(w.token));
      if (
        host.context !== w ||
        state.saving.value ||
        !host.equal(text, state.text) ||
        !host.equal(basis, state.basis) ||
        readError !== state.readError
      )
        return;
      if (view.recapDraftError) throw new Error(view.recapDraftError);
      const saved = view.recapDraft ?? null;
      if (state.readError && !state.dirty) {
        state.text = saved ?? { summary: '', handoff: '' };
        state.basis = saved;
        state.readError = '';
        state.error = '';
        for (const id of [
          'live-session-summary',
          'live-session-handoff',
          'live-session-close-summary',
          'live-session-close-handoff',
        ]) {
          const field = host.get(id) as HTMLTextAreaElement | null;
          if (field) field.value = id.endsWith('handoff') ? state.text.handoff : state.text.summary;
        }
        showRecapSave();
        host.renderLiveSession();
        return;
      }
      state.readError = '';
      showRecapSave();
      host.renderLiveSession();
      if (
        !host.equal(saved, state.basis) &&
        !host.equal(saved, state.text) &&
        !host.window.confirm(
          'Es liegt ein anderer gespeicherter Rückblick vor.\n\nRückblick:\n' +
            (saved?.summary ?? '') +
            '\n\nNächster Spielabend:\n' +
            (saved?.handoff ?? '') +
            '\n\nDurch deine weiterhin sichtbare Fassung ersetzen?',
        )
      )
        return;
      state.basis = saved;
      state.dirty = true;
      state.error = '';
      showRecapSave();
      await saveRecap(w, state);
    } catch (error) {
      if (host.context === w) {
        state.error = 'Rückblickentwurf nicht gesichert: ' + (error as Error).message;
        showRecapSave();
      }
    }
  }
  function queueRecapSave(text?: RecapText) {
    if (!host.context) return;
    const w = host.context,
      state = recapDrafts.get(w.campaign.id);
    if (!state || state.readError) return;
    state.text = text ?? recapFields();
    state.dirty = true;
    showRecapSave();
    void saveRecap(w, state);
  }
  async function saveRecap(w: WorkspaceGeometry, state: RecapWork): Promise<boolean> {
    // The ending owns the draft until its receipt supplies the next CAS basis.
    if (state.publishing) return false;
    if (state.saving.value) return state.saving.value;
    if (!state.dirty) return true;
    if (state.readError) return false;
    const current = host.editorSession.capture(() => [
      host.context?.token,
      recapDrafts.get(w.campaign.id),
    ]);
    const task = (async () => {
      while (state.dirty) {
        const text = { ...state.text };
        try {
          host.unwrap(await host.window.campaign.keepSessionRecapDraft(w.token, text, state.basis));
        } catch (error) {
          try {
            const view = host.unwrap(await host.window.campaign.live(w.token)),
              saved = view.recapDraft;
            if (view.recapDraftError || !saved || !host.equal(saved, text)) throw error;
          } catch {
            state.error = 'Rückblickentwurf nicht gesichert: ' + (error as Error).message;
            if (current()) showRecapSave();
            return false;
          }
        }
        const accepted = acknowledgeFields(text, text, state.text, ['summary', 'handoff']);
        state.basis = accepted.basis;
        state.text = accepted.value;
        state.dirty = accepted.dirty;
        state.error = '';
        if (current()) showRecapSave();
      }
      return true;
    })();
    state.saving.value = task;
    try {
      return await task;
    } finally {
      if (state.saving.value === task) state.saving.clear(task);
    }
  }

  function activate(workspace: WorkspaceGeometry) {
    if (host.context) {
      const retained = recapDrafts.get(host.context.campaign.id),
        text = recapFields();
      if (retained && !host.equal(retained.text, text)) {
        retained.text = text;
        retained.dirty = true;
      }
    }
    const draft = workspace ? recapDrafts.get(workspace.campaign.id) : undefined;
    host.get<HTMLTextAreaElement>('live-session-summary').value = draft?.text.summary ?? '';
    host.get<HTMLTextAreaElement>('live-session-handoff').value = draft?.text.handoff ?? '';
    for (const id of ['live-session-summary', 'live-session-handoff'])
      host.get<HTMLTextAreaElement>(id).readOnly = !draft || !!draft.readError;
  }

  function accept(live: LiveView) {
    if (!host.context) return;
    let recap = recapDrafts.get(host.context.campaign.id);
    if (!recap) {
      recap = {
        saving: host.editorSession.operation<Promise<boolean>>(),
        text: live.recapDraft ?? { summary: '', handoff: '' },
        basis: live.recapDraft ?? null,
        dirty: false,
        error: '',
      };
      recapDrafts.set(host.context.campaign.id, recap);
      host.get<HTMLTextAreaElement>('live-session-summary').value = recap.text.summary;
      host.get<HTMLTextAreaElement>('live-session-handoff').value = recap.text.handoff;
    }
    if (recap.readError && !live.recapDraftError && !recap.dirty) {
      recap.text = live.recapDraft ?? { summary: '', handoff: '' };
      recap.basis = live.recapDraft ?? null;
      host.get<HTMLTextAreaElement>('live-session-summary').value = recap.text.summary;
      host.get<HTMLTextAreaElement>('live-session-handoff').value = recap.text.handoff;
    }
    recap.readError = live.recapDraftError;
    showRecapSave();
  }

  function acceptAck(ack: LiveAck, action: LiveAction) {
    if (
      action.kind === 'session-marker' &&
      action.marker === 'end' &&
      ack.recapDraft !== undefined &&
      host.context
    ) {
      const state = recapDrafts.get(host.context.campaign.id);
      if (state) {
        const accepted = acknowledgeFields(
          ack.recapDraft ?? { summary: '', handoff: '' },
          { summary: action.summary, handoff: action.handoff ?? '' },
          recapFields(),
          ['summary', 'handoff'],
        );
        state.basis = ack.recapDraft;
        state.text = accepted.value;
        state.dirty = accepted.dirty;
        state.error = '';
        for (const id of [
          'live-session-summary',
          'live-session-handoff',
          'live-session-close-summary',
          'live-session-close-handoff',
        ])
          host.get<HTMLTextAreaElement>(id).value = id.endsWith('handoff')
            ? state.text.handoff
            : state.text.summary;
        showRecapSave();
        if (!state.publishing && state.dirty) void saveRecap(host.context, state);
      }
    }
  }

  async function flush() {
    const recap = host.context && recapDrafts.get(host.context.campaign.id);
    return !host.context || !recap || saveRecap(host.context, recap);
  }
  async function publish(owner: WorkspaceGeometry, action: () => Promise<LiveAck | null>) {
    const recap = recapDrafts.get(owner.campaign.id);
    if (recap) recap.publishing = true;
    try {
      return await action();
    } finally {
      if (recap) {
        recap.publishing = false;
        if (recap.dirty && !host.blocked) void saveRecap(owner, recap);
      }
    }
  }
  const hasSavedDraft = () => [...recapDrafts.values()].some((w) => !!w.basis);

  function bind() {
    for (const id of [
      'live-session-summary',
      'live-session-handoff',
      'live-session-close-summary',
      'live-session-close-handoff',
    ])
      host.get(id).addEventListener('input', () => queueRecapSave());
    for (const id of ['live-session-draft-retry', 'live-session-close-draft-retry'])
      host.get(id).onclick = () => void retryRecapSave();
  }
  return {
    bind,
    activate,
    accept,
    acceptAck,
    flush,
    publish,
    hasSavedDraft,
    recapFields,
    recapReadError,
    showRecapSave,
    retryRecapSave,
    queueRecapSave,
  };
}
