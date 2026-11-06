import type { TerrainFollow } from "./generated/TerrainFollow";
import type { GroundBrush } from "./generated/GroundBrush";
import type { SceneryBrush } from "./generated/SceneryBrush";
import type { Brush } from "./generated/Brush";
import type { RoadRoughness } from "./generated/RoadRoughness";
import { useEffect, useState } from "react";
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

export type ToolSettings = {
  ground: Omit<GroundBrush, "points" | "seed">;
  groundPicker: boolean;
  scenery: Omit<SceneryBrush, "points" | "seed">;
  brush: Omit<Brush, "points">;
  contours: boolean;
  roughness: RoadRoughness;
  terrainFollow: TerrainFollow | undefined;
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
  viewScale: number;
};

export const resizeBrushDiameter = (diameter: number, factor: number) =>
  Math.max(8, Math.min(512, Math.round(diameter * factor)));

// Direct UI callbacks: workflow candidates and selection retain their existing owners.
export function useEditorTools(options: Options) {
  const [values, setValues] = useState<ToolSettings>({
    ground: {
      mode: "paint",
      tip: "soft",
      color: [157, 181, 139],
      diameter: 80,
      opacity: 1,
      flow: 1,
    },
    groundPicker: false,
    brush: { mode: "land", radius: 40, amount: 1, strength: 0.25, target: 10 },
    scenery: { biome: "forest", radius: 40, density: 0.65, size: 8 },
    contours: true,
    roughness: { amount: 0.33, seed: 1 },
    terrainFollow: { tolerance: 0.1 },
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
  const roughness = {
    ...(roughening?.roughness ?? drawing?.roughness ?? values.roughness),
    viewScale: options.viewScale,
  };
  useEffect(() => {
    const state = controller.getSnapshot();
    if ("stage" in state && state.stage.phase === "committing") return;
    const current = workflowDraft(state);
    if (
      (current?.kind === "newRoad" || current?.kind === "extendRoad") &&
      current.roughness &&
      current.roughness.viewScale !== options.viewScale
    ) {
      controller.beginDraft({
        ...current,
        roughness: { ...current.roughness, viewScale: options.viewScale },
      });
    } else if (
      "candidate" in state &&
      state.candidate?.intent.type === "roughenRoad" &&
      state.candidate.intent.roughness.viewScale !== options.viewScale
    ) {
      void controller.beginIntent(
        {
          ...state.candidate.intent,
          roughness: {
            ...state.candidate.intent.roughness,
            viewScale: options.viewScale,
          },
        },
        false,
      );
    }
  }, [controller, options.viewScale]);
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
  const input = {
    ...values,
    terrainFollow: drawing ? drawing.terrainFollow : values.terrainFollow,
    roughness,
    roadWidth: drawing?.width ?? values.roadWidth,
    material:
      drawing?.material ??
      (draft?.kind === "newArea" ? draft.material : values.material),
    populateRoad: drawing ? drawing.population !== null : values.populateRoad,
    settings,
  };
  return {
    ...input,
    input,
    changeTerrainFollow: (terrainFollow: TerrainFollow | undefined) => {
      update({ terrainFollow });
      const current = workflowDraft(controller.getSnapshot());
      if (current?.kind === "newRoad" || current?.kind === "extendRoad")
        setDraft({ ...current, terrainFollow });
    },
    resizeBrush: (tool: Tool, factor: number) => {
      const resize = (diameter: number) =>
        resizeBrushDiameter(diameter, factor);
      if (tool === "terrain" || tool === "water")
        update({
          brush: { ...input.brush, radius: resize(input.brush.radius * 2) / 2 },
        });
      else if (tool === "scenery")
        update({
          scenery: {
            ...input.scenery,
            radius: resize(input.scenery.radius * 2) / 2,
          },
        });
      else
        update({
          ground: { ...input.ground, diameter: resize(input.ground.diameter) },
        });
    },
    changeGround: (ground: ToolSettings["ground"]) => update({ ground }),
    changeGroundPicker: (groundPicker: boolean) => update({ groundPicker }),
    changeScenery: (scenery: ToolSettings["scenery"]) => update({ scenery }),
    changeBrush: (brush: Omit<Brush, "points">) => update({ brush }),
    changeContours: (contours: boolean) => update({ contours }),
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
          roughness: {
            amount: 0,
            seed: values.roughness.seed,
            viewScale: options.viewScale,
          },
        },
        false,
      );
    },
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
        terrainFollow: values.terrainFollow,
        roughness: { ...values.roughness, viewScale: options.viewScale },
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
