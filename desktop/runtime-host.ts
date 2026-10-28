import type { ChronicleCategory } from '../src/app/runtime/chronicle-contracts';
import type { CombatCommand } from '../src/app/runtime/combat-contracts';
import type { LiveCommand } from '../src/app/runtime/live-contracts';
import type { ProgressCommand } from '../src/app/runtime/progression';
import { CommitTracker } from './commit-tracker';
import type { HostIpc } from './host-ipc';
import { StoreClient } from './store-client';
export function registerRuntimeHost(host: { ipc: HostIpc; store: StoreClient }) {
  const { store } = host;
  const scope = host.ipc.scope(),
    handle = scope.handle;

  handle('campaign:ledger-parties', async (token: string) => await store.ledgerParties(token));
  handle(
    'campaign:treasury-draft',
    async (token: string, id: string) => await store.treasuryDraft(token, id),
  );
  handle(
    'campaign:keep-treasury-draft',
    async (token: string, draft: any, expected: string | null) =>
      await store.keepTreasuryDraft(token, draft, expected),
  );
  handle(
    'campaign:discard-treasury-draft',
    async (token: string, id: string, writeId: string) =>
      await store.discardTreasuryDraft(token, id, writeId),
  );
  handle(
    'campaign:treasure-history',
    async (token: string, id: string, after: string | null) =>
      await store.treasureHistory(token, id, after),
  );
  handle(
    'campaign:scene-desk',
    async (token: string, id: string) => await store.sceneDesk(token, id),
  );
  handle(
    'campaign:search-desk',
    async (token: string, kind: string, search: string, offset: number) =>
      await store.searchDesk(token, kind, search, offset),
  );
  handle(
    'campaign:desk-content',
    async (token: string, ref: any) => await store.deskContent(token, ref),
  );
  handle(
    'campaign:pin-scene-desk',
    async (token: string, id: string, revision: number, ref: any, pin: boolean) =>
      await store.pinSceneDesk(token, id, revision, ref, pin),
  );
  handle(
    'campaign:scene-creation-draft',
    async (token: string, id: string) => await store.sceneCreationDraft(token, id),
  );
  handle(
    'campaign:keep-scene-creation-draft',
    async (token: string, id: string, draft: any, expected: string | null) =>
      await store.keepSceneCreationDraft(token, id, draft, expected),
  );
  handle(
    'campaign:keep-desk-draft',
    async (token: string, draft: any, expected: string | null) =>
      await store.keepDeskDraft(token, draft, expected),
  );
  handle(
    'campaign:finish-draft',
    async (token: string, owner: any) => await store.finishDraft(token, owner),
  );
  handle(
    'campaign:keep-finish-draft',
    async (token: string, draft: any, expected: string | null) =>
      await store.keepFinishDraft(token, draft, expected),
  );
  handle(
    'campaign:discard-finish-draft',
    async (token: string, owner: any, writeId: string) =>
      await store.discardFinishDraft(token, owner, writeId),
  );
  handle(
    'campaign:keep-narrative-draft',
    async (token: string, draft: any, expected: string | null) =>
      await store.keepNarrativeDraft(token, draft, expected),
  );
  handle(
    'campaign:discard-narrative-draft',
    async (token: string, id: string, writeId: string) =>
      await store.discardNarrativeDraft(token, id, writeId),
  );
  handle(
    'campaign:narrative-journal',
    async (
      token: string,
      query: import('../src/app/runtime/narrative-journal-contracts').NarrativeJournalQuery,
    ) => await store.narrativeJournal(token, query),
  );
  handle(
    'campaign:narrative',
    async (token: string, id: string) => await store.narrative(token, id),
  );
  handle(
    'campaign:progress-history',
    async (token: string, characterId: string, after: string | null) =>
      await store.progressHistory(token, characterId, after),
  );
  handle(
    'campaign:adventuring-day',
    async (
      token: string,
      request: import('../src/app/runtime/adventuring-day-contracts').DayRequest,
    ) => await store.adventuringDay(token, request),
  );
  handle('campaign:progress', async (token: string) => await store.progress(token));
  handle(
    'campaign:treasures',
    async (
      token: string,
      after: string | null,
      query?: import('../src/app/runtime/treasury-contracts').TreasureQuery,
    ) => await store.treasures(token, after, query),
  );
  handle('campaign:treasure', async (token: string, id: string) => await store.treasure(token, id));
  handle(
    'campaign:ledger',
    async (token: string, query: import('../src/app/runtime/progression').LedgerQuery) =>
      await store.ledger(token, query),
  );
  handle(
    'campaign:ledger-inventory',
    async (token: string, query: import('../src/app/runtime/progression').LedgerInventoryQuery) =>
      await store.ledgerInventory(token, query),
  );
  handle(
    'campaign:ledger-item',
    async (token: string, id: string) => await store.ledgerItem(token, id),
  );
  handle(
    'autonomy:decision',
    async (token: string, actorId: string) => await store.autonomyDecision(token, actorId),
  );
  handle('autonomy:view', async (token: string) => await store.autonomy(token));
  handle(
    'autonomy:execute',
    async (c: import('../src/app/runtime/autonomy-contracts').AutonomyCommand) =>
      await store.executeAutonomy(c),
  );
  handle(
    'world:time-preview',
    async (token: string, request: import('../src/app/runtime/time-plan-contracts').TimeRequest) =>
      await store.previewTime(token, request),
  );
  handle(
    'world:agenda',
    async (token: string, query: import('../src/app/runtime/agenda-contracts').AgendaQuery) =>
      await store.agenda(token, query),
  );
  handle('world:view', async (token: string) => await store.world(token));
  handle('world:scene', async (token: string, id: string) => await store.sceneWorld(token, id));
  handle(
    'world:travel-preview',
    async (
      token: string,
      request: import('../src/app/runtime/world-travel-contracts').TravelRequest,
    ) => await store.previewTravel(token, request),
  );
  handle(
    'world:reconcile',
    async (command: import('../src/app/runtime/world-contracts').WorldCommand, token: string) =>
      await store.reconcileWorld(command, token),
  );
  handle(
    'world:execute',
    async (command: import('../src/app/runtime/world-contracts').WorldCommand) =>
      await store.executeWorld(command),
  );
  const commits = new CommitTracker(async (ref, token) => await store.commitStatus(ref, token));
  handle(
    'campaign:commit-status',
    (ref: import('../src/app/shared/commit-receipt').CommitReference, token: string) =>
      commits.status(ref, token),
  );
  handle('items:execute', (command: import('../src/app/catalog/items-contracts').ItemShopCommand) =>
    commits.execute('items', command, async () => await store.executeItemShop(command)),
  );
  handle('campaign:execute-progress', (command: ProgressCommand) =>
    commits.execute('progress', command, async () => await store.executeProgress(command)),
  );
  handle('campaign:loot-balance', async (token: string) => await store.lootBalance(token));
  handle(
    'campaign:chronicle',
    async (token: string, category: ChronicleCategory | 'all' = 'all', search = '') =>
      await store.chronicle(token, category, search),
  );
  handle(
    'campaign:chronicle-page',
    async (
      token: string,
      category: ChronicleCategory | 'all',
      search: string,
      cursor: import('../src/app/runtime/chronicle-contracts').ChronicleCursor | null,
    ) => await store.chroniclePage(token, category, search, cursor),
  );
  handle(
    'campaign:chronicle-close',
    async (token: string, id: string) => await store.closeChroniclePage(token, id),
  );
  handle(
    'campaign:combat-draft',
    async (
      token: string,
      id: string,
      kind: import('../src/app/runtime/combat-draft-contracts').CombatDraftKind,
      target: string,
    ) => await store.combatDraft(token, id, kind, target),
  );
  handle(
    'campaign:combat-drafts',
    async (token: string, id: string, after: string | null) =>
      await store.combatDrafts(token, id, after),
  );
  handle(
    'campaign:keep-combat-draft',
    async (
      token: string,
      draft: import('../src/app/runtime/combat-draft-contracts').CombatWorkingDraft,
      expected: string | null,
    ) => await store.keepCombatDraft(token, draft, expected),
  );
  handle(
    'campaign:discard-combat-draft',
    async (
      token: string,
      id: string,
      kind: import('../src/app/runtime/combat-draft-contracts').CombatDraftKind,
      target: string,
      writeId: string,
    ) => await store.discardCombatDraft(token, id, kind, target, writeId),
  );
  handle(
    'campaign:combat-resolution',
    async (token: string, sceneId: string, id: string, after: string | null) =>
      await store.combatResolution(token, sceneId, id, after),
  );
  handle(
    'campaign:combat',
    async (token: string, sceneId: string, id?: string) => await store.combat(token, sceneId, id),
  );
  handle(
    'campaign:keep-chase-draft',
    async (
      token: string,
      draft: import('../src/app/runtime/chase-draft-contracts').ChaseWorkingDraft,
      expected: string | null,
    ) => await store.keepChaseDraft(token, draft, expected),
  );
  handle(
    'campaign:mask-history',
    async (
      token: string,
      sceneId: string,
      query: import('../src/app/runtime/mask-history-contracts').MaskHistoryQuery,
    ) => await store.maskHistory(token, sceneId, query),
  );
  handle(
    'campaign:chase',
    async (token: string, sceneId: string, id?: string) => await store.chase(token, sceneId, id),
  );
  handle(
    'campaign:execute-chase',
    (command: import('../src/app/runtime/chase-contracts').ChaseCommand) =>
      commits.execute('chase', command, async () => await store.executeChase(command)),
  );
  handle('campaign:execute-combat', (command: CombatCommand) =>
    commits.execute('combat', command, async () => await store.executeCombat(command)),
  );
  handle(
    'campaign:archived-roster',
    async (token: string, after: string | null, search: string) =>
      await store.archivedRoster(token, after, search),
  );
  handle('campaign:live', async (token: string) => await store.live(token));
  handle(
    'campaign:live-scene',
    async (token: string, id: string) => await store.liveScene(token, id),
  );
  handle(
    'campaign:live-archives',
    async (token: string, after: string | null) => await store.liveArchives(token, after),
  );
  handle(
    'campaign:keep-live-moment-draft',
    async (token: string, id: string, draft: any, expected: any) =>
      await store.keepLiveMomentDraft(token, id, draft, expected),
  );
  handle(
    'campaign:keep-session-recap-draft',
    async (token: string, draft: any, expected: any) =>
      await store.keepSessionRecapDraft(token, draft, expected),
  );
  handle('campaign:execute-live', async (command: LiveCommand) => await store.executeLive(command));
  handle(
    'campaign:live-status',
    async (command: LiveCommand, token: string) => await store.liveStatus(command, token),
  );
  return { close: scope.dispose };
}
