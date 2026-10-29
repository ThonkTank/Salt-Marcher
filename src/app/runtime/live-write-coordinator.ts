import { EditorSession } from '../shared/editor-session';
import type { WorkspaceGeometry } from '../shared/contracts';
import {
  checkedCharacterProfile,
  type LiveAck,
  type LiveAction,
  type LiveCommand,
  type LiveStatus,
} from './live-contracts';
import type { LiveDraftOwner } from './live-draft-owner';
import { liveSceneContent } from './live-draft-owner';
import { liveActionUpdatesRecap } from './live-session-recap';

interface Host {
  session: EditorSession;
  api: Pick<Window['campaign'], 'executeLive' | 'liveStatus'>;
  context: () => WorkspaceGeometry | null;
  drafts: Pick<
    LiveDraftOwner,
    'view' | 'character' | 'scene' | 'changed' | 'characterEdited' | 'sceneEdited'
  >;
  flushDependents: () => Promise<boolean>;
  invalidateRead: () => void;
  accepted: (
    ack: LiveAck,
    action: LiveAction,
    profile?: import('./live-scene-contracts').CharacterProfile,
  ) => void;
  busy: (on: boolean, structural: boolean, textSave?: boolean) => void;
  renderGroups: () => void;
  recovery: (visible: boolean) => void;
  refreshSession: () => Promise<unknown>;
  tell: (text: string, error?: boolean) => void;
}

/** One command path for ordinary writes, text drains and explicit receipt lookup.
 * The accepted operation outlives its visible lease; lookup never resubmits it. */
