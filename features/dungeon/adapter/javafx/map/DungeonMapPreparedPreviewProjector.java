package features.dungeon.adapter.javafx.map;

import java.util.List;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.adapter.javafx.map.DungeonMapRenderState.CellKind;
import features.dungeon.adapter.javafx.map.DungeonMapRenderState.EdgeKind;
import features.dungeon.adapter.javafx.map.DungeonMapRenderState.MarkerKind;

final class DungeonMapPreparedPreviewProjector {

    private DungeonMapPreparedPreviewProjector() {
    }

    static void addPreparedPreview(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Edge> edges,
            List<DungeonMapRenderState.Label> labels,
            List<DungeonMapRenderState.Marker> markers,
            PreviewRenderFrame previewRender
    ) {
        PreviewRenderFrame safePreviewRender = previewRender == null ? PreviewRenderFrame.empty() : previewRender;
        for (PreviewBoundaryEdgeFrame boundaryEdge : safePreviewRender.boundaryEdges()) {
            addBoundaryEdgesPreview(edges, boundaryEdge);
        }
        for (PreviewStairCellFrame stairCell : safePreviewRender.stairCells()) {
            addStairDraftCell(cells, labels, stairCell);
        }
        addStairMarker(markers, safePreviewRender.stairMarker());
    }

    private static void addBoundaryEdgesPreview(
            List<DungeonMapRenderState.Edge> edges,
            PreviewBoundaryEdgeFrame boundaryEdge
    ) {
        if (boundaryEdge == null) {
            return;
        }
        edges.add(new DungeonMapRenderState.Edge(
                boundaryEdge.fromQ(),
                boundaryEdge.fromR(),
                boundaryEdge.toQ(),
                boundaryEdge.toR(),
                boundaryEdge.level(),
                boundaryKind(boundaryEdge.boundaryKind()),
                boundaryEdge.label(),
                boundaryEdge.clusterId(),
                DungeonMapRenderState.TopologyRef.empty(),
                false,
                true));
    }

    private static void addStairDraftCell(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Label> labels,
            PreviewStairCellFrame stairCell
    ) {
        if (stairCell == null || !stairCell.present()) {
            return;
        }
        cells.add(new DungeonMapRenderState.Cell(
                stairCell.q(),
                stairCell.r(),
                stairCell.level(),
                stairCell.label(),
                CellKind.STAIR,
                0L,
                0L,
                DungeonMapRenderState.TopologyRef.empty(),
                false,
                false,
                true,
                false));
        addStairPreviewLevelLabel(
                labels,
                new DungeonCellRef(stairCell.q(), stairCell.r(), stairCell.level()),
                0L,
                DungeonMapRenderState.TopologyRef.empty());
    }

    private static void addStairMarker(
            List<DungeonMapRenderState.Marker> markers,
            PreviewStairMarkerFrame stairMarker
    ) {
        if (stairMarker == null || !stairMarker.present()) {
            return;
        }
        markers.add(new DungeonMapRenderState.Marker(
                stairMarker.label(),
                stairMarker.q() + 0.5,
                stairMarker.r() + 0.5,
                stairMarker.level(),
                MarkerKind.STAIR,
                false,
                DungeonMapRenderMarkerHandles.markerHandle(
                        stairMarker.q(),
                        stairMarker.r(),
                        stairMarker.level()),
                true));
    }

    private static DungeonMapRenderState.EdgeKind boundaryKind(PreparedBoundaryKind kind) {
        return kind == PreparedBoundaryKind.DOOR
                ? EdgeKind.DOOR
                : EdgeKind.WALL;
    }

    private static void addStairPreviewLevelLabel(
            List<DungeonMapRenderState.Label> labels,
            DungeonCellRef cell,
            long featureId,
            DungeonMapRenderState.TopologyRef topologyRef
    ) {
        labels.add(new DungeonMapRenderState.Label(
                "z=" + cell.level(),
                cell.q() + 0.5,
                cell.r() + 0.5,
                cell.level(),
                featureId,
                0L,
                topologyRef,
                PreparedLabelKind.FEATURE_LABEL,
                false,
                true,
                0.0,
                0.0));
    }
}
