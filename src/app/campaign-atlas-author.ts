import {dispatchRecoverableAtlasWrite,atlasWriteReference,newGraphPreviewTarget} from './atlas-write-recovery';
import {sameAtlasWriteReference} from './atlas-write-receipt';
import type {AtlasWriteReference,AtlasWriteStatus,AtlasWriteInput} from './atlas-write-receipt';
import type {TerrainQueueAbsence} from './terrain-stroke-queue';
import {EditorSession} from './editor-session';
import type {GraphPreviewState,GraphPreviewTarget} from './graph-contracts';

import type { Result, Edit, RoomCommit } from "./contracts";
import type { CityCommand, CityView } from "./city-contracts";
import type { DrawingCommand, DrawingView } from "./drawing-contracts";
import type { WorldCommand, WorldAck } from "./world-contracts";
import type {
  AtlasAction,
  AtlasCommand,
  CampaignAtlas,
} from "./campaign-atlas-contracts";
/** Capture the source owned by this input, never a later global preview. */
export function graphPreviewTarget(state:GraphPreviewState|null|undefined):GraphPreviewTarget|undefined {
  return state?{kind:'graph-preview',previewId:state.id,scopeId:state.scopeId,revision:state.revision}:undefined;
}
export function graphPreviewMatches(target:GraphPreviewTarget|undefined,state:GraphPreviewState|null|undefined,exact=false){
  return target?!!state&&target.previewId===state.id&&target.scopeId===state.scopeId&&(exact?target.revision===state.revision:state.revision>=target.revision):!state;
}
export const editorSession = new EditorSession();

interface PendingAtlasOwner {
  campaignId:string; command?:AtlasCommand; reference?:AtlasWriteReference; error?:string;
  loading?:boolean; running?:boolean; finished?:Promise<void>; durableConfirmed?:boolean; rejected?:boolean;
}
const pending = new Map<string, PendingAtlasOwner>();
const blocked = 'Ein Atlasauftrag hat noch keinen bestätigten Ausgang. Zuerst im Atlas „Speicherstand klären“ wählen.';
const changed = () => document.dispatchEvent(new Event('atlas-write-state'));
editorSession.observeDraft(()=>({openInput:false,retainedDraft:false,unresolvedCommand:pending.size>0}));
/** Running payload and durable restart identity are deliberately separate. */
export const pendingAtlasWrite = (token:string) => {
  const p=pending.get(token);return p?.command??p?.reference??p??null;
};
export const atlasWriteOwnerState=(token:string)=>{const p=pending.get(token);return p?{campaignId:p.campaignId,reference:p.reference?structuredClone(p.reference):undefined,durableConfirmed:!!p.durableConfirmed,running:!!p.running,loading:!!p.loading,error:p.error}:null;};
const owns = (token:string,p:PendingAtlasOwner) => pending.get(token)===p;
const errorText = (e:unknown) => e instanceof Error?e.message:String(e);
function unresolved(error:string):Result<never>{return{ok:false,error,errorKind:'store-outcome-unknown'};}

/** Reserve before reading so a new activation cannot dispatch through a missing journal. */
export async function restoreAtlasWrites(campaignId:string,token:string):Promise<Result<void>> {
  const previous=[...pending.values()];
  const p:PendingAtlasOwner={campaignId,loading:true};
  pending.clear();
  pending.set(token,p);changed();
  try {
    await Promise.all(previous.map(value=>value.finished));
    if(!owns(token,p))return{ok:false,error:"Atlasaktivierung inzwischen geändert."};
    const result=await window.campaign.atlasWriteReferences(campaignId,token);
    if(!owns(token,p))return{ok:false,error:'Atlasaktivierung inzwischen geändert.'};
    if(!result.ok)throw Error(result.error);
    p.reference=result.value.find(ref=>ref.family!=='travel');p.durableConfirmed=!!p.reference;p.loading=false;
    if(!p.reference)pending.delete(token);
    changed();return{ok:true,value:undefined};
  } catch(e) {
    if(owns(token,p)){p.loading=false;p.error='Atlas-Klärungsreferenzen konnten nicht geladen werden: '+errorText(e);changed();}
    return{ok:false,error:p.error??errorText(e)};
  }
}

