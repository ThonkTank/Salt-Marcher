import type { WorkspaceGeometry } from '../shared/contracts';
import { EditorRegistry, type EditorBoundary } from '../shared/editor-registry';
import type { EditorSession } from '../shared/editor-session';
import type { NpcEditor } from '../campaign/npc-ui';
import * as groups from '../campaign/groups-ui';
import * as treasury from '../runtime/treasury-ui';
import * as triggers from '../runtime/trigger-ui';
import * as content from '../atlas/dungeon-content-ui';
import * as graph from '../atlas/graph-ui';
import * as keys from '../campaign/key-ui';
import * as paths from '../atlas/path-ui';
import * as volume from '../atlas/volume-ui';
import * as dungeon from '../atlas/dungeon-ui';
import * as drawing from '../atlas/drawing-ui';
import * as autonomy from '../runtime/autonomy-ui';
import * as city from '../atlas/city-ui';
import type { MusicEditor } from '../runtime/music-ui';
import type { ItemsEditor } from '../catalog/items-ui';
import * as catalog from '../catalog/catalog-ui';
import type { LiveEditor } from '../runtime/live';
import type { PreparationEditor } from '../campaign/preparation';
import { editorSession as finishSession } from '../runtime/finish-draft-ui';
import type { CombatEditor } from '../runtime/combat';
import { editorSession as chaseSession } from '../runtime/chase-ui';
import { editorSession as progressionSession } from '../runtime/progression-ui';
import { editorSession as deskSession } from '../runtime/scene-desk-ui';
import { editorSession as narrativeSession } from '../runtime/narrative-ui';
import { editorSession as planningSession } from '../campaign/session-ui';
import { editorSession as generationSession } from '../campaign/generation-ui';
import type { WorldEditor } from '../runtime/world-ui';
type Host = {
  world: WorldEditor;
  items: ItemsEditor;
  music: MusicEditor;
  npcs: NpcEditor;
  preparation: PreparationEditor;
  live: LiveEditor;
  combat: CombatEditor;
  atlas: {
    session: EditorSession;
    activate: (w: WorkspaceGeometry) => void;
    flush: () => Promise<boolean>;
    deactivate: () => void;
  };
  room: { session: EditorSession; flush: () => Promise<boolean>; leave: () => Promise<boolean> };
  gate: () => EditorBoundary;
  beforeTool: () => boolean;
  views: readonly {
    id: string;
    order: number;
    activate: (w: WorkspaceGeometry) => void;
    deactivate?: () => void;
    suspendBeforeActivation?: boolean;
  }[];
};

/** Declaration order is the historical drain order. Activation order differs
 * intentionally (Live owns the subeditors; preparation activates last). */
