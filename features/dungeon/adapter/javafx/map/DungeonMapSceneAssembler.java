package features.dungeon.adapter.javafx.map;

import java.util.List;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.BoundaryPrimitive;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.GlyphPrimitive;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.MapCanvasPolygonPrimitive;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.PointerTarget;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.RelationPrimitive;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.RenderScene;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.TextPrimitive;

final class DungeonMapSceneAssembler {
    private final DungeonMapGridSceneAssembler gridSceneAssembler = new DungeonMapGridSceneAssembler();
    private final DungeonMapGraphSceneAssembler graphSceneAssembler = new DungeonMapGraphSceneAssembler();

    RenderSceneProjection toSceneProjection(DungeonMapRenderState displayModel, PointerTarget hoverTarget) {
        if (displayModel == null) {
            return new RenderSceneProjection(
                    RenderScene.empty(DungeonMapContentModel.defaultTitle()),
                    SceneBuckets.empty());
        }
        SceneBuckets base = assemble(displayModel.baseLayerProjection(), PointerTarget.empty());
        SceneBuckets interaction = assemble(displayModel.interactionLayerProjection(), PointerTarget.empty());
        SceneBuckets actor = assemble(displayModel.actorLayerProjection(), PointerTarget.empty());
        SceneBuckets buckets = assemble(displayModel, PointerTarget.empty());
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
                        base.surfaces(),
                        base.boundaries(),
                        base.glyphs(),
                        base.texts(),
                        base.relations(),
                        interaction.surfaces(),
                        interaction.boundaries(),
                        interaction.glyphs(),
                        interaction.texts(),
                        actor.actors(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of()),
                buckets);
    }

    private SceneBuckets assemble(DungeonMapRenderState displayModel, PointerTarget hoverTarget) {
        return displayModel.isGraphView()
                ? graphSceneAssembler.assemble(displayModel, hoverTarget)
                : gridSceneAssembler.assemble(displayModel, hoverTarget);
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
