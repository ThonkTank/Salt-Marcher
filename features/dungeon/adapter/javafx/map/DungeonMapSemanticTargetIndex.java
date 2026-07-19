package features.dungeon.adapter.javafx.map;

import features.dungeon.api.DungeonEditorHandleRef;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.BoundaryTarget;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.CellTarget;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.PointerTarget;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.VertexTarget;
import java.util.LinkedHashMap;
import java.util.Map;

final class DungeonMapSemanticTargetIndex {
    private DungeonMapSemanticTargetIndex() {
    }

    static Map<String, PointerTarget> from(DungeonMapRenderState state) {
        if (state == null) {
            return Map.of();
        }
        Map<String, PointerTarget> targets = new LinkedHashMap<>();
        for (DungeonMapRenderState.Cell cell : state.cells()) {
            String hitRef = DungeonMapSceneIdentity.cellHitRef(cell);
            if (!hitRef.isBlank()) {
                targets.put(hitRef, cellTarget(hitRef, cell));
            }
        }
        for (DungeonMapRenderState.Edge edge : state.edges()) {
            String hitRef = DungeonMapSceneIdentity.edgeHitRef(edge);
            if (!hitRef.isBlank()) {
                targets.put(hitRef, edgeTarget(hitRef, edge));
            }
        }
        for (DungeonMapRenderState.Label label : state.labels()) {
            String hitRef = DungeonMapSceneIdentity.labelHitRef(label);
            if (!hitRef.isBlank()) {
                targets.put(hitRef, PointerTarget.label(
                        label.labelKind(), label.ownerId(), label.clusterId(), label.topologyRef()));
            }
        }
        for (DungeonMapRenderState.Marker marker : state.markers()) {
            String hitRef = DungeonMapSceneIdentity.markerHitRef(marker);
            if (!hitRef.isBlank()) {
                targets.put(hitRef, markerTarget(marker));
            }
        }
        for (DungeonMapRenderState.GraphNode node : state.graphNodes()) {
            String hitRef = DungeonMapSceneIdentity.graphNodeHitRef(node);
            if (!hitRef.isBlank()) {
                targets.put(hitRef, new PointerTarget(
                        PreparedTargetKind.GRAPH_NODE,
                        PreparedLabelKind.EMPTY,
                        PreparedElementKind.ROOM,
                        node.id(),
                        node.clusterId(),
                        PreparedTopologyKind.ROOM,
                        node.id(),
                        DungeonEditorHandleRef.empty(),
                        BoundaryTarget.empty(),
                        PreparedSyntheticHoverKind.NONE,
                        CellTarget.empty(),
                        VertexTarget.empty()));
            }
        }
        DungeonMapRenderState.PartyToken partyToken = state.partyToken();
        String partyTokenHitRef = DungeonMapSceneIdentity.partyTokenHitRef(partyToken);
        if (!partyTokenHitRef.isBlank()
                && DungeonMapSceneIdentity.includeLevel(state, partyToken.z())) {
            targets.put(partyTokenHitRef, PointerTarget.partyToken());
        }
        return Map.copyOf(targets);
    }

    private static PointerTarget cellTarget(String hitRef, DungeonMapRenderState.Cell cell) {
        return new PointerTarget(
                PreparedTargetKind.CELL,
                PreparedLabelKind.EMPTY,
                DungeonMapContentModel.preparedCellElementKind(cell.kind()),
                cell.ownerId(),
                cell.clusterId(),
                cell.topologyRef().kind(),
                cell.topologyRef().id(),
                DungeonEditorHandleRef.empty(),
                BoundaryTarget.empty(),
                PreparedSyntheticHoverKind.NONE,
                new CellTarget(hitRef, cell.q(), cell.r(), cell.z()),
                VertexTarget.empty());
    }

    private static PointerTarget edgeTarget(String hitRef, DungeonMapRenderState.Edge edge) {
        PreparedBoundaryKind boundaryKind = edge.kind() == DungeonMapRenderState.EdgeKind.DOOR
                ? PreparedBoundaryKind.DOOR
                : PreparedBoundaryKind.WALL;
        BoundaryTarget boundary = new BoundaryTarget(
                boundaryKind,
                hitRef,
                edge.ownerId(),
                edge.topologyRef().kind(),
                edge.topologyRef().id(),
                edge.startQ(),
                edge.startR(),
                edge.z(),
                edge.endQ(),
                edge.endR(),
                edge.z());
        return new PointerTarget(
                PreparedTargetKind.BOUNDARY,
                PreparedLabelKind.EMPTY,
                boundaryKind == PreparedBoundaryKind.DOOR ? PreparedElementKind.DOOR : PreparedElementKind.WALL,
                edge.ownerId(),
                0L,
                edge.topologyRef().kind(),
                edge.topologyRef().id(),
                DungeonEditorHandleRef.empty(),
                boundary,
                PreparedSyntheticHoverKind.NONE,
                CellTarget.empty(),
                VertexTarget.empty());
    }

    private static PointerTarget markerTarget(DungeonMapRenderState.Marker marker) {
        var handle = marker.handle();
        if (handle.kind() != null) {
            return new PointerTarget(
                    PreparedTargetKind.HANDLE,
                    PreparedLabelKind.EMPTY,
                    elementKind(handle.topologyRef().kind()),
                    handle.topologyRef().id(),
                    handle.ref().clusterId(),
                    handle.topologyRef().kind(),
                    handle.topologyRef().id(),
                    handle.ref(),
                    BoundaryTarget.empty(),
                    PreparedSyntheticHoverKind.NONE,
                    CellTarget.empty(),
                    VertexTarget.empty());
        }
        return new PointerTarget(
                PreparedTargetKind.MARKER,
                PreparedLabelKind.EMPTY,
                elementKind(handle.topologyRef().kind()),
                handle.topologyRef().id(),
                0L,
                handle.topologyRef().kind(),
                handle.topologyRef().id(),
                DungeonEditorHandleRef.empty(),
                BoundaryTarget.empty(),
                PreparedSyntheticHoverKind.NONE,
                CellTarget.empty(),
                VertexTarget.empty());
    }

    private static PreparedElementKind elementKind(PreparedTopologyKind kind) {
        return switch (kind == null ? PreparedTopologyKind.EMPTY : kind) {
            case ROOM -> PreparedElementKind.ROOM;
            case CORRIDOR -> PreparedElementKind.CORRIDOR;
            case CORRIDOR_ANCHOR -> PreparedElementKind.CORRIDOR_ANCHOR;
            case DOOR -> PreparedElementKind.DOOR;
            case WALL -> PreparedElementKind.WALL;
            case STAIR -> PreparedElementKind.STAIR;
            case TRANSITION -> PreparedElementKind.TRANSITION;
            case FEATURE_MARKER -> PreparedElementKind.FEATURE_MARKER;
            default -> PreparedElementKind.EMPTY;
        };
    }
}
