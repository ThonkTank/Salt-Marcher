import type {WorkspaceGeometry} from './contracts';
import {EditorRegistry, type EditorBoundary} from './editor-registry';
import type {EditorSession} from './editor-session';
import * as npcs from './npc-ui';
import * as groups from './groups-ui';
import * as treasury from './treasury-ui';
import * as triggers from './trigger-ui';
import * as content from './dungeon-content-ui';
import * as graph from './graph-ui';
import * as keys from './key-ui';
import * as paths from './path-ui';
import * as volume from './volume-ui';
import * as dungeon from './dungeon-ui';
import * as drawing from './drawing-ui';
import * as autonomy from './autonomy-ui';
import * as city from './city-ui';
import * as music from './music-ui';
import * as world from './world-ui';
import * as items from './items-ui';
import * as catalog from './catalog-ui';
import * as live from './live';
import * as preparation from './preparation';
import {editorSession as finishSession} from './finish-draft-ui';
import {editorSession as combatSession} from './combat';
import {editorSession as chaseSession} from './chase-ui';
import {editorSession as progressionSession} from './progression-ui';
import {editorSession as deskSession} from './scene-desk-ui';
import {editorSession as narrativeSession} from './narrative-ui';
import {editorSession as planningSession} from './session-ui';
import {editorSession as generationSession} from './generation-ui';

type Host = {
  atlas: {session: EditorSession; activate: (w: WorkspaceGeometry) => void; flush: () => Promise<boolean>};
  room: {session: EditorSession; flush: () => Promise<boolean>; leave: () => Promise<boolean>};
  gate: () => EditorBoundary;
  beforeTool: () => boolean;
  views: readonly {id: string; order: number; activate: (w: WorkspaceGeometry) => void; deactivate?: () => void; suspendBeforeActivation?: boolean}[];
};

/** Declaration order is the historical drain order. Activation order differs
 * intentionally (Live owns the subeditors; preparation activates last). */
export function createWorkspaceEditors(host: Host) {
  const registry = new EditorRegistry<WorkspaceGeometry, string>([
    {id:'atlas',session:host.atlas.session,activate:{order:0,run:host.atlas.activate},flush:r=>r==='checkpoint'||host.atlas.flush()},
    {id:'playback',flush:async r=>{if(r!=='checkpoint')await world.stopWorldPlayback();return true;}},
    {id:'npcs',session:npcs.editorSession,activate:{order:12,run:npcs.activateNpcs},flush:npcs.flushNpcs},
    {id:'groups',session:groups.editorSession,activate:{order:11,run:groups.activateGroups},flush:groups.flushGroups},
    {id:'treasury',session:treasury.editorSession,activate:{order:10,run:treasury.activateTreasury},flush:treasury.flushTreasury},
    {id:'triggers',session:triggers.editorSession,activate:{order:25,run:triggers.activateTriggers},flush:triggers.flushTriggers},
    {id:'content',session:content.editorSession,activate:{order:24,run:content.activateDungeonContent},flush:content.flushDungeonContent},
    {id:'graph',session:graph.editorSession,activate:{order:23,run:graph.activateGraph},flush:graph.flushGraph},
    {id:'keys',session:keys.editorSession,activate:{order:22,run:keys.activateKeys},flush:keys.flushKeys},
    {id:'paths',session:paths.editorSession,activate:{order:21,run:paths.activatePaths},flush:paths.flushPaths},
    {id:'volume',session:volume.editorSession,activate:{order:20,run:volume.activateVolume},flush:volume.flushVolume},
    {id:'dungeon',session:dungeon.editorSession,activate:{order:16,run:dungeon.activateDungeon},flush:dungeon.flushDungeon},
    {id:'drawing',session:drawing.editorSession,activate:{order:26,run:w=>drawing.activateDrawing(w,false)},flush:drawing.flushDrawing},
    {id:'autonomy',session:autonomy.editorSession,activate:{order:15,run:autonomy.activateAutonomy},flush:autonomy.flushAutonomy},
    {id:'city',session:city.editorSession,activate:{order:14,run:city.activateCity},flush:city.flushCity},
    {id:'activation-gate',flush:r=>r==='checkpoint'||host.gate()},
    {id:'music',session:music.editorSession,activate:{order:28,run:music.activateMusic},flush:music.flushMusic,deactivate:music.deactivateMusic,suspendBeforeActivation:true},
    {id:'world',session:world.editorSession,activate:{order:13,run:world.activateWorld},flush:world.flushWorld},
    {id:'items',session:items.editorSession,activate:{order:9,run:items.activateItems},flush:items.flushItems},
    {id:'catalog',session:catalog.editorSession,activate:{order:8,run:catalog.activateCatalog},flush:catalog.flushCatalog},
    {id:'live',session:live.editorSession,activate:{order:1,run:live.activateLive},flush:live.flushLive},
    {id:'preparation',session:preparation.editorSession,activate:{order:29,run:w=>preparation.activatePreparation(w,false)},flush:r=>r==='checkpoint'?preparation.flushPreparation():preparation.leavePreparation()},
    {id:'room',session:host.room.session,flush:r=>r==='checkpoint'?host.room.flush():host.room.leave()},
    // Subeditor flush/context hooks stay with their parent and keep its lock scope.
    ...[finishSession,combatSession,chaseSession,progressionSession,deskSession,narrativeSession,planningSession,generationSession].map((session,i)=>({id:'child-'+i,session})),
    ...host.views.map(view=>({id:view.id,activate:{order:view.order,run:view.activate},deactivate:view.deactivate,suspendBeforeActivation:view.suspendBeforeActivation})),
  ]);
  const tools = ['triggers','content','graph','keys','paths','volume','drawing','autonomy','city','music','world','items','catalog','live','preparation','room'] as const;
  return {
    activate:(w:WorkspaceGeometry)=>registry.activate(w),
    flush:async (reason:import('./editor-registry').EditorTransition)=>await registry.flush(reason)&&(!(reason==='campaign'||reason==='close')||graph.canLeaveGraphPreview()),
    deactivate:()=>registry.deactivate(),
    suspend:()=>registry.suspend(),
    changed:()=>registry.changed(),
    before:async (editor:typeof tools[number])=>host.beforeTool()&&await registry.flush('navigation',tools.slice(tools.indexOf(editor)+1).filter(id=>id!=='room'))&&host.room.flush(),
  };
}
