import type { SceneryBrush } from "./generated/SceneryBrush";
import type { Brush } from "./generated/Brush";
import type { RoadRoughness } from "./generated/RoadRoughness";
import { useState } from "react";
import type { Tool } from "./editorSelection";
import type { SelectionEvent } from "./editorSelection";
import type { EditorWorkflowController } from "./editorWorkflowController";
import { workflowDraft } from "./editorWorkflow";
import {
  defaultPopulation,
  type Intent,
  type MapObject,
  type PopulationSettings,
} from "./model";
import { extensionRoadDraft, type EditorDraft } from "./roadDraft";

type ToolSettings = {
  scenery: Omit<SceneryBrush, "points" | "seed">;
  brush: Omit<Brush, "points">;
  contours: boolean;
  roughness: RoadRoughness;
  material: string;
  roadWidth: number;
  opening: "door" | "passage";
  travel: "up" | "down";
  settings: PopulationSettings;
  populateRoad: boolean;
};
type Options = {
  controller: Pick<
    EditorWorkflowController,
    "getSnapshot" | "beginDraft" | "beginIntent" | "cancel"
  >;
  select: (event: SelectionEvent) => void;
  cancelInteraction: () => void;
  selectedObject: MapObject | undefined;
  editable: boolean;
  pending: number;
  draft: EditorDraft | null;
};

// Direct UI callbacks: workflow candidates and selection retain their existing owners.
export function useEditorTools(options: Options) {
  const [values, setValues] = useState<ToolSettings>({
    brush: { mode: "raise", radius: 25, amount: 1, strength: 0.25, target: 10 },
    scenery: { biome: "forest", radius: 30, density: 0.65, size: 8 },
    contours: true,
    roughness: { amount: 0.33, seed: 1 },
    material: "earth",
    roadWidth: 15,
    opening: "door",
    travel: "up",
    settings: defaultPopulation,
    populateRoad: true,
  });
  const update = (patch: Partial<ToolSettings>) =>
    setValues((previous) => ({ ...previous, ...patch }));
  const { controller, select, cancelInteraction, draft } = options;
  const setDraft = (next: EditorDraft | null) => {
    if (next) controller.beginDraft(next);
    else controller.cancel();
  };
  const drawing =
    draft?.kind === "newRoad" || draft?.kind === "extendRoad" ? draft : null;
  const state = controller.getSnapshot();
  const population =
    state.kind === "populate" && state.candidate?.intent.type === "populate"
      ? state.candidate.intent.settings
      : null;
  const roughening =
    "candidate" in state && state.candidate?.intent.type === "roughenRoad"
      ? state.candidate.intent
      : null;
  const roughness =
    roughening?.roughness ?? drawing?.roughness ?? values.roughness;
  const changeRoughnessValue = (value: RoadRoughness) => {
    if (roughening) {
      void controller.beginIntent({ ...roughening, roughness: value }, false);
      return;
    }
    update({ roughness: value });
    const current = workflowDraft(controller.getSnapshot());
    if (current?.kind === "newRoad" || current?.kind === "extendRoad")
      setDraft({ ...current, roughness: value });
  };
  const settings = drawing?.population ?? population ?? values.settings;
  return {
    ...values,
    changeScenery: (scenery: ToolSettings["scenery"]) => update({ scenery }),
    changeBrush: (brush: Omit<Brush, "points">) => update({ brush }),
    changeContours: (contours: boolean) => update({ contours }),
    roughness,
    roughening: roughening?.roughness ?? null,
    changeRoughness: (amount: number) =>
      changeRoughnessValue({ ...roughness, amount }),
    newVariation: () =>
      changeRoughnessValue({ ...roughness, seed: (roughness.seed + 1) >>> 0 }),
    beginRoughening() {
      const road = options.selectedObject;
      if (road?.kind !== "road" || !options.editable || options.pending) return;
      cancelInteraction();
      void controller.beginIntent(
        {
          type: "roughenRoad",
          roadId: road.id,
          roughness: { amount: 0, seed: values.roughness.seed },
        },
        false,
      );
    },
    roadWidth: drawing?.width ?? values.roadWidth,
    material:
      drawing?.material ??
      (draft?.kind === "newArea" ? draft.material : values.material),
    populateRoad: drawing ? drawing.population !== null : values.populateRoad,
    settings,
    setDraft,
    chooseTool(tool: Tool) {
      select({ type: "chooseTool", tool });
      if (tool === "road" && !["earth", "stone"].includes(values.material))
        update({ material: "earth" });
    },
    changeRoadWidth(roadWidth: number) {
      update({ roadWidth });
      const current = workflowDraft(controller.getSnapshot());
      if (current?.kind === "newRoad")
        setDraft({ ...current, width: roadWidth });
    },
    changeMaterial(material: string) {
      update({ material });
      const current = workflowDraft(controller.getSnapshot());
      if (current?.kind === "newRoad")
        setDraft({
          ...current,
          material: material === "stone" ? "stone" : "earth",
        });
      else if (current?.kind === "newArea") setDraft({ ...current, material });
    },
    changeOpening(opening: ToolSettings["opening"]) {
      update({ opening });
    },
    changeTravel(travel: ToolSettings["travel"]) {
      cancelInteraction();
      update({ travel });
    },
    changePopulationEnabled(populateRoad: boolean) {
      update({ populateRoad });
      const current = workflowDraft(controller.getSnapshot());
      if (current?.kind === "newRoad" || current?.kind === "extendRoad")
        setDraft({ ...current, population: populateRoad ? settings : null });
    },
    changePopulationSettings(settings: PopulationSettings) {
      update({ settings: { ...settings, layout: undefined } });
      const state = controller.getSnapshot();
      const currentDraft = workflowDraft(state);
      if (
        (currentDraft?.kind === "newRoad" ||
          currentDraft?.kind === "extendRoad") &&
        currentDraft.population
      )
        setDraft({ ...currentDraft, population: settings });
      else if (
        state.kind === "populate" &&
        state.candidate?.intent.type === "populate"
      )
        void controller.beginIntent(
          { ...state.candidate.intent, settings },
          false,
        );
    },
    beginExtension(end: "start" | "end") {
      const road = options.selectedObject;
      if (road?.kind !== "road" || !options.editable || options.pending) return;
      cancelInteraction();
      const recipe = {
        ...(road.populationRecipe?.settings ?? values.settings),
        layout: undefined,
      };
      const populated = values.populateRoad;
      update({ settings: recipe, populateRoad: populated });
      select({ type: "beginExtension" });
      setDraft({
        ...extensionRoadDraft(road, end, populated ? recipe : null),
        roughness: values.roughness,
      });
    },
    beginPopulation() {
      const road = options.selectedObject;
      if (road?.kind !== "road") return;
      const recipe = {
        ...(road.populationRecipe?.settings ?? values.settings),
        layout: undefined,
      };
      update({ settings: recipe });
      void controller.beginIntent(
        { type: "populate", roadId: road.id, settings: recipe },
        false,
      );
      select({ type: "beginPopulation" });
    },
  };
}

