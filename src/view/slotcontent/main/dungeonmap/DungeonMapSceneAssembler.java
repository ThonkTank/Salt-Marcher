package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.BoundaryPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.GlyphPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapCanvasPolygonPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PointerTarget;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.RelationPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.RenderScene;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.TextPrimitive;

final class DungeonMapSceneAssembler {
    private final DungeonMapGridSceneAssembler gridSceneAssembler = new DungeonMapGridSceneAssembler();
    private final DungeonMapGraphSceneAssembler graphSceneAssembler = new DungeonMapGraphSceneAssembler();

    RenderSceneProjection toSceneProjection(DungeonMapRenderState displayModel, PointerTarget hoverTarget) {
        if (displayModel == null) {
            return new RenderSceneProjection(
                    RenderScene.empty(DungeonMapContentModel.defaultTitle()),
                    SceneBuckets.empty());
        }
        SceneBuckets buckets = displayModel.isGraphView()
                ? graphSceneAssembler.assemble(displayModel, hoverTarget)
                : gridSceneAssembler.assemble(displayModel, hoverTarget);
        return new RenderSceneProjection(
                new RenderScene(
                        displayModel.title(),
                        displayModel.subtitle(),
                        displayModel.modeLabel(),
                        displayModel.statusLabel(),
                        displayModel.summaryLabel(),
                        displayModel.mapLoaded(),
                        displayModel.overlayMessage(),
                        !displayModel.isGraphView(),
                        buckets.surfaces(),
                        buckets.boundaries(),
                        buckets.glyphs(),
                        buckets.texts(),
                        buckets.relations(),
                        buckets.actors(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of()),
                buckets);
    }

    SceneBuckets toHoverOverlay(DungeonMapRenderState displayModel, PointerTarget hoverTarget) {
        if (displayModel == null) {
            return SceneBuckets.empty();
        }
        return displayModel.isGraphView()
                ? graphSceneAssembler.hoverOverlay(displayModel, hoverTarget)
                : gridSceneAssembler.hoverOverlay(displayModel, hoverTarget);
    }

    record RenderSceneProjection(
            RenderScene renderScene,
            SceneBuckets buckets
    ) {
    }

    record SceneBuckets(
            List<MapCanvasPolygonPrimitive> surfaces,
            List<BoundaryPrimitive> boundaries,
            List<GlyphPrimitive> glyphs,
            List<TextPrimitive> texts,
            List<RelationPrimitive> relations,
            List<MapCanvasPolygonPrimitive> actors
    ) {
        static SceneBuckets empty() {
            return new SceneBuckets(
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of());
        }
    }
}