async function authorWrite<T>(command:AtlasCommand,input:AtlasWriteInput,dispatch:()=>Promise<Result<T>>,confirmed:(value:T)=>void):Promise<Result<T>> {
  if([...pending.values()].some(p=>p.campaignId===command.campaignId))return{ok:false,error:blocked};
  const captured=structuredClone(command),request=structuredClone(input);
  const p:PendingAtlasOwner={campaignId:command.campaignId,command:captured,running:true};
  let finish!:()=>void;p.finished=new Promise(resolve=>finish=resolve);
  pending.set(command.token,p);changed();
  try {
    p.reference=await atlasWriteReference(request);
    const result=await editorSession.run(()=>dispatchRecoverableAtlasWrite({keepAtlasWriteReference:async(ref,token)=>{
      const saved=await window.campaign.keepAtlasWriteReference(ref,token);
      if(saved.ok)p.durableConfirmed=true;
      else if(owns(token,p)) {
        // An occupied slot belongs to its original command, even when a caller
        // reached this module before activation finished restoring its journal.
        const stored=await window.campaign.atlasWriteReferences(command.campaignId,token);
        if(!owns(token,p))return saved;
        if(!stored.ok){p.reference=undefined;p.error=stored.error;}
        else {
          const original=stored.value.find(value=>value.family!=='travel');
          if(original&&!sameAtlasWriteReference(original,ref)){p.reference=original;p.command=undefined;}
        }
      }
      return saved;
    }},request,async()=>{
      if(!owns(command.token,p))throw Error('Atlasaktivierung inzwischen geändert. Auftrag bleibt zur Klärung erhalten.');
      return dispatch();
    }));
    if(!owns(command.token,p))return unresolved('Atlasaktivierung inzwischen geändert. Speicherstand im aktuellen Besitzer klären.');
    if(!result.ok&&result.errorKind==='store-outcome-unknown'){p.error=result.error;return result;}
    p.rejected=!result.ok;
    // Even an ordinary error may follow a commit. Main validates the receipt (or
    // its narrowly scoped first-preview rejection witness) before clearing.
    const clear=await window.campaign.clearAtlasWriteReference(p.reference,command.token);
    if(!owns(command.token,p))return unresolved('Atlasaktivierung inzwischen geändert. Speicherstand erneut klären.');
    if(!clear.ok)throw Error(clear.error);
    pending.delete(command.token);changed();
    if(result.ok)confirmed(result.value);
    return result;
  } catch(e) {
    p.running=false;p.error=errorText(e);
    if(owns(command.token,p))changed();
    return unresolved('Ausgang des Atlasauftrags ungeklärt. Der Auftrag bleibt erhalten; „Speicherstand klären“ liest dieselbe Kennung. '+errorText(e));
  } finally {p.running=false;finish();if(owns(command.token,p))changed();}
}
async function writeAtlas(c:AtlasCommand):Promise<Result<{atlas:CampaignAtlas;result:unknown}>> {
  const captured=structuredClone(c);
  return authorWrite(captured,{kind:'atlas',command:captured},()=>window.campaign.executeAtlas(captured),value=>{
    document.dispatchEvent(new CustomEvent('atlas-written',{detail:value.atlas}));
  });
}
/** Terrain changes need a durable receipt, not another complete campaign copy. */
export async function writeAtlasCommit(c:AtlasCommand):Promise<Result<import('./campaign-atlas-contracts').AtlasCommitAck>> {
  const captured=structuredClone(c);
  return authorWrite(captured,{kind:'atlas',command:captured},()=>window.campaign.executeAtlasCommit(captured),value=>{
    document.dispatchEvent(new CustomEvent('atlas-invalidated',{detail:value}));
  });
}
/** Local in-memory binding for a held terrain journal. No command is replayed;
 * clearing the durable witness and releasing the writer slot are separate so
 * A can install its complete checkpoint before the existing suffix writes. */
