import { EditorSession } from '../shared/editor-session';
import type { WorkspaceGeometry } from '../shared/contracts';
import {
  writeConfirmed,
  hasPendingCommit,
  type CommitResolution,
} from '../shared/commit-confirmation';
import type { CombatAction, CombatView, CombatCommand } from './combat-contracts';
import type { CombatState } from './combat-state-contracts';
import type { CombatWorkingDraft, FighterWorkingDraft } from './combat-draft-contracts';
import type { CombatDraftCache } from './combat-draft-cache';
import { combatWriteFeedback } from './combat-write-feedback';
interface Host {
  session: EditorSession;
  api: Pick<Window['campaign'], 'executeCombat'>;
  cache: Pick<CombatDraftCache, 'flush' | 'consumed'>;
  context: () => {
    workspace: WorkspaceGeometry | null;
    sceneId: string | null;
    view: CombatView | null;
  };
  blocked: () => boolean;
  invalidateReads: () => void;
  draftFor: (action: CombatAction) => {
    editKey: string | null;
    editDraft?: FighterWorkingDraft;
    editorDraft?: CombatWorkingDraft;
  };
  accept: (view: CombatView) => void;
  acceptRoll: (action: CombatAction, combatId?: string) => void;
  acceptInitiative: (draft: Extract<CombatWorkingDraft, { kind: 'initiative' }>) => void;
  resetConcentration: () => void;
  clearPartyInitiative: () => void;
  listDrafts: () => Promise<unknown>;
  revealMembers: (combat: CombatState, targetIds?: readonly string[]) => void;
  refresh: () => Promise<void>;
  completed: (applied: boolean, revealConcentration: boolean) => void;
  lock: () => void;
  render: () => void;
  load: (id?: string) => Promise<boolean>;
  flushFinish: () => Promise<boolean>;
  tell: (text: string, error?: boolean) => void;
}
/** Owns the accepted command and its completion/receipt sequence. Selection and
 * asynchronous draft reads belong to CombatReadOwner, raw values to the cache. */