export class LiveWriteCoordinator {
  private readonly failed;
  private readonly request;
  private readonly flushing;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private textSave = false;
  private ime = false;
  constructor(private readonly host: Host) {
    this.failed = host.session.command<{
      command: LiveCommand;
      profile?: import('./live-scene-contracts').CharacterProfile;
      generation: number;
    }>();
    this.request = host.session.operation<Promise<LiveAck | null>>();
    this.flushing = host.session.operation<Promise<boolean>>();
    host.session.onDeactivate(() => this.cancelTimer());
  }
  get blocked() {
    return !!this.failed.value;
  }
  get writing() {
    return !!this.request.value;
  }
  get intentBlocked() {
    return this.writing && !this.textSave;
  }
  get composing() {
    return this.ime;
  }
  get uncertainCommand() {
    return this.failed.value?.command ?? null;
  }
  private cancelTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  composition(active: boolean) {
    this.ime = active;
    this.cancelTimer();
    if (!active) this.schedule();
  }
  resumeAutosave() {
    if (this.host.drafts.changed() && !this.timer && !this.ime && !this.blocked)
      this.timer = setTimeout(() => {
        void this.flush();
      }, 700);
  }
  discardUncertain() {
    this.failed.value = null;
    this.host.recovery(false);
  }
  schedule = () => {
    this.host.invalidateRead();
    this.cancelTimer();
    this.host.tell(
      this.blocked
        ? 'Schreiben gesperrt. Der Entwurf bleibt offen.'
        : 'Eingabe offen – noch nicht gespeichert.',
      this.blocked,
    );
    this.resumeAutosave();
  };
  execute = async (action: LiveAction): Promise<LiveAck | null> => {
    const { context, drafts, session } = this.host;
    const owner = context();
    if (!owner || this.blocked || this.request.value) return null;
    this.host.invalidateRead();
    const profile = drafts.character?.profile,
      focusRevision = drafts.view?.focusRevision,
      previousLocationId = drafts.view?.scene?.locationId,
      generation = session.generation,
      command: LiveCommand = {
        commandId: crypto.randomUUID(),
        campaignId: owner.campaign.id,
        token: owner.token,
        action,
      };
    const structural = [
      'focus',
      'move',
      'membership',
      'scene-roster',
      'archive-character',
    ].includes(action.kind);
    this.textSave = action.kind === 'profile' || action.kind === 'scene-content';
    this.host.busy(true, structural, this.textSave);
    this.host.tell('Wird gespeichert…');
    const current = session.capture(() => [context()?.token]);
    const task = session.run(async () => {
      try {
        const response = await this.host.api.executeLive(command);
        if (!response.ok) throw new Error(response.error);
        const ack = response.value;
        if (!current()) return null;
        if (
          (action.kind === 'live-moment' ||
            action.kind === 'scene-content' ||
            action.kind === 'session-marker') &&
          (drafts.view?.scene?.id !== action.sceneId ||
            drafts.view?.focusRevision !== focusRevision)
        )
          return ack;
        this.host.accepted(ack, action, profile);
        if (
          liveActionUpdatesRecap(action) ||
          (action.kind === 'scene-content' && ack.scene?.locationId !== previousLocationId)
        )
          void this.host.refreshSession();
        this.host.tell(
          drafts.changed() ? 'Weitere Eingabe offen – noch nicht gespeichert.' : 'Gespeichert.',
        );
        return ack;
      } catch (error) {
        this.failed.value = { command, profile, generation };
        if (current()) {
          this.host.recovery(true);
          this.host.tell(
            (error as Error).message + ' Entwurf bleibt offen. Zuerst den Speicherstatus prüfen.',
            true,
          );
        }
        return null;
      } finally {
        this.request.clear(task);
        if (current()) {
          this.textSave = false;
          this.host.busy(false, structural);
          this.host.renderGroups();
        }
      }
    });
    this.request.value = task;
    return task;
  };
  flush = async (): Promise<boolean> => {
    if (!(await this.host.flushDependents())) return false;
    this.cancelTimer();
    if (this.flushing.value) return (await this.flushing.value) ? this.flush() : false;
    if (this.request.value) return (await this.request.value) ? this.flush() : false;
    const { drafts } = this.host;
    if (!this.host.context() || !drafts.view) return !this.blocked;
    if (this.blocked || this.ime) return false;
    if (!drafts.changed()) return true;
    const task = (async () => {
      if (drafts.character && drafts.characterEdited()) {
        try {
          checkedCharacterProfile(drafts.character.profile);
        } catch (error) {
          this.host.tell((error as Error).message + ' Entwurf bleibt offen.', true);
          return false;
        }
        if (
          !(await this.execute({
            kind: 'profile',
            characterId: drafts.character.id,
            expectedRevision: drafts.character.profileRevision,
            profile: structuredClone(drafts.character.profile),
          }))
        )
          return false;
      }
      if (drafts.scene && drafts.view?.scene && drafts.sceneEdited()) {
        if (
          !(await this.execute({
            kind: 'scene-content',
            sceneId: drafts.scene.id,
            expectedRevision: drafts.scene.revision,
            ...liveSceneContent(drafts.scene),
          }))
        )
          return false;
      }
      return true;
    })();
    this.flushing.value = task;
    const okay = await task;
    this.flushing.clear(task);
    return okay ? this.flush() : false;
  };
  resolve = async (): Promise<LiveStatus | null> => {
    const pending = this.failed.value,
      owner = this.host.context();
    if (!pending || !owner || pending.command.campaignId !== owner.campaign.id) return null;
    const current = this.host.session.capture(() => [this.host.context()?.token]);
    const result = await this.host.api.liveStatus(pending.command, owner.token);
    if (!result.ok) throw new Error(result.error);
    if (!current() || this.failed.value !== pending) return null;
    if (result.value.targetChanged) return result.value;
    const status = result.value;
    if (status.receipt && pending.generation === this.host.session.generation)
      this.host.accepted(
        {
          ...status.receipt,
          ...(status.currentScene ? { scene: status.currentScene } : {}),
          ...(status.currentCharacter ? { character: status.currentCharacter } : {}),
        },
        pending.command.action,
        pending.profile,
      );
    this.failed.value = null;
    this.host.recovery(false);
    return status;
  };
}