export function captureTerrainWriteRecovery(token:string){
 const owner=pending.get(token),command=owner?.command,reference=owner?.reference;
 if(!owner||owner.loading||owner.running||!command||!reference||command.action.kind!=='landscape-height-stroke'||!command.terrainStroke||command.target)return null;
 const captured=structuredClone(command),receipt=structuredClone(reference);
 const current=()=>owns(token,owner)&&!owner.running&&owner.command===command&&owner.reference===reference;
 let latestProof:TerrainQueueAbsence|null=null;
 const readReceipt=async()=>{latestProof=null;if(!current())throw Error('Speicherklärung inzwischen geändert.');const result=await window.campaign.reconcileAtlasCommit(captured);if(!current())throw Error('Speicherklärung inzwischen geändert.');if(!result.ok)throw Error(result.error);if(result.value.outcome==='unknown')throw Error('Ausgang des Auftrags weiter ungeklärt.');return result.value;};
 const proof=()=>{const witness:TerrainQueueAbsence=Object.freeze({outcome:'not-applied',command:captured,receipt,current:()=>latestProof===witness&&current()});latestProof=witness;return witness;};
 return Object.freeze({command:captured,receipt,current,
  async read(){const result=await readReceipt();if(result.outcome==='not-applied')return{outcome:'not-applied' as const,absence:proof()};const source=await window.campaign.atlasTerrainSource(token);if(!current())throw Error('Speicherklärung inzwischen geändert.');if(!source.ok)throw Error(source.error);return{outcome:'applied' as const,ack:{...result.ack,sourceFence:source.value.fence},source:{token,...source.value}};},
  async absent(){const result=await readReceipt();if(result.outcome!=='not-applied')throw Error('Ausgang des ursprünglichen Auftrags hat sich geändert. Speicherstand erneut klären.');return proof();},
  async clear(){if(!current())throw Error('Speicherklärung inzwischen geändert.');const result=await window.campaign.clearAtlasWriteReference(receipt,token);if(!current())throw Error('Speicherklärung inzwischen geändert.');if(!result.ok)throw Error(result.error);},
  release(){if(!current())throw Error('Speicherklärung inzwischen geändert.');pending.delete(token);changed();}
 });
}

/** Read the original receipt using current activation authority; never replay. */
export async function recoverAtlasCommit(token:string):Promise<Result<AtlasWriteStatus>|null> {
  let p=pending.get(token);if(!p)return null;
  if(p.loading||p.running)return{ok:false,error:'Atlasauftrag läuft noch. Speicherstand anschließend erneut klären.'};
  if(!p.reference){
    const campaignId=p.campaignId,result=await restoreAtlasWrites(campaignId,token);
    if(!result.ok)return result;p=pending.get(token);if(!p)return{ok:true,value:{outcome:'not-applied'}};
  }
  const owner=p;
  try {
    if(!owner.reference)throw Error(owner.error??'Atlas-Klärungsreferenz fehlt.');
    const result=await editorSession.run(()=>window.campaign.atlasWriteStatus(owner.reference!,token));
    if(!owns(token,owner))throw Error('Atlasauftrag inzwischen geändert. Speicherstand erneut klären.');
    if(!result.ok)return result;
    if(result.value.outcome==='unknown'&&!(owner.rejected&&owner.command?.action.kind==='graph-preview'))return{ok:false,error:'Ausgang des Atlasauftrags weiter unbekannt; Auftrag läuft noch oder sein Beleg ist nicht lesbar.'};
    const clear=await window.campaign.clearAtlasWriteReference(owner.reference,token);
    if(!owns(token,owner))throw Error('Atlasauftrag inzwischen geändert. Speicherstand erneut klären.');
    if(!clear.ok)return clear;
    pending.delete(token);changed();return result.value.outcome==='unknown'?{ok:true,value:{outcome:'not-applied'}}:result;
  } catch(e) {return{ok:false,error:'Ausgang des Atlasauftrags weiter ungeklärt. '+errorText(e)};}
}

const wrap = (
  c: { commandId: string; token: string; campaignId: string },
  action: AtlasAction,
) => writeAtlas({ ...c, action });
export async function atlasCityWrite(
  c: CityCommand,
): Promise<Result<CityView>> {
  if (c.action.kind === "undo" || c.action.kind === "redo") {
    const result = await wrap(c, { kind: c.action.kind });
    return result.ok
      ? {
          ok: true,
          value: result.value.atlas.cities.find(
            (x) => x.header.id === c.cityId,
          )!,
        }
      : result;
  }
  const result = await wrap(c, { kind: "city", command: c });
  return result.ok
    ? {
        ok: true,
        value: result.value.atlas.cities.find((x) => x.header.id === c.cityId)!,
      }
    : result;
}
export async function atlasDrawingWrite(
  c: DrawingCommand,
): Promise<
  Result<{ workspace: import("./contracts").Workspace; view: DrawingView }>
