import type { WorkspaceGeometry } from '../shared/contracts';
import type { DesktopAPI } from '../shared/desktop-api';
import type { EditorTransition } from '../shared/editor-registry';
import type { WorkspaceView } from './workspace-view';

type Control = { inert: boolean };
export interface WorkspaceActivationPorts {
  workspace: WorkspaceGeometry | null;
  api: Pick<DesktopAPI, 'activateShell' | 'campaignCatalogShell' | 'workspaceInitial'>;
  controls: { main: Control; header: Control; nav: Control };
  el<T extends HTMLElement>(id: string): T;
  editors: {
    flush(reason: EditorTransition): Promise<boolean>;
    suspend(): void;
    deactivate(): void;
    activate(workspace: WorkspaceGeometry): Promise<void>;
  };
  roomEditor: {
    setDraft(): Promise<void>;
    renderList(): void;
    updateHistory(): void;
    readonly saved: boolean;
  };
  rememberView(): void;
  geometryOnly(workspace: WorkspaceGeometry): WorkspaceGeometry;
  setWorkspaceAvailable(available: boolean): void;
  readView(campaignId: string): WorkspaceView;
  reopenView(
    tab: WorkspaceView['tab'],
    scrollY?: number,
    liveNotesTop?: number,
    liveCombat?: boolean,
  ): Promise<void>;
  preparationHasDrafts(): boolean;
  status(text: string, error?: boolean): void;
}

/** Own the ordered source drain and the latest requested campaign activation.
 * DOM composition and each editor's writes remain with their existing owners. */
export function createWorkspaceActivation(ports: WorkspaceActivationPorts) {
  const {
    api,
    el,
    editors,
    roomEditor,
    rememberView,
    geometryOnly,
    setWorkspaceAvailable,
    reopenView,
    preparationHasDrafts,
    status,
  } = ports;
  let activating = false,
    activationFailed = false,
    activationIntent = 0;
  let activationJob: Promise<void> | null = null;
  let queuedActivation: { id: string; entryCommandId?: string } | null = null;
  const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: string }): T => {
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };
  const leave = async (reason: EditorTransition) => !ports.workspace || editors.flush(reason);
  const leaveCampaign = () => leave('campaign');
  function activate(id: string, entryCommandId?: string): Promise<void> {
    activationIntent++;
    queuedActivation = { id, entryCommandId };
    if (activationJob) return activationJob;
    activationJob = drainActivation();
    return activationJob;
  }
  async function drainActivation(): Promise<void> {
    const { main, header, nav } = ports.controls;
    const wasInert = main.inert;
    main.inert = true;
    header.inert = true;
    nav.inert = true;
    try {
      // Reserve the transition before this asynchronous drain, so a second request joins it.
      if (!queuedActivation?.entryCommandId && !(await leaveCampaign())) {
        el<HTMLSelectElement>('campaigns').value = ports.workspace?.campaign.id ?? '';
        return;
      }
      rememberView();
      activating = true;
      activationFailed = false;
      editors.suspend();
      status('Kampagne wird geladen.');
      while (queuedActivation !== null) {
        const { id, entryCommandId } = queuedActivation;
        queuedActivation = null;
        try {
          const shell = unwrap(
            entryCommandId
              ? await api.campaignCatalogShell(entryCommandId)
              : await api.activateShell(id),
          );
          if (queuedActivation !== null) continue;
          const next = unwrap(await api.workspaceInitial(shell.token));
          if (queuedActivation !== null) continue; // A newer intent owns the forthcoming projection.
          editors.deactivate();
          ports.workspace = geometryOnly(next);
          el('campaign-header-name').textContent = next.campaign.name;
          setWorkspaceAvailable(true);
          el<HTMLSelectElement>('campaigns').value = id;
          await editors.activate(next);
          if (queuedActivation !== null) continue;
          el('map-title').textContent = next.campaign.name;
          el<HTMLInputElement>('search').value = '';
          await roomEditor.setDraft();
          if (queuedActivation !== null) continue;
          roomEditor.renderList();
          roomEditor.updateHistory();
          const view = ports.readView(next.campaign.id);
          await reopenView(view.tab, view.scrollY, view.liveNotesTop, view.liveCombat);
          if (queuedActivation !== null) continue;
          if (preparationHasDrafts())
            status('Vorbereitung enthält offene oder gesperrte Entwürfe.', true);
          else if (roomEditor.saved) status('Gespeichert.');
        } catch (error) {
          if (queuedActivation !== null) continue;
          activationFailed = true;
          status(
            (error as Error).message +
              ' Die Arbeitsfläche bleibt schreibgeschützt; öffne eine Kampagne erneut.',
            true,
          );
        }
      }
    } catch (error) {
      // A failed source drain preserves the current editable context and its pending input.
      if (activating) activationFailed = true;
      status((error as Error).message + ' Kampagnenwechsel nicht abgeschlossen.', true);
    } finally {
      main.inert = activationFailed || (!activating && wasInert);
      activating = false;
      queuedActivation = null;
      activationJob = null;
      header.inert = false;
      nav.inert = false;
    }
  }
  return {
    activate,
    leave,
    invalidate() {
      return ++activationIntent;
    },
    get intent() {
      return activationIntent;
    },
    get pending() {
      return activationJob;
    },
    get activating() {
      return activating;
    },
    get failed() {
      return activationFailed;
    },
  };
}
