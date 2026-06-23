package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorPreviewDiff;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;

final class DungeonMapPreviewDiffContentPartModel {
    private static final String FEATURE_LABEL_KIND = "FEATURE_LABEL";

    void addPreviewDiff(
            List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells,
            List<DungeonMapContentModel.DungeonMapRenderState.Edge> edges,
            List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
            List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers,
            DungeonEditorPreviewDiff previewDiff,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
    ) {
        DungeonEditorPreviewDiff safePreviewDiff = previewDiff == null
                ? DungeonEditorPreviewDiff.empty()
                : previewDiff;
        if (safePreviewDiff.isEmpty()) {
            return;
        }
        addPreviewAreaDiff(cells, labels, safePreviewDiff.changedAreas(), selection, roomLabelPlacementContentPartModel, false);
        addPreviewAreaDiff(cells, labels, safePreviewDiff.removedAreas(), selection, roomLabelPlacementContentPartModel, true);
        addPreviewBoundaryDiff(edges, safePreviewDiff.changedBoundaries(), selection);
        addPreviewBoundaryDiff(edges, safePreviewDiff.removedBoundaries(), selection);
        addPreviewHandleDiff(markers, safePreviewDiff.changedHandles(), selection);
        addPreviewHandleDiff(markers, safePreviewDiff.removedHandles(), selection);
        addPreviewFeatureDiff(cells, labels, markers, safePreviewDiff.changedFeatures(), selection, false);
        addPreviewFeatureDiff(cells, labels, markers, safePreviewDiff.removedFeatures(), selection, true);
    }

    private void addPreviewAreaDiff(
            List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells,
            List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
            List<DungeonEditorMapSnapshot.Area> areas,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel,
            boolean destructive
    ) {
        for (DungeonEditorMapSnapshot.Area area : areas) {
            addPreviewArea(cells, labels, area, selection, roomLabelPlacementContentPartModel, destructive);
        }
    }

    private void addPreviewBoundaryDiff(
            List<DungeonMapContentModel.DungeonMapRenderState.Edge> edges,
            List<DungeonEditorMapSnapshot.Boundary> boundaries,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        for (DungeonEditorMapSnapshot.Boundary boundary : boundaries) {
            edges.add(DungeonMapEditorProjectionContentPartModel.edge(
                    boundary,
                    0,
                    0,
                    0,
                    true,
                    DungeonMapEditorProjectionContentPartModel.selectedBoundary(boundary, selection)));
        }
    }

    private void addPreviewHandleDiff(
            List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers,
            List<DungeonEditorHandleSnapshot> handles,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        for (DungeonEditorHandleSnapshot handle : handles) {
            if (!DungeonMapEditorProjectionContentPartModel.visibleCanvasHandle(handle.ref(), selection)) {
                continue;
            }
            markers.add(previewHandleMarker(handle, selection));
        }
    }

    private DungeonMapContentModel.DungeonMapRenderState.Marker previewHandleMarker(
            DungeonEditorHandleSnapshot handle,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return DungeonMapEditorProjectionContentPartModel.handleMarker(
                handle.ref(),
                handle.cell().q(),
                handle.cell().r(),
                handle.cell().level(),
                previewMarkerQ(handle),
                previewMarkerR(handle),
                DungeonMapEditorProjectionContentPartModel.selectedHandle(handle.ref(), selection),
                true);
    }

    private static double previewMarkerQ(DungeonEditorHandleSnapshot handle) {
        DungeonEdgeRef sourceEdge = handle.ref().sourceEdge();
        return sourceEdge == null
                ? handle.markerQ()
                : midpoint(sourceEdge.from().q(), sourceEdge.to().q());
    }

    private static double previewMarkerR(DungeonEditorHandleSnapshot handle) {
        DungeonEdgeRef sourceEdge = handle.ref().sourceEdge();
        return sourceEdge == null
                ? handle.markerR()
                : midpoint(sourceEdge.from().r(), sourceEdge.to().r());
    }

    private static double midpoint(int first, int second) {
        return (first + second) / 2.0;
    }

    private void addPreviewFeatureDiff(
            List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells,
            List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
            List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers,
            List<DungeonEditorMapSnapshot.Feature> features,
            DungeonEditorStateSnapshot.Selection selection,
            boolean destructive
    ) {
        for (DungeonEditorMapSnapshot.Feature feature : features) {
            addPreviewFeature(cells, labels, markers, feature, selection, destructive);
        }
    }

    private void addPreviewArea(
            List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells,
            List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
            DungeonEditorMapSnapshot.Area area,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel,
            boolean destructive
    ) {
        boolean selected = DungeonMapEditorProjectionContentPartModel.selectedArea(area, selection);
        boolean surfaceSelected = DungeonMapEditorProjectionContentPartModel.selectedAreaSurface(area, selection);
        List<DungeonMapContentModel.DungeonMapRenderState.Cell> previewCells = new ArrayList<>();
        for (DungeonCellRef cell : area.cells()) {
            previewCells.add(DungeonMapEditorProjectionContentPartModel.cell(
                    area,
                    cell,
                    surfaceSelected,
                    true,
                    destructive,
                    0,
                    0,
                    0));
        }
        cells.addAll(previewCells);
        if (previewCells.isEmpty()) {
            return;
        }
        labels.add(DungeonMapEditorProjectionContentPartModel.roomLabel(
                area,
                previewCells,
                roomLabelPlacementContentPartModel,
                selected,
                true));
    }

    private void addPreviewFeature(
            List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells,
            List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
            List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers,
            DungeonEditorMapSnapshot.Feature feature,
            DungeonEditorStateSnapshot.Selection selection,
            boolean destructive
    ) {
        boolean selected = DungeonMapEditorProjectionContentPartModel.selectedFeature(feature, selection);
        List<DungeonMapContentModel.DungeonMapRenderState.Cell> featureCells = new ArrayList<>();
        for (DungeonCellRef cell : feature.cells()) {
            featureCells.add(DungeonMapEditorProjectionContentPartModel.featureCell(feature, cell, selected, true, destructive));
        }
        cells.addAll(featureCells);
        if (featureCells.isEmpty()) {
            return;
        }
        DungeonMapEditorProjectionContentPartModel.CellCenter center =
                DungeonMapEditorProjectionContentPartModel.centerOfCells(featureCells);
        addStairPreviewLevelLabels(labels, feature);
        labels.add(new DungeonMapContentModel.DungeonMapRenderState.Label(
                feature.label(),
                center.q(),
                center.r(),
                featureCells.getFirst().z(),
                feature.id(),
                0L,
                DungeonMapEditorProjectionContentPartModel.featureTopologyRef(feature),
                FEATURE_LABEL_KIND,
                selected,
                true,
                0.0,
                0.0));
        markers.add(DungeonMapEditorProjectionContentPartModel.featureMarker(
                feature,
                center,
                featureCells.getFirst().z(),
                selected,
                true));
    }

    private static void addStairPreviewLevelLabels(
            List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
            DungeonEditorMapSnapshot.Feature feature
    ) {
        if (!"STAIR".equalsIgnoreCase(feature.kind())) {
            return;
        }
        for (DungeonCellRef cell : feature.cells()) {
            DungeonMapStairPreviewLevelLabelContentPartModel.addLevelLabel(
                    labels,
                    cell,
                    feature.id(),
                    DungeonMapEditorProjectionContentPartModel.featureTopologyRef(feature));
        }
    }
}