> {
  const captured=structuredClone(c),command:AtlasCommand={commandId:c.commandId,token:c.token,campaignId:c.campaignId,target:structuredClone(c.target),action:{kind:'drawing',command:captured}};
  return authorWrite(command,{kind:'atlas',command},()=>window.campaign.atlasDrawingCommit(captured),value=>{
    document.dispatchEvent(new CustomEvent('atlas-invalidated',{detail:{token:c.token,campaignId:c.campaignId,revision:value.atlasRevision,preview:value.workspace.graphPreview}}));
  });
}
export async function atlasRoomWrite(edit:Edit):Promise<Result<RoomCommit>> {
  const captured=structuredClone(edit),command:AtlasCommand={commandId:edit.commandId,token:edit.token,campaignId:edit.campaignId,target:structuredClone(edit.target),action:{kind:'room-edit',edit:captured}};
  return authorWrite(command,{kind:'atlas',command},()=>window.campaign.atlasRoomCommit(captured),value=>{
    document.dispatchEvent(new CustomEvent('atlas-invalidated',{detail:{token:edit.token,campaignId:edit.campaignId,revision:value.atlasRevision,preview:value.graphPreview}}));
  });
}
// World editors retain their field versions and reconcile lost replies read-only.
export async function settleAtlasWorldWrite(c:WorldCommand):Promise<void> {
  const p=pending.get(c.token);
  if(!p)return;
  if(p.command?.campaignId!==c.campaignId||p.command.commandId!==c.commandId||p.command.action.kind!=='world')return;
  const result=await recoverAtlasCommit(c.token);
  if(!result?.ok)throw Error(result&&!result.ok?result.error:'Atlasauftrag bleibt ungeklärt.');
}
export async function atlasWorldWrite(
  c: WorldCommand,
): Promise<Result<WorldAck>> {
  if (!["map", "cell", "place", "place-presentation"].includes(c.action.kind))
    return window.campaign.executeWorld(c);
  const result = await wrap(c, { kind: "world", command: c });
  if (!result.ok) {
    if (pending.get(c.token)?.command?.commandId === c.commandId) throw new Error(result.error);
    return result;
  }
  if (result.value.result)
    return { ok: true, value: result.value.result as WorldAck };
  const world = await window.campaign.world(c.token);
  return world.ok
    ? {
        ok: true,
        value: { world: world.value, scene: result.value.atlas.scene },
      }
    : world;
}

export async function atlasHistoryWrite(
  token: string,
  campaignId: string,
  kind: "undo" | "redo",
  target?:GraphPreviewTarget,
): Promise<Result<import("./contracts").Workspace>> {
  const r = await writeAtlas({
    commandId: crypto.randomUUID(),
    token,
    campaignId,
    action: { kind },target,
  });
  return r.ok ? { ok: true, value: r.value.atlas.workspace } : r;
}

export async function atlasGraphWrite(
  c: import("./graph-contracts").GraphCommand,
) {
  // Selection is navigation, including selection inside an existing preview.
  if(c.action.kind==='select') {
    if([...pending.values()].some(p=>p.campaignId===c.campaignId))return{ok:false as const,error:blocked};
    const captured=structuredClone(c);
    return editorSession.run(()=>[...pending.values()].some(p=>p.campaignId===captured.campaignId)?Promise.resolve({ok:false as const,error:blocked}):window.campaign.executeGraph(captured));
  }
  if(!c.target&&['accept','restore'].includes(c.action.kind))return{ok:false as const,error:'Graphvorschau fehlt. Erneut öffnen.'};
  const captured:import('./graph-contracts').GraphCommand={...structuredClone(c),target:c.target?structuredClone(c.target):newGraphPreviewTarget(c.scopeId)};
  if(captured.action.kind!=='accept') {
    const command:AtlasCommand={commandId:captured.commandId,token:captured.token,campaignId:captured.campaignId,target:captured.target,action:{kind:'graph-preview',command:captured}};
    return authorWrite(command,{kind:'graph',command:captured},()=>window.campaign.executeGraph(captured),()=>{});
  }
  const r = await writeAtlas({
    ...captured,
    action: { kind: "graph-accept", command: captured },
  });
  return r.ok
    ? {
        ok: true as const,
        value: r.value.result as {
          workspace: import("./contracts").Workspace;
          view: import("./graph-contracts").GraphView;
        },
      }
    : r;
}

export async function atlasDefaultRoomWrite(
  token: string,
  campaignId: string,
  target?:GraphPreviewTarget,
): Promise<Result<import("./contracts").Workspace>> {
  const r = await writeAtlas({
    commandId: crypto.randomUUID(),
    token,
    campaignId,
    action: { kind: "room-default" },target,
  });
  return r.ok ? { ok: true, value: r.value.atlas.workspace } : r;
}
