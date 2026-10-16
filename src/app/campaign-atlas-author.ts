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
  if (pending.has(c.token) && !recovery)
    return {
      ok: false,
      error:
        "Ein Atlasauftrag hat noch keinen bestätigten Ausgang. Zuerst im Atlas „Speicherstand klären“ wählen.",
    };
  try {
    const result = await window.campaign.executeAtlas(c);
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
  const result = await wrap(edit, { kind: "room-edit", edit });
  if (!result.ok) return result;
  const w = result.value.atlas.workspace,
    r = w.rooms.find((r) => r.id === edit.roomId);
  return r
    ? {
        ok: true,
        value: {
          room: r,
          token: w.token,
          canUndo: result.value.atlas.canUndo,
          canRedo: result.value.atlas.canRedo,
        },
      }
    : { ok: false, error: "Raum nach Änderung nicht verfügbar." };
}
/** A read-only World receipt check also resolves its matching atomic Atlas envelope. */
export function acknowledgeAtlasWorldStatus(c: WorldCommand) {
  const saved = pending.get(c.token);
  if (saved?.action.kind !== 'world' || saved.commandId !== c.commandId ||
      JSON.stringify(saved.action.command) !== JSON.stringify(c)) return;
  pending.delete(c.token);
  document.dispatchEvent(new Event('atlas-write-state'));
}
export async function atlasWorldWrite(
  c: WorldCommand,
): Promise<Result<WorldAck>> {
  if (!["map", "cell", "place", "place-presentation"].includes(c.action.kind))
    return window.campaign.executeWorld(c);
  const result = await wrap(c, { kind: "world", command: c });
  if (!result.ok) {
    const saved = pending.get(c.token);
    if (saved?.commandId === c.commandId && saved.action.kind === 'world') throw new Error(result.error);
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