export function createWorkspaceEditors(host: Host) {
  const registry = new EditorRegistry<WorkspaceGeometry, string>([
    {
      id: 'atlas',
      session: host.atlas.session,
      activate: { order: 0, run: host.atlas.activate },
      flush: (r) => r === 'checkpoint' || host.atlas.flush(),
      deactivate: host.atlas.deactivate,
      // Main cancels source reads during activation; retire their renderer
      // generation before that asynchronous boundary can return a cancellation.
      suspendBeforeActivation: true,
    },
    {
      id: 'playback',
      flush: async (r) => {
        if (r !== 'checkpoint') await host.world.stopWorldPlayback();
        return true;
      },
    },
    {
      id: 'npcs',
      session: host.npcs.editorSession,
      activate: { order: 12, run: host.npcs.activateNpcs },
      flush: host.npcs.flushNpcs,
    },
    {
      id: 'groups',
      session: groups.editorSession,
      activate: { order: 11, run: groups.activateGroups },
      flush: groups.flushGroups,
    },
    {
      id: 'treasury',
      session: treasury.editorSession,
      activate: { order: 10, run: treasury.activateTreasury },
      flush: treasury.flushTreasury,
    },
    {
      id: 'triggers',
      session: triggers.editorSession,
      activate: { order: 25, run: triggers.activateTriggers },
      flush: triggers.flushTriggers,
    },
    {
      id: 'content',
      session: content.editorSession,
      activate: { order: 24, run: content.activateDungeonContent },
      flush: content.flushDungeonContent,
    },
    {
      id: 'graph',
      session: graph.editorSession,
      activate: { order: 23, run: graph.activateGraph },
      flush: graph.flushGraph,
    },
    {
      id: 'keys',
      session: keys.editorSession,
      activate: { order: 22, run: keys.activateKeys },
      flush: keys.flushKeys,
    },
    {
      id: 'paths',
      session: paths.editorSession,
      activate: { order: 21, run: paths.activatePaths },
      flush: paths.flushPaths,
    },
    {
      id: 'volume',
      session: volume.editorSession,
      activate: { order: 20, run: volume.activateVolume },
      flush: volume.flushVolume,
    },
    {
      id: 'dungeon',
      session: dungeon.editorSession,
      activate: { order: 16, run: dungeon.activateDungeon },
      flush: dungeon.flushDungeon,
    },
    {
      id: 'drawing',
      session: drawing.editorSession,
      activate: { order: 26, run: (w) => drawing.activateDrawing(w, false) },
      flush: drawing.flushDrawing,
    },
    {
      id: 'autonomy',
      session: autonomy.editorSession,
      activate: { order: 15, run: autonomy.activateAutonomy },
      flush: autonomy.flushAutonomy,
    },
    {
      id: 'city',
      session: city.editorSession,
      activate: { order: 14, run: city.activateCity },
      flush: city.flushCity,
    },
    { id: 'activation-gate', flush: (r) => r === 'checkpoint' || host.gate() },
    {
      id: 'music',
      session: host.music.editorSession,
      activate: { order: 28, run: host.music.activateMusic },
      flush: host.music.flushMusic,
      deactivate: host.music.deactivateMusic,
      suspendBeforeActivation: true,
    },
    {
      id: 'world',
      session: host.world.editorSession,
      activate: { order: 13, run: host.world.activateWorld },
      flush: host.world.flushWorld,
    },
    {
      id: 'items',
      session: host.items.editorSession,
      activate: { order: 9, run: host.items.activateItems },
      flush: host.items.flushItems,
    },
    {
      id: 'catalog',
      session: catalog.editorSession,
      activate: { order: 8, run: catalog.activateCatalog },
      flush: catalog.flushCatalog,
    },
    {
      id: 'live',
      session: host.live.editorSession,
      activate: { order: 1, run: host.live.activateLive },
      flush: host.live.flushLive,
    },
    {
      id: 'preparation',
      session: host.preparation.editorSession,
      activate: { order: 29, run: (w) => host.preparation.activatePreparation(w, false) },
      flush: (r) =>
        r === 'checkpoint'
          ? host.preparation.flushPreparation()
          : host.preparation.leavePreparation(),
    },
    {
      id: 'room',
      session: host.room.session,
      flush: (r) => (r === 'checkpoint' ? host.room.flush() : host.room.leave()),
    },
    // Subeditor flush/context hooks stay with their parent and keep its lock scope.
    ...[
      finishSession,
      host.combat.editorSession,
      chaseSession,
      progressionSession,
      deskSession,
      narrativeSession,
      planningSession,
      generationSession,
    ].map((session, i) => ({ id: 'child-' + i, session })),
    ...host.views.map((view) => ({
      id: view.id,
      activate: { order: view.order, run: view.activate },
      deactivate: view.deactivate,
      suspendBeforeActivation: view.suspendBeforeActivation,
    })),
  ]);
  const tools = [
    'triggers',
    'content',
    'graph',
    'keys',
    'paths',
    'volume',
    'drawing',
    'autonomy',
    'city',
    'music',
    'world',
    'items',
    'catalog',
    'live',
    'preparation',
    'room',
  ] as const;
  return {
    activate: (w: WorkspaceGeometry) => registry.activate(w),
    flush: async (reason: import('../shared/editor-registry').EditorTransition) =>
      (await registry.flush(reason)) &&
      (!(reason === 'campaign' || reason === 'close') || graph.canLeaveGraphPreview()),
    deactivate: () => registry.deactivate(),
    suspend: () => registry.suspend(),
    changed: () => registry.changed(),
    before: async (editor: (typeof tools)[number]) =>
      host.beforeTool() &&
      (await registry.flush(
        'navigation',
        tools.slice(tools.indexOf(editor) + 1).filter((id) => id !== 'room'),
      )) &&
      host.room.flush(),
  };
}