type SelectionDelete =
  | { kind: "objectConfirmation" }
  | { kind: "intent"; intent: Intent; clear?: "clearNode" | "clearConnection" };

// Intent choice only. The caller owns edit guards, workflow submission and cleanup.
export function planSelectionDelete({
  selectedObject,
  nodeSelection,
  connection,
  active,
}: {
  selectedObject: MapObject | undefined;
  nodeSelection: string | number | null;
  connection: string;
  active: string;
}): SelectionDelete {
  if (nodeSelection !== null && selectedObject?.kind === "road")
    return {
      kind: "intent",
      intent: {
        type: "deleteRoadNode",
        roadId: selectedObject.id,
        nodeId: String(nodeSelection),
      },
    };
  if (typeof nodeSelection === "number" && selectedObject?.kind === "area")
    return {
      kind: "intent",
      clear: "clearNode",
      intent: {
        type: "updateArea",
        areaId: selectedObject.id,
        area: {
          material: selectedObject.material,
          points: selectedObject.points.filter((_, i) => i !== nodeSelection),
        },
      },
    };
  if (connection && active)
    return {
      kind: "intent",
      clear: "clearConnection",
      intent: {
        type: "connection",
        buildingId: active,
        intent: { action: "delete", connectionId: connection },
      },
    };
  return { kind: "objectConfirmation" };
}

export type EditorTools = ReturnType<typeof useEditorTools>;