export function createCombatWriteCoordinator(host: Host) {
  const editorSession = host.session,
    draftCache = host.cache;
  const pendingWork = editorSession.operation<Promise<boolean>>();
  type FighterDraft = FighterWorkingDraft;
  async function execute(
    action: CombatAction,
    expectedRevision?: number,
    stillCurrent: () => boolean = () => true,
    failed?: (message: string) => void,
  ): Promise<boolean> {
    const { workspace, sceneId, view } = host.context();
    if (!workspace || !sceneId || host.blocked() || !stillCurrent()) return false;
    host.invalidateReads();
    const { editKey, editDraft, editorDraft } = host.draftFor(action);
    const before = structuredClone(view?.combat ?? null);
    const gen = editorSession.generation,
      resetConcentration = ['concentration', 'concentration-roll', 'undo'].includes(action.kind);
    const command: CombatCommand = {
      commandId: crypto.randomUUID(),
      campaignId: workspace.campaign.id,
      token: workspace.token,
      combatId: action.kind === 'create' ? null : (view?.combat?.id ?? null),
      expectedRevision:
        action.kind === 'create' ? null : (expectedRevision ?? view?.combat?.revision ?? null),
      action,
      ...(editorDraft ? { draftWriteId: editorDraft.writeId } : {}),
    };
    let applied = false,
      revealConcentration = false;
    const task = editorSession.run(async () => {
      try {
        if (!(await draftCache.flush(command.campaignId)) || editorSession.generation !== gen)
          throw new Error('Offene Eingaben zuerst dauerhaft sichern.');
        if (!stillCurrent()) return false;
        const result = await writeConfirmed<CombatView>(
          'combat',
          command,
          () => host.api.executeCombat(command),
          () =>
            editorSession.generation === gen && host.context().workspace?.token === command.token,
          {
            token: command.token,
            editKey,
            editDraft,
            editorDraft,
            resetConcentration,
            rollAction: action,
            rollGeneration: gen,
            ...(action.kind === 'area-damage'
              ? { areaTargetIds: action.targets.map((target) => target.participantId) }
              : {}),
          },
        );
        if (editorSession.generation !== gen) return false;
        if (resetConcentration) host.resetConcentration();
        host.accept(result);
        host.acceptRoll(action, result.combat?.id);
        applied = true;
        if (action.kind === 'add-party') host.clearPartyInitiative();
        if (editorDraft) draftCache.consumed(command.campaignId, editorDraft);
        void host.listDrafts();
        if (action.kind === 'area-damage' && result.combat)
          host.revealMembers(
            result.combat,
            action.targets.map((target) => target.participantId),
          );
        if (
          [
            'create',
            'edit',
            'damage',
            'hit',
            'area-damage',
            'heal',
            'revive',
            'death',
            'death-roll',
            'concentration',
            'concentration-roll',
            'undo',
            'finish',
            'confirm-npc-losses',
            'remove',
            'add-party',
            'add-prepared-group',
          ].includes(action.kind)
        ) {
          await host.refresh();
        }
        const feedback = combatWriteFeedback(result, action, before);
        revealConcentration = feedback.revealConcentration;
        host.tell(feedback.text);
        return true;
      } catch (error) {
        if (editorSession.generation === gen) {
          const message = (error as Error).message;
          failed?.(message);
          host.tell(message + ' Aktualisiere den Kampfstand, bevor du weiterarbeitest.', true);
        }
        return false;
      } finally {
        pendingWork.clear(task);
        if (editorSession.generation === gen) {
          host.completed(applied, revealConcentration);
        }
      }
    });
    pendingWork.value = task;
    host.lock();
    return pendingWork.value;
  }
  async function recoveredCombat(event: CommitResolution) {
    const { workspace, sceneId, view } = host.context();
    if (event.ref.family !== 'combat' || workspace?.campaign.id !== event.ref.campaignId) return;
    const token = workspace.token,
      gen = editorSession.generation,
      result = event.value as CombatView,
      meta = event.meta as
        | {
            token?: string;
            editKey?: string;
            editDraft?: FighterDraft;
            editorDraft?: CombatWorkingDraft;
            areaTargetIds?: string[];
            resetConcentration?: boolean;
            rollAction?: CombatAction;
            rollGeneration?: number;
          }
        | undefined;
    if (meta?.token === workspace.token && meta.editorDraft) {
      draftCache.consumed(workspace.campaign.id, meta.editorDraft);
      if (meta.editorDraft.kind === 'initiative') host.acceptInitiative(meta.editorDraft);
    }
    if (meta?.token === token && meta.resetConcentration && view?.combat?.id === result.combat?.id)
      host.resetConcentration();
    const loaded =
      result.combat &&
      sceneId &&
      result.combat.sceneId === sceneId &&
      (!view?.combat || view.combat.id === result.combat.id)
        ? await host.load(result.combat.id)
        : false;
    if (
      loaded &&
      meta?.token === token &&
      meta.rollGeneration === editorSession.generation &&
      meta.rollAction
    )
      host.acceptRoll(meta.rollAction, result.combat?.id);
    await host.refresh();
    const current = host.context().view?.combat,
      targetIds = meta?.token === token ? meta.areaTargetIds : undefined;
    if (
      loaded &&
      current &&
      editorSession.generation === gen &&
      host.context().workspace?.token === token &&
      current.id === result.combat?.id &&
      (targetIds || meta?.token !== token)
    ) {
      // Reopen current canonical members, never restore the receipt's historical HP.
      // After restart only the receipt reference survives, so review all groups.
      host.revealMembers(current, targetIds);
      host.render();
    }
  }

  async function flush(): Promise<boolean> {
    if (!(await host.flushFinish())) return false;
    if (pendingWork.value) return await pendingWork.value;
    const workspace = host.context().workspace;
    if (!workspace) return true;
    return (
      (await draftCache.flush(workspace.campaign.id)) && !hasPendingCommit(workspace.campaign.id)
    );
  }
  return {
    execute,
    recoveredCombat,
    flush,
    get writing() {
      return !!pendingWork.value;
    },
  };
}
