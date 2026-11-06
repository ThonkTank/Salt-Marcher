import type { LodDecision } from "./lod";
import { useEffect, useState } from "react";
import type { EditorWorkflowController } from "./editorWorkflowController";
import { workflowView } from "./editorWorkflow";
import type { AtlasClient } from "./client";
import type { Bounds, Camera, Intent, Status, ValidPreview } from "./model";
import type { RiverAction } from "./generated/RiverAction";
import type { RiverSettings } from "./generated/RiverSettings";
import { usePresentationLayer } from "./usePresentation";
import type { PresentationLoader } from "./presentationLoader";
import { terrainRequest } from "./terrainView";
import { editableRiver } from "./interaction";
type Draft = Extract<RiverAction, { kind: "put" }>;
const defaults: RiverSettings = {
  tolerance: 0.1,
  roughness: 0.5,
  meander: 40,
  sourceFade: true,
  seed: 1,
};
export function useRivers(
  loader: PresentationLoader,
  client: AtlasClient,
  status: Status | null,
  bounds: Bounds,
  camera: Camera,
  lod: LodDecision,
  active: boolean,
  editable: boolean,
  controller: EditorWorkflowController,
) {
  const [selection, setSelection] = useState<{
    id: string;
    node: number | null;
  }>({ id: "", node: null });
  const selected = selection.id;
  const setSelected = (id: string) => setSelection({ id, node: null });
  const setNode = (node: number | null) =>
    setSelection((s) => ({ ...s, node }));
  const [settings, setSettings] = useState(defaults),
    [width, setWidth] = useState(20),
    [mode, setMode] = useState<"draw" | "select">("draw");
  const state = controller.getSnapshot();
  const editing = state.kind === "geometry" && state.operation.kind === "river";
  const action =
    state.kind === "geometry" && state.operation.kind === "river"
      ? state.operation.intent.action
      : null;
  const draft = action?.kind === "put" ? action : null;
  const display = workflowView(state);
  const preview = editing ? display.preview : null;
  const busy = editing && display.actions.committing;
  const cancel = () => {
    const current = controller.getSnapshot();
    if (current.kind === "geometry" && current.operation.kind === "river")
      controller.cancel();
  };
  useEffect(() => {
    cancel();
    setSelected("");
  }, [active, status?.sessionId]);
  const read = usePresentationLayer(
    loader,
    "rivers",
    client,
    status
      ? {
          version: status,
          bounds,
          overviewScale:
            !active && !lod.policy.exact ? camera.scale : undefined,
          ids: selected ? [selected] : [],
        }
      : null,
  );
  const data = read.value,
    fresh = read.fresh;
  useEffect(() => {
    if (fresh && selected && !data?.rivers.some((v) => v.river.id === selected))
      setSelected("");
  }, [fresh, data, selected]);
  const views =
    data?.status.sessionId === status?.sessionId ? (data?.rivers ?? []) : [];
  const river = views.find((v) => v.river.id === selected)?.river;
  const nodes = draft?.nodes ?? river?.nodes ?? [];
  const node = nodes.length
    ? Math.max(0, Math.min(selection.node ?? 0, nodes.length - 1))
    : null;
  // Persist clamping after topology changes, but do not lose selection during reads.
  useEffect(() => {
    if ((fresh || draft) && selection.node !== node) setNode(node);
  }, [fresh, draft, selection.node, node]);
  const editDraft = () => editableRiver(draft, river);
  const view = terrainRequest(bounds, lod.terrainLevel);
  useEffect(() => {
    if (
      active &&
      editable &&
      !busy &&
      draft &&
      state.kind === "geometry" &&
      state.operation.kind === "river" &&
      JSON.stringify(state.operation.intent.view) !== JSON.stringify(view)
    )
      controller.editRiver({ type: "riverEdit", action: draft, view });
  }, [active, editable, busy, draft, JSON.stringify(view)]);
  const change = (next: Draft) => {
    if (editable && !busy)
      controller.editRiver({ type: "riverEdit", action: next, view });
  };
  const accept = () => {
    if (active && editable && draft) return controller.accept();
  };
  const completed = (intent: Intent, result: ValidPreview) => {
    if (intent.type !== "riverEdit") return;
    const action = intent.action;
    const id =
      action.kind === "put"
        ? (action.id ??
          result.rivers?.after.find(
            (v) =>
              !result.rivers?.before.some((b) => b.river.id === v.river.id),
          )?.river.id)
        : "";
    setSelected(id ?? "");
    setMode("select");
  };
  const remove = () => {
    if (!selected || !editable || !status || busy) return;
    void controller.beginIntent({
      type: "riverEdit",
      action: { kind: "delete", id: selected },
      view,
    });
  };
  return {
    input: { river, views, settings, width, mode, fresh },
    editable,
    views,
    selected,
    draft,
    preview,
    error:
      (editing
        ? display.message || (preview?.valid === false ? preview.reason : "")
        : "") || read.error,
    fresh,
    settings: draft?.settings ?? river?.settings ?? settings,
    width,
    node,
    busy,
    mode,
    river,
    handles: active ? (draft?.nodes ?? river?.nodes ?? []) : [],
    maxCut: preview?.valid
      ? (preview.rivers?.after ?? []).reduce(
          (m, v) => v.samples.reduce((m, s) => Math.max(m, s.cut), m),
          0,
        )
      : 0,
    cancel,
    completed,
    accept,
    remove,
    retry: read.retry,
    newRiver: () => {
      cancel();
      setSelected("");
      setMode("draw");
    },
    chooseMode: (m: typeof mode) => {
      cancel();
      setMode(m);
    },
    select: (id: string) => {
      cancel();
      setSelected(id);
      setMode("select");
    },
    setNode,
    setWidth: (w: number) => {
      setWidth(w);
      const next = editDraft();
      if (next && node !== null && next.nodes[node]) {
        next.nodes[node].width = w;
        change({ ...next });
      }
    },
    setName: (name: string) => {
      const next = editDraft();
      if (next) change({ ...next, name });
    },
    changeSettings: (patch: Partial<RiverSettings>) => {
      const next = editDraft();
      if (next) change({ ...next, settings: { ...next.settings, ...patch } });
      else setSettings((s) => ({ ...s, ...patch }));
    },
    reverse: () => {
      const next = editDraft();
      if (next) change({ ...next, reverse: !next.reverse, automatic: false });
    },
    extend: (end: "start" | "end") => {
      const next = editDraft();
      if (next) {
        if (editable && !busy)
          controller.editRiver(
            { type: "riverEdit", action: next, view },
            null,
            end,
          );
      }
    },
    deleteNode: () => {
      const next = editDraft();
      if (next && node !== null && next.nodes.length > 2) {
        next.nodes.splice(node, 1);
        change(next);
        setNode(0);
      }
    },
    insertNode: () => {
      const next = editDraft();
      if (next && node !== null && node < next.nodes.length - 1) {
        const a = next.nodes[node],
          b = next.nodes[node + 1];
        next.nodes.splice(node + 1, 0, {
          id: "",
          point: [(a.point[0] + b.point[0]) / 2, (a.point[1] + b.point[1]) / 2],
          width: (a.width + b.width) / 2,
        });
        change(next);
        setNode(node + 1);
      }
    },
  };
}
export type RiversEditor = ReturnType<typeof useRivers>;
