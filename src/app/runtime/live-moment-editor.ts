import type { Preparation } from '../campaign/preparation-contracts';
import type { Result, WorkspaceGeometry } from '../shared/contracts';
import { EditorSession, type EditorOperation } from '../shared/editor-session';
import { createEditorSurface } from '../shared/editor-surface';
import { type LiveAck, type LiveAction, type LiveView } from './live-contracts';
import {
  canClearSavedLiveMoment,
  emptyLiveMomentDraft,
  liveMomentDraftValue,
  liveMomentSavedMessage,
  sameLiveMomentDraft,
  type LiveMomentCategory,
  type LiveMomentDraft,
} from './live-moment-drafts';

type Host = {
  readonly context: WorkspaceGeometry | null;
  readonly data: LiveView | null;
  readonly sources: Preparation | null;
  readonly get: ReturnType<typeof createEditorSurface>['get'];
  readonly document: Document;
  readonly value: (id: string) => string;
  readonly window: { campaign: Window['campaign']; confirm: (message: string) => boolean };
  readonly unwrap: <T>(result: Result<T>) => T;
  readonly equal: (a: unknown, b: unknown) => boolean;
  readonly editorSession: EditorSession;
  readonly tell: (text: string, error?: boolean) => void;
  readonly flushLive: () => Promise<boolean>;
  readonly execute: (action: LiveAction) => Promise<LiveAck | null>;
  readonly reloadLiveSources: () => Promise<boolean>;
  readonly openKnowledgeNote: (id: string, current?: () => boolean) => Promise<void>;
  readonly openMomentDeadline: (
    seed: { title: string; summary: string; location: { id: string; title: string } | null },
    current?: () => boolean,
  ) => Promise<void>;
  readonly openMomentVisit: (
    planId: string | null,
    seed: { title: string; notes: string; locationId: string | null },
    current?: () => boolean,
  ) => Promise<boolean>;
};

