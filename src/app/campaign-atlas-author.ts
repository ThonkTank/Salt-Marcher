import {canonicalJson} from './generation/canonical-json';
import type { Result, Edit, RoomCommit } from "./contracts";
import type { CityCommand, CityView } from "./city-contracts";
import type { DrawingCommand, DrawingView } from "./drawing-contracts";
import type { WorldCommand, WorldAck } from "./world-contracts";
import type {
  AtlasAction,
  AtlasCommand,
  CampaignAtlas,
} from "./campaign-atlas-contracts";
const pending = new Map<string, AtlasCommand>();
export const pendingAtlasWrite = (token: string) => pending.get(token) ?? null;
export async function recoverAtlasWrite(token: string) {
  const c = pending.get(token);
  if (!c) return null;
  return writeAtlas(c, true);
}
export async function writeAtlas(
  c: AtlasCommand,
  recovery = false,
): Promise<Result<{ atlas: CampaignAtlas; result: unknown }>> {
  const previous=pending.get(c.token);
  if (previous && !recovery && canonicalJson(previous)!==canonicalJson(c))
    return {
      ok: false,
      error:
        "Ein Atlasauftrag hat noch keinen bestätigten Ausgang. Zuerst im Atlas „Speicherstand klären“ wählen.",
    };
  try {
    const result = await window.campaign.executeAtlas(c);
    // An explicit response settles this request, including a rejected replay.
    if(pending.get(c.token)?.commandId===c.commandId)pending.delete(c.token);
    if (result.ok) {
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
    const result=await window.campaign.executeAtlasCommit(c);
    if(result.ok)document.dispatchEvent(new CustomEvent('atlas-invalidated',{detail:result.value}));
    document.dispatchEvent(new Event('atlas-write-state'));
    return result;
  } catch(e) {
    pending.set(c.token,structuredClone(c));document.dispatchEvent(new Event('atlas-write-state'));
    return {ok:false,error:'Ausgang des Atlasauftrags unbekannt. Der Auftrag bleibt mit derselben Kennung für Speicherstand klären erhalten. '+(e as Error).message};
  }
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
  const result = await wrap(c, { kind: "drawing", command: c });
  return result.ok
    ? {
        ok: true,
        value: {
          workspace: result.value.atlas.workspace,
          view: result.value.atlas.geometry.drawing,
        },
      }
    : result;
}
export async function atlasRoomWrite(edit: Edit): Promise<Result<RoomCommit>> {
  if(pending.has(edit.token))return{ok:false,error:'Ein Atlasauftrag hat noch keinen bestätigten Ausgang. Zuerst Speicherstand klären.'};
  try{
    const result=await window.campaign.atlasRoomCommit(edit);
    if(result.ok)document.dispatchEvent(new CustomEvent('atlas-invalidated',{detail:{token:edit.token,campaignId:edit.campaignId,revision:result.value.atlasRevision}}));
    return result;
  }catch(e){
    pending.set(edit.token,{commandId:edit.commandId,token:edit.token,campaignId:edit.campaignId,action:{kind:'room-edit',edit:structuredClone(edit)}});
    document.dispatchEvent(new Event('atlas-write-state'));
    return{ok:false,error:'Ausgang des Atlasauftrags unbekannt. Dieselbe Kennung bleibt für Speicherstand klären erhalten. '+(e as Error).message};
  }
}
/** A verified, read-only World reconciliation settles the same nested Atlas write. */
export function settleAtlasWorldWrite(command:WorldCommand) {
  const captured=pending.get(command.token);
  if(!captured||captured.action.kind!=='world'||canonicalJson(captured.action.command)!==canonicalJson(command))return;
  pending.delete(command.token);
  document.dispatchEvent(new Event("atlas-write-state"));
}
export async function atlasWorldWrite(
  c: WorldCommand,
): Promise<Result<WorldAck>> {
  if (!["map", "cell", "place", "place-create", "place-presentation"].includes(c.action.kind))
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
): Promise<Result<import("./contracts").Workspace>> {
  const r = await writeAtlas({
    commandId: crypto.randomUUID(),
    token,
    campaignId,
    action: { kind },
  });
  return r.ok ? { ok: true, value: r.value.atlas.workspace } : r;
}

export async function atlasGraphWrite(
  c: import("./graph-contracts").GraphCommand,
) {
  if (c.action.kind !== "accept") return window.campaign.executeGraph(c);
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
): Promise<Result<import("./contracts").Workspace>> {
  const r = await writeAtlas({
    commandId: crypto.randomUUID(),
    token,
    campaignId,
    action: { kind: "room-default" },
  });
  return r.ok ? { ok: true, value: r.value.atlas.workspace } : r;
}

export async function atlasLocationWrite(c:WorldCommand,point:import('./contracts').Point):Promise<Result<WorldAck>>{
 if(c.action.kind!=='place-create')return {ok:false,error:'Ortsanlage benötigt einen neuen Ort.'};
 const result=await writeAtlas({commandId:c.commandId,token:c.token,campaignId:c.campaignId,action:{kind:'location-create',mapId:c.action.mapId,expectedMapRevision:c.action.expectedMapRevision,document:c.action.document,point}});
 if(!result.ok){if(pendingAtlasWrite(c.token))throw new Error(result.error);return result;}
 const world=await window.campaign.world(c.token);if(!world.ok)throw new Error(world.error);
 return {ok:true,value:{world:world.value,scene:result.value.atlas.scene}};
}
