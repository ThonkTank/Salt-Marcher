package features.dungeon.adapter.javafx.map;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.LabelTypography;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.MapCanvasPoint;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.MapCanvasPolygonPrimitive;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.PaintStyle;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.PointerTarget;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.RelationPrimitive;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.TextPrimitive;
import features.dungeon.adapter.javafx.map.DungeonMapSceneAssembler.SceneBuckets;

final class DungeonMapGraphSceneAssembler {
    private static final String GRAPH_ROOM_SELECTION_PREFIX = "ROOM:";

    SceneBuckets assemble(DungeonMapRenderState displayModel, PointerTarget hoverTarget) {
        List<MapCanvasPolygonPrimitive> surfaces = new ArrayList<>();
        List<TextPrimitive> texts = new ArrayList<>();
        List<RelationPrimitive> relations = new ArrayList<>();
        Map<Long, DungeonMapRenderState.GraphNode> nodesById = indexNodes(displayModel.graphNodes());
        addLinks(displayModel, relations, nodesById);
        addNodes(displayModel, surfaces, texts, hoverTarget);
        return new SceneBuckets(
                surfaces,
                List.of(),
                List.of(),
                texts,
                relations,
                List.of());
    }

    SceneBuckets hoverOverlay(DungeonMapRenderState displayModel, PointerTarget hoverTarget) {
        List<MapCanvasPolygonPrimitive> surfaces = new ArrayList<>();
        List<TextPrimitive> texts = new ArrayList<>();
        addHoveredNode(displayModel, surfaces, texts, hoverTarget);
        return new SceneBuckets(
                surfaces,
                List.of(),
                List.of(),
                texts,
                List.of(),
                List.of());
    }

    private void addHoveredNode(
            DungeonMapRenderState displayModel,
            List<MapCanvasPolygonPrimitive> surfaces,
            List<TextPrimitive> texts,
            PointerTarget hoverTarget
    ) {
        displayModel.graphNodes().stream()
                .filter(node -> DungeonMapSceneIdentity.Hover.hoveredGraphNode(hoverTarget, node))
                .findFirst()
                .ifPresent(node -> addGraphNodePrimitives(displayModel, surfaces, texts, node, true));
    }

    private Map<Long, DungeonMapRenderState.GraphNode> indexNodes(List<DungeonMapRenderState.GraphNode> graphNodes) {
        Map<Long, DungeonMapRenderState.GraphNode> nodesById = new LinkedHashMap<>();
        for (DungeonMapRenderState.GraphNode node : graphNodes) {
            nodesById.put(node.id(), node);
        }
        return nodesById;
    }

    private void addLinks(
            DungeonMapRenderState displayModel,
            List<RelationPrimitive> relations,
            Map<Long, DungeonMapRenderState.GraphNode> nodesById
    ) {
        for (DungeonMapRenderState.GraphLink link : displayModel.graphLinks()) {
            DungeonMapRenderState.GraphNode from = nodesById.get(link.fromId());
            DungeonMapRenderState.GraphNode to = nodesById.get(link.toId());
            if (from == null || to == null) {
                continue;
            }
            relations.add(new RelationPrimitive(
                    "",
                    displayModel.projectionLevel(),
                    List.of(
                            new MapCanvasPoint(from.q(), from.r()),
                            new MapCanvasPoint(to.q(), to.r())),
                    DungeonMapSceneStyles.graphLinkStyle(link)));
        }
    }

    private void addNodes(
            DungeonMapRenderState displayModel,
            List<MapCanvasPolygonPrimitive> surfaces,
            List<TextPrimitive> texts,
            PointerTarget hoverTarget
    ) {
        for (DungeonMapRenderState.GraphNode node : displayModel.graphNodes()) {
            addGraphNodePrimitives(
                    displayModel,
                    surfaces,
                    texts,
                    node,
                    DungeonMapSceneIdentity.Hover.hoveredGraphNode(hoverTarget, node));
        }
    }

    private void addGraphNodePrimitives(
            DungeonMapRenderState displayModel,
            List<MapCanvasPolygonPrimitive> surfaces,
            List<TextPrimitive> texts,
            DungeonMapRenderState.GraphNode node,
            boolean hovered
    ) {
        surfaces.add(new MapCanvasPolygonPrimitive(
                DungeonMapSceneIdentity.graphNodeHitRef(node),
                graphNodeSelectionRef(node),
                displayModel.projectionLevel(),
                DungeonMapSceneGeometry.roundedRect(node.q(), node.r(), 1.8, 1.1),
                DungeonMapSceneStyles.graphNodeStyle(node, hovered)));
        texts.add(new TextPrimitive(
                DungeonMapSceneIdentity.graphNodeHitRef(node),
                graphNodeSelectionRef(node),
                displayModel.projectionLevel(),
                node.label(),
                node.q(),
                node.r(),
                Math.max(1.8, DungeonMapSceneGeometry.Label.labelWidthScene(node.label())),
                DungeonMapSceneGeometry.Label.labelHeightScene(),
                0.0,
                LabelTypography.mapLabel(),
                new PaintStyle(null, null, 0.0, 1.0, false),
                DungeonMapSceneStyles.labelTextColor(null)));
    }

    private static String graphNodeSelectionRef(DungeonMapRenderState.GraphNode node) {
        return GRAPH_ROOM_SELECTION_PREFIX + node.id();
    }
}