export function createLiveMomentEditor(host: Host) {
  type MomentWork = {
    w: WorkspaceGeometry;
    sceneId: string;
    text: LiveMomentDraft;
    basis: LiveMomentDraft | null;
    dirty: boolean;
    error: string;
    readError: string;
    publishing?: boolean;
    saving: EditorOperation<Promise<boolean>>;
  };
  const momentWorks = new Map<string, MomentWork>();
  let momentOwner: MomentWork | null = null;
  function currentLiveMomentDraft(): LiveMomentDraft {
    return {
      category: host.value('live-moment-category') as LiveMomentCategory,
      title: host.value('live-moment-title'),
      summary: host.value('live-moment-summary'),
      followUp: host.value('live-moment-follow-up') as LiveMomentDraft['followUp'],
    };
  }
  function writeLiveMomentDraft(draft: LiveMomentDraft) {
    host.get<HTMLSelectElement>('live-moment-category').value = draft.category;
    host.get<HTMLInputElement>('live-moment-title').value = draft.title;
    host.get<HTMLTextAreaElement>('live-moment-summary').value = draft.summary;
    host.get<HTMLSelectElement>('live-moment-follow-up').value = draft.followUp;
  }
  function showMomentDraftState() {
    const work = momentOwner,
      active = work && liveMomentDraftValue(work.text),
      error = work?.error || work?.readError;
    host.get('live-moment-draft-status').textContent =
      error ||
      (!work
        ? ''
        : work.dirty
          ? 'Momententwurf wird gesichert…'
          : active
            ? 'Momententwurf gesichert · noch nicht in der Chronik.'
            : 'Eingaben werden als Entwurf gesichert. Erst „Moment festhalten“ bestätigt das Ereignis.');
    host.get('live-moment-retry').hidden = !error;
    host.get('live-moment-retry').textContent = work?.readError
      ? 'Momententwurf erneut laden'
      : 'Eigene Eingabe erneut sichern…';
    host.get('live-moment-open').textContent = active
      ? 'Momententwurf öffnen…'
      : 'Moment festhalten…';
    for (const field of host
      .get('live-moment-form')
      .querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement
      >('input,select,textarea,button'))
      field.disabled = field.id !== 'live-moment-retry' && !!work?.readError;
  }
  function captureMomentDraft() {
    const work = momentOwner;
    if (!work || work.readError) return;
    const text = currentLiveMomentDraft();
    if (!host.equal(text, work.text)) {
      work.text = text;
      work.dirty = !sameLiveMomentDraft(liveMomentDraftValue(text), work.basis);
      if (!work.dirty) work.error = '';
      showMomentDraftState();
    }
  }
  async function saveMomentWork(work: MomentWork): Promise<boolean> {
    if (work.saving.value) return work.saving.value;
    if (!work.dirty) return true;
    if (work.readError) return false;
    const task = (async () => {
      while (work.dirty) {
        const text = liveMomentDraftValue(work.text);
        try {
          host.unwrap(
            await host.window.campaign.keepLiveMomentDraft(
              work.w.token,
              work.sceneId,
              text,
              work.basis,
            ),
          );
        } catch (error) {
          try {
            const saved = host.unwrap(
              await host.window.campaign.liveScene(work.w.token, work.sceneId),
            );
            if (saved.momentDraftError || !sameLiveMomentDraft(saved.momentDraft ?? null, text))
              throw error;
          } catch {
            work.error = 'Momententwurf nicht gesichert: ' + (error as Error).message;
            if (momentOwner === work) showMomentDraftState();
            host.tell(work.error, true);
            return false;
          }
        }
        work.basis = text;
        work.error = '';
        work.dirty = !sameLiveMomentDraft(liveMomentDraftValue(work.text), text);
        if (momentOwner === work) showMomentDraftState();
      }
      return true;
    })();
    work.saving.value = task;
    try {
      return await task;
    } finally {
      if (work.saving.value === task) work.saving.clear(task);
    }
  }
  async function retryMomentDraft() {
    const work = momentOwner;
    if (!work) return;
    captureMomentDraft();
    const text = { ...work.text };
    try {
      if (work.saving.value) await work.saving.value;
      const scene = host.unwrap(await host.window.campaign.liveScene(work.w.token, work.sceneId));
      if (momentOwner !== work || !host.equal(text, work.text)) return;
      if (scene.momentDraftError) throw new Error(scene.momentDraftError);
      const saved = scene.momentDraft ?? null;
      if (work.readError) {
        work.text = saved ?? emptyLiveMomentDraft();
        work.basis = saved;
        work.readError = '';
        work.error = '';
        work.dirty = false;
        writeLiveMomentDraft(work.text);
        showMomentDraftState();
        return;
      }
      if (
        !sameLiveMomentDraft(saved, work.basis) &&
        !sameLiveMomentDraft(saved, liveMomentDraftValue(text)) &&
        !host.window.confirm(
          'Ein anderer Momententwurf ist gesichert:\n' +
            (saved?.title ?? '') +
            '\n' +
            (saved?.summary ?? '') +
            '\n\nDurch deine weiterhin sichtbare Eingabe ersetzen?',
        )
      )
        return;
      work.basis = saved;
      work.dirty = true;
      await saveMomentWork(work);
    } catch (error) {
      work.error = 'Momententwurf nicht gesichert: ' + (error as Error).message;
      if (momentOwner === work) showMomentDraftState();
    }
  }
  function renderLiveMomentDraft() {
    const scene = host.data?.scene;
    if (momentOwner?.sceneId === scene?.id && momentOwner?.w.token === host.context?.token) return;
    captureMomentDraft();
    if (momentOwner?.dirty) void saveMomentWork(momentOwner);
    momentOwner = null;
    if (scene && host.context) {
      let work = momentWorks.get(scene.id);
      if (!work) {
        work = {
          saving: host.editorSession.operation<Promise<boolean>>(),
          w: host.context,
          sceneId: scene.id,
          text: scene.momentDraft ?? emptyLiveMomentDraft(),
          basis: scene.momentDraft ?? null,
          dirty: false,
          error: '',
          readError: scene.momentDraftError ?? '',
        };
        momentWorks.set(scene.id, work);
      }
      momentOwner = work;
    }
    writeLiveMomentDraft(momentOwner?.text ?? emptyLiveMomentDraft());
    host.get('live-moment-result').textContent = '';
    showMomentDraftState();
    if (momentOwner && liveMomentDraftValue(momentOwner.text))
      host.get<HTMLDetailsElement>('live-moment-panel').open = true;
  }

  function init() {
    host.get('live-moment-open').onclick = () => {
      const panel = host.get<HTMLDetailsElement>('live-moment-panel');
      panel.open = true;
      panel.scrollIntoView?.({ block: 'center' });
      host.get<HTMLInputElement>('live-moment-title').focus({ preventScroll: true });
    };
    host.get('live-moment-retry').onclick = () => void retryMomentDraft();
    host.get('live-moment-form').addEventListener('input', () => {
      captureMomentDraft();
      if (momentOwner && !momentOwner.publishing) void saveMomentWork(momentOwner);
    });
    host.get('live-moment-form').onsubmit = (event) => {
      event.preventDefault();
      const token = host.context?.token,
        sceneId = host.data?.scene?.id,
        focusRevision = host.data?.focusRevision,
        draft = currentLiveMomentDraft(),
        { category, title, summary, followUp } = draft,
        scene = host.data?.scene,
        plan =
          scene?.adoption?.planId ||
          host.value('adoption-plan') ||
          host.sources?.selection.planId ||
          null,
        narrativeFollowUp = followUp === 'quest' || followUp === 'rumor' ? followUp : null;
      const current = () =>
        host.context?.token === token &&
        host.data?.scene?.id === sceneId &&
        host.data?.focusRevision === focusRevision;
      if (
        !token ||
        !sceneId ||
        momentOwner?.sceneId !== sceneId ||
        momentOwner.readError ||
        momentOwner.publishing
      )
        return;
      const publishingWork = momentOwner;
      publishingWork.publishing = true;
      void (async () => {
        try {
          if (!(await host.flushLive()) || !current()) return;
          const followUpRef = narrativeFollowUp
            ? { kind: narrativeFollowUp, id: crypto.randomUUID() }
            : null;
          const ack = await host.execute({
            kind: 'live-moment',
            sceneId,
            expectedRevision: host.data!.scene!.revision,
            category,
            title,
            summary,
            draft,
            followUp: followUpRef,
          });
          if (!ack) return;
          const work = momentWorks.get(sceneId);
          if (work && sameLiveMomentDraft(work.basis, draft) && !ack.scene?.momentDraft)
            work.basis = null;
          if (!current()) return;
          let refreshProblem = false;
          if (narrativeFollowUp) void host.reloadLiveSources();
          const unchanged = canClearSavedLiveMoment(
            sceneId,
            momentOwner?.sceneId ?? null,
            draft,
            currentLiveMomentDraft(),
          );
          if (unchanged) {
            writeLiveMomentDraft(emptyLiveMomentDraft());
            captureMomentDraft();
            showMomentDraftState();
            if (followUp !== 'deadline' && followUp !== 'visit')
              host.get<HTMLInputElement>('live-moment-title').focus();
          }
          if ((followUp === 'deadline' || followUp === 'visit') && scene && current())
            try {
              const location = scene.locationId
                ? {
                    id: scene.locationId,
                    title:
                      host.sources?.locations.find((row) => row.document.id === scene.locationId)
                        ?.document.name ?? 'Aktueller Gruppenort',
                  }
                : null;
              if (followUp === 'deadline')
                await host.openMomentDeadline({ title, summary, location }, current);
              else
                await host.openMomentVisit(
                  plan,
                  { title, notes: summary, locationId: scene.locationId },
                  current,
                );
            } catch {
              refreshProblem = true;
            }
          if (current()) {
            const result = host.get('live-moment-result');
            result.textContent = liveMomentSavedMessage(followUp, unchanged, refreshProblem);
            if (followUpRef) {
              const open = host.document.createElement('button');
              open.type = 'button';
              open.id = 'live-moment-follow-up-open';
              open.textContent = followUpRef.kind === 'quest' ? 'Quest öffnen…' : 'Gerücht öffnen…';
              const valid = () => current() && open.isConnected && result.contains(open);
              open.onclick = () => {
                if (!valid() || open.disabled) return;
                open.disabled = true;
                void host
                  .openKnowledgeNote(followUpRef.id, valid)
                  .catch((error) => {
                    if (valid()) host.tell((error as Error).message, true);
                  })
                  .finally(() => {
                    if (valid()) open.disabled = false;
                  });
              };
              result.append(host.document.createTextNode(' '), open);
            }
          }
        } catch (error) {
          if (current()) host.tell((error as Error).message, true);
        } finally {
          publishingWork.publishing = false;
          if (publishingWork.dirty && !publishingWork.error) void saveMomentWork(publishingWork);
        }
      })();
    };
  }

  function reset() {
    momentWorks.clear();
    momentOwner = null;
    writeLiveMomentDraft(emptyLiveMomentDraft());
  }
  async function flush() {
    captureMomentDraft();
    for (const work of momentWorks.values()) if (!(await saveMomentWork(work))) return false;
    return true;
  }
  function saveCurrent() {
    if (momentOwner) void saveMomentWork(momentOwner);
  }
  const hasSavedDraft = () => [...momentWorks.values()].some((w) => !!w.basis);

  return {
    currentLiveMomentDraft,
    init,
    reset,
    flush,
    saveCurrent,
    hasSavedDraft,
    renderLiveMomentDraft,
    writeLiveMomentDraft,
    captureMomentDraft,
  };
}
