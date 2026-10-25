import type {
  GenerationCommand,
  GenerationRequest,
  LootRollCommand,
} from '../src/app/campaign/generation-contracts';
import type { NpcCommand, NpcDraft, NpcQuery } from '../src/app/campaign/npc-contracts';
import type {
  PreparationCommand,
  PreparationDraft,
  PreparationEdit,
  PreparationSelection,
} from '../src/app/campaign/preparation-contracts';
import type {
  SessionCommand,
  SessionGenerationRequest,
} from '../src/app/campaign/session-contracts';
import type { SceneRuleCommand } from '../src/app/catalog/rule-reference-contracts';
import type { SceneCheckCommand } from '../src/app/runtime/scene-check-contracts';
import type { HostIpc } from './host-ipc';
import { StoreClient } from './store-client';
export function registerPreparationHost(host: { ipc: HostIpc; store: StoreClient }) {
  const { store } = host;
  const scope = host.ipc.scope(),
    handle = scope.handle;

  handle(
    'campaign:preparation',
    async (token: string, search: string) => await store.preparation(token, search),
  );
  handle(
    'campaign:note-merge-preview',
    async (token: string, sourceId: string, targetId: string) =>
      await store.noteMergePreview(token, sourceId, targetId),
  );
  handle(
    'campaign:note-room-uses',
    async (token: string, id: string, offset: number) =>
      await store.noteRoomUses(token, id, offset),
  );
  handle(
    'campaign:note-thread',
    async (token: string, id: string, offset: number, active: boolean, history = false) =>
      await store.noteThread(token, id, offset, active, history),
  );
  handle(
    'campaign:check-note-thread',
    async (
      token: string,
      s: import('../src/app/campaign/note-thread-contracts').NoteThreadSelection,
    ) => await store.checkNoteThread(token, s),
  );
  handle(
    'campaign:key-note-choices',
    async (token: string, query: string) => await store.keyNoteChoices(token, query),
  );
  handle(
    'campaign:capture-key-note',
    async (c: import('../src/app/campaign/key-note-capture-contracts').KeyNoteCaptureCommand) =>
      await store.captureKeyNote(c),
  );
  handle(
    'campaign:key-note-capture-status',
    async (
      c: import('../src/app/campaign/key-note-capture-contracts').KeyNoteCaptureCommand,
      token: string,
    ) => await store.keyNoteCaptureStatus(c, token),
  );
  handle(
    'campaign:scene-visits',
    async (token: string, sceneId: string, after: string | null) =>
      await store.sceneVisits(token, sceneId, after),
  );
  handle(
    'campaign:session-progress',
    async (token: string, id: string, sceneId?: string) =>
      await store.sessionProgress(token, id, sceneId),
  );
  handle(
    'campaign:session-packet',
    async (token: string, id: string) => await store.sessionPacket(token, id),
  );
  handle('campaign:session', async (token: string, id: string) => await store.session(token, id));
  handle(
    'campaign:execute-session',
    async (command: SessionCommand) => await store.executeSession(command),
  );
  handle(
    'campaign:generate-session',
    async (token: string, request: SessionGenerationRequest) =>
      await store.generateSession(token, request),
  );
  handle(
    'campaign:regenerate-session-reward',
    async (token: string, id: string, index: number, seed: string) =>
      await store.regenerateSessionReward(token, id, index, seed),
  );
  handle(
    'campaign:regenerate-session',
    async (token: string, id: string, index: number, seed: string) =>
      await store.regenerateSessionProposal(token, id, index, seed),
  );
  handle(
    'campaign:session-runs',
    async (token: string, id: string) => await store.sessionRuns(token, id),
  );
  handle(
    'campaign:session-run',
    async (token: string, id: string) => await store.sessionRun(token, id),
  );
  handle(
    'campaign:scene-encounter-selection',
    async (token: string, id: string) => await store.sceneEncounterSelection(token, id),
  );
  handle(
    'campaign:scene-preparation',
    async (token: string, id: string) => await store.scenePreparation(token, id),
  );
  handle(
    'campaign:scene-rules',
    async (token: string, id: string) => await store.sceneRules(token, id),
  );
  handle(
    'campaign:execute-scene-rule',
    async (command: SceneRuleCommand) => await store.executeSceneRule(command),
  );
  handle(
    'campaign:scene-checks',
    async (token: string, id: string) => await store.sceneChecks(token, id),
  );
  handle(
    'campaign:execute-scene-check',
    async (command: SceneCheckCommand) => await store.executeSceneCheck(command),
  );
  handle(
    'campaign:location-activities',
    async (
      token: string,
      q: import('../src/app/campaign/location-activity-contracts').LocationActivityQuery,
    ) => await store.locationActivities(token, q),
  );
  handle(
    'campaign:location-materials',
    async (
      token: string,
      q: import('../src/app/campaign/location-notebook-contracts').LocationMaterialsQuery,
    ) => await store.locationMaterials(token, q),
  );
  handle(
    'campaign:world-links',
    async (token: string, q: import('../src/app/campaign/world-links-contracts').WorldLinksQuery) =>
      await store.worldLinks(token, q),
  );
  handle(
    'campaign:change-preparation-content',
    async (command: PreparationCommand) => await store.changePreparationContent(command),
  );
  handle(
    'campaign:reconcile-preparation-content',
    async (command: PreparationCommand, token: string) =>
      await store.reconcilePreparationContent(command, token),
  );
  handle(
    'campaign:execute-world-relation-pair',
    async (
      command: import('../src/app/campaign/world-relation-pair-contracts').WorldRelationPairCommand,
    ) => await store.executeWorldRelationPair(command),
  );
  handle(
    'campaign:reconcile-world-relation-pair',
    async (
      command: import('../src/app/campaign/world-relation-pair-contracts').WorldRelationPairCommand,
      token: string,
    ) => await store.reconcileWorldRelationPair(command, token),
  );
  handle(
    'campaign:world-relation-pair-draft',
    async (token: string, sourceId: string) => await store.worldRelationPairDraft(token, sourceId),
  );
  handle(
    'campaign:keep-world-relation-pair-draft',
    async (
      token: string,
      draft: import('../src/app/campaign/world-relation-pair-contracts').WorldRelationPairDraft,
      expected: string | null,
    ) => await store.keepWorldRelationPairDraft(token, draft, expected),
  );
  handle(
    'campaign:discard-world-relation-pair-draft',
    async (token: string, sourceId: string, writeId: string) =>
      await store.discardWorldRelationPairDraft(token, sourceId, writeId),
  );
  handle(
    'campaign:world-relation-pair-history',
    async (token: string) => await store.worldRelationPairHistory(token),
  );
  handle(
    'campaign:execute-world-relation-pair-history',
    async (
      command: import('../src/app/campaign/world-relation-pair-contracts').WorldRelationPairHistoryCommand,
    ) => await store.executeWorldRelationPairHistory(command),
  );
  handle(
    'campaign:reconcile-world-relation-pair-history',
    async (
      command: import('../src/app/campaign/world-relation-pair-contracts').WorldRelationPairHistoryCommand,
      token: string,
    ) => await store.reconcileWorldRelationPairHistory(command, token),
  );
  handle(
    'campaign:npc-cast',
    async (token: string, q: import('../src/app/campaign/npc-cast-contracts').NpcCastQuery) =>
      await store.npcCast(token, q),
  );
  handle(
    'campaign:npc-building-choices',
    async (
      token: string,
      id: string,
      q: import('../src/app/campaign/npc-places-contracts').NpcBuildingQuery,
    ) => await store.npcBuildingChoices(token, id, q),
  );
  handle(
    'campaign:npc-places',
    async (token: string, id: string, offset: number) => await store.npcPlaces(token, id, offset),
  );
  handle('campaign:npc-plan-calendar', async (token: string) => await store.npcPlanCalendar(token));
  handle(
    'campaign:npc-dossier',
    async (token: string, sceneId: string, id: string) =>
      await store.npcDossier(token, sceneId, id),
  );
  handle('campaign:npc-drafts', async (token: string) => await store.npcDrafts(token));
  handle(
    'campaign:npc-draft',
    async (token: string, id: string) => await store.npcDraft(token, id),
  );
  handle(
    'campaign:keep-npc-draft',
    async (token: string, d: NpcDraft, expected: string | null) =>
      await store.keepNpcDraft(token, d, expected),
  );
  handle(
    'campaign:discard-npc-draft',
    async (token: string, id: string, writeId: string) =>
      await store.discardNpcDraft(token, id, writeId),
  );
  handle('campaign:npcs', async (token: string, q: NpcQuery) => await store.npcs(token, q));
  handle('campaign:npc', async (token: string, id: string) => await store.npc(token, id));
  handle(
    'campaign:reconcile-npc',
    async (c: NpcCommand, token: string) => await store.reconcileNpc(c, token),
  );
  handle('campaign:execute-npc', async (c: NpcCommand) => await store.executeNpc(c));
  handle(
    'campaign:generation-sources',
    async (token: string) => await store.generationSources(token),
  );
  handle(
    'campaign:encounter-tables',
    async (token: string, trashed: boolean) => await store.encounterTables(token, trashed),
  );
  handle(
    'campaign:loot-tables',
    async (token: string, trashed: boolean) => await store.lootTables(token, trashed),
  );
  handle(
    'campaign:preset-registry',
    async (campaignId: string | null) => await store.presetRegistry(campaignId),
  );
  handle(
    'campaign:preset-command',
    async (command: import('../src/app/campaign/generation-contracts').PresetCommand) =>
      await store.presetCommand(command),
  );
  handle(
    'campaign:preset-outcome',
    async (command: import('../src/app/campaign/generation-contracts').PresetCommand) =>
      await store.presetOutcome(command),
  );
  handle(
    'campaign:generator-registry',
    async (token: string) => await store.generatorRegistry(token),
  );
  handle(
    'campaign:execute-generation',
    async (command: GenerationCommand) => await store.executeGeneration(command),
  );
  handle(
    'campaign:generate-encounters',
    async (token: string, request: GenerationRequest) =>
      await store.generateEncounters(token, request),
  );
  handle(
    'campaign:accept-generation',
    async (command: Parameters<typeof store.acceptGeneration>[0]) =>
      await store.acceptGeneration(command),
  );
  handle('campaign:generation-runs', async (token: string) => await store.generationRuns(token));
  handle(
    'campaign:generation-run',
    async (token: string, id: string) => await store.generationRun(token, id),
  );
  handle('campaign:roll-loot', async (command: LootRollCommand) => await store.rollLoot(command));
  handle(
    'campaign:groups',
    async (token: string, search: string, after: string | null) =>
      await store.preparedGroups(token, search, after),
  );
  handle(
    'campaign:group-view',
    async (token: string, id: string) => await store.groupView(token, id),
  );
  handle(
    'campaign:group-draft',
    async (token: string, id: string) => await store.groupDraft(token, id),
  );
  handle(
    'campaign:keep-group-draft',
    async (
      token: string,
      draft: import('../src/app/campaign/groups-contracts').GroupDraft,
      expected: string | null,
    ) => await store.keepGroupDraft(token, draft, expected),
  );
  handle(
    'campaign:discard-group-draft',
    async (token: string, id: string, writeId: string) =>
      await store.discardGroupDraft(token, id, writeId),
  );
  handle(
    'campaign:prepared-group',
    async (token: string, id: string) => await store.preparedGroup(token, id),
  );
  handle(
    'campaign:reconcile-preparation-plan',
    async (command: PreparationCommand, token?: string) =>
      await store.reconcilePreparationPlan(command, token),
  );
  handle(
    'campaign:change-preparation-plan',
    async (command: PreparationCommand) => await store.changePreparationPlan(command),
  );
  handle(
    'campaign:change-preparation',
    async (command: PreparationCommand) => await store.changePreparation(command),
  );
  handle(
    'campaign:select-preparation',
    async (token: string, selection: PreparationSelection) =>
      await store.selectPreparation(token, selection),
  );
  handle(
    'campaign:reconcile-preparation',
    async (command: PreparationCommand, token?: string) =>
      await store.reconcilePreparation(command, token),
  );
  handle(
    'campaign:preparation-draft',
    async (token: string, kind: PreparationEdit['kind'], id: string) =>
      await store.preparationDraft(token, kind, id),
  );
  handle(
    'campaign:keep-preparation-drafts',
    async (token: string, drafts: PreparationDraft[]) =>
      await store.keepPreparationDrafts(token, drafts),
  );
  handle(
    'campaign:discard-preparation-draft',
    async (token: string, kind: PreparationEdit['kind'], id: string, writeId: string) =>
      await store.discardPreparationDraft(token, kind, id, writeId),
  );
  return { close: scope.dispose };
}
