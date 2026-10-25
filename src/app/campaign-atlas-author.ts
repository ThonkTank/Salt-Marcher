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

const pending = new Map<string, AtlasCommand>();
editorSession.observeDraft(()=>({openInput:false,retainedDraft:false,unresolvedCommand:pending.size>0}));
export const pendingAtlasWrite = (token: string) => pending.get(token) ?? null;
async function writeAtlas(
  c: AtlasCommand,
): Promise<Result<{ atlas: CampaignAtlas; result: unknown }>> {
  if (pending.has(c.token))
    return {
      ok: false,
      error:
        "Ein Atlasauftrag hat noch keinen bestätigten Ausgang. Zuerst im Atlas „Speicherstand klären“ wählen.",
    };
  try {
    const result = await editorSession.run(()=>window.campaign.executeAtlas(c));
    if (result.ok) {
      pending.delete(c.token);
      document.dispatchEvent(
        new CustomEvent("atlas-written", { detail: result.value.atlas }),
      );
    }
    document.dispatchEvent(new Event("atlas-write-state"));
    return result;
  } catch (e) {
    pending.set(c.token, structuredClone(c));
    document.dispatchEvent(new Event("atlas-write-state"));
    return {
      ok: false,
      error:
        "Ausgang des Atlasauftrags unbekannt. Der Auftrag bleibt erhalten; „Speicherstand klären“ verwendet dieselbe Kennung. " +
        (e as Error).message,
    };
  }
}

/** Terrain changes need a durable receipt, not another complete campaign copy. */
export async function writeAtlasCommit(c: AtlasCommand): Promise<Result<import('./campaign-atlas-contracts').AtlasCommitAck>> {
  if(pending.has(c.token)) return {ok:false,error:'Ein Atlasauftrag hat noch keinen bestätigten Ausgang. Zuerst Speicherstand klären.'};
  try {
    const result=await editorSession.run(()=>window.campaign.executeAtlasCommit(c));
    if(result.ok){pending.delete(c.token);document.dispatchEvent(new CustomEvent('atlas-invalidated',{detail:result.value}));}
    document.dispatchEvent(new Event('atlas-write-state'));
    return result;
  } catch(e) {
    pending.set(c.token,structuredClone(c));document.dispatchEvent(new Event('atlas-write-state'));
    return {ok:false,error:'Ausgang des Atlasauftrags unbekannt. Der Auftrag bleibt mit derselben Kennung für Speicherstand klären erhalten. '+(e as Error).message};
  }
}

export async function recoverAtlasCommit(token:string):Promise<Result<import('./campaign-atlas-contracts').AtlasCommitAck>|null>{
  const command=pending.get(token);if(!command)return null;
  try{
    const result=await editorSession.run(()=>window.campaign.reconcileAtlasCommit(command));
    if(pending.get(token)!==command)return{ok:false,error:'Atlasauftrag inzwischen geändert. Speicherstand erneut klären.'};
    if(!result.ok)return result;
    if(result.value.outcome==='unknown')return{ok:false,error:'Atlasauftrag läuft noch. Speicherstand anschließend erneut klären.'};
    pending.delete(token);document.dispatchEvent(new Event('atlas-write-state'));
    if(result.value.outcome==='not-applied')return{ok:false,error:'Atlasauftrag wurde nicht gespeichert. Eingaben bleiben erhalten; Stand aktualisieren und erneut speichern.'};
    document.dispatchEvent(new CustomEvent('atlas-invalidated',{detail:result.value.ack}));
    return{ok:true,value:result.value.ack};
  }catch(e){return{ok:false,error:'Ausgang des Atlasauftrags weiter unbekannt. '+(e as Error).message};}
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
  if(pending.has(c.token))return{ok:false,error:'Ein Atlasauftrag hat noch keinen bestätigten Ausgang. Zuerst Speicherstand klären.'};
  try{
    const result=await editorSession.run(()=>window.campaign.atlasDrawingCommit(c));
    if(result.ok){pending.delete(c.token);document.dispatchEvent(new CustomEvent('atlas-invalidated',{detail:{token:c.token,campaignId:c.campaignId,revision:result.value.atlasRevision,preview:result.value.workspace.graphPreview}}));}
    document.dispatchEvent(new Event('atlas-write-state'));
    return result;
  }catch(e){
    pending.set(c.token,{commandId:c.commandId,token:c.token,campaignId:c.campaignId,target:structuredClone(c.target),action:{kind:'drawing',command:structuredClone(c)}});
    document.dispatchEvent(new Event('atlas-write-state'));
    return{ok:false,error:'Ausgang des Atlasauftrags unbekannt. Derselbe Auftrag bleibt für Speicherstand klären erhalten. '+(e as Error).message};
  }
}
export async function atlasRoomWrite(edit: Edit): Promise<Result<RoomCommit>> {
  if(pending.has(edit.token))return{ok:false,error:'Ein Atlasauftrag hat noch keinen bestätigten Ausgang. Zuerst Speicherstand klären.'};
  try{
    const result=await editorSession.run(()=>window.campaign.atlasRoomCommit(edit));
    if(result.ok)document.dispatchEvent(new CustomEvent('atlas-invalidated',{detail:{token:edit.token,campaignId:edit.campaignId,revision:result.value.atlasRevision,preview:result.value.graphPreview}}));
    return result;
  }catch(e){
    pending.set(edit.token,{commandId:edit.commandId,token:edit.token,campaignId:edit.campaignId,target:structuredClone(edit.target),action:{kind:'room-edit',edit:structuredClone(edit)}});
    document.dispatchEvent(new Event('atlas-write-state'));
    return{ok:false,error:'Ausgang des Atlasauftrags unbekannt. Dieselbe Kennung bleibt für Speicherstand klären erhalten. '+(e as Error).message};
  }
}
// World editors retain their field versions and reconcile lost replies read-only.
export function settleAtlasWorldWrite(c: WorldCommand) {
  const p = pending.get(c.token);
  if (p?.campaignId === c.campaignId && p.commandId === c.commandId && p.action.kind === "world") {
    pending.delete(c.token);
    document.dispatchEvent(new Event("atlas-write-state"));
  }
}
export async function atlasWorldWrite(
  c: WorldCommand,
): Promise<Result<WorldAck>> {
  if (!["map", "cell", "place", "place-presentation"].includes(c.action.kind))
    return window.campaign.executeWorld(c);
  const result = await wrap(c, { kind: "world", command: c });
  if (!result.ok) {
    if (pending.get(c.token)?.commandId === c.commandId) throw new Error(result.error);
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
  if (c.action.kind !== "accept") {
    if(pending.has(c.token))return{ok:false as const,error:'Ein Atlasauftrag hat noch keinen bestätigten Ausgang. Zuerst Speicherstand klären.'};
    try{return await editorSession.run(()=>window.campaign.executeGraph(c));}
    catch(error){
      pending.set(c.token,{commandId:c.commandId,token:c.token,campaignId:c.campaignId,target:structuredClone(c.target),action:{kind:'graph-preview',command:structuredClone(c)}});
      document.dispatchEvent(new Event('atlas-write-state'));
      return{ok:false as const,error:'Ausgang der Graphaktion unbekannt. Dieselbe Vorschau und Kennung bleiben zur Klärung erhalten. '+String(error)};
    }
  }
  const r = await writeAtlas({
    ...c,
    action: { kind: "graph-accept", command: c },
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
