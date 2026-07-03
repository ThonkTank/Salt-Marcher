package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewRenderDiffFrame;

final class DungeonMapPreviewDiffContentPartModel {
    void addPreviewRenderDiff(
            List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells,
            List<DungeonMapContentModel.DungeonMapRenderState.Edge> edges,
            List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
            List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers,
            PreviewRenderDiffFrame previewRenderDiff,
            DungeonMapContentModel.MapInteractionFrame interactionFrame,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
    ) {
        PreviewRenderDiffFrame safePreviewRenderDiff = previewRenderDiff == null
                ? PreviewRenderDiffFrame.empty()
                : previewRenderDiff;
        if (safePreviewRenderDiff.isEmpty()) {
            return;
        }
        addPreviewAreaDiff(
                cells,
                labels,
                safePreviewRenderDiff.changedAreas(),
                selection,
                roomLabelPlacementContentPartModel,
                false);
        addPreviewAreaDiff(
                cells,
                labels,
                safePreviewRenderDiff.removedAreas(),
                selection,
                roomLabelPlacementContentPartModel,
                true);
        addPreviewBoundaryDiff(edges, safePreviewRenderDiff.changedBoundaries(), selection);
        addPreviewBoundaryDiff(edges, safePreviewRenderDiff.removedBoundaries(), selection);
        addPreviewHandleDiff(markers, safePreviewRenderDiff.changedHandles(), interactionFrame, selection);
        addPreviewHandleDiff(markers, safePreviewRenderDiff.removedHandles(), interactionFrame, selection);
        addPreviewFeatureDiff(cells, labels, markers, safePreviewRenderDiff.changedFeatures(), selection, false);
        addPreviewFeatureDiff(cells, labels, markers, safePreviewRenderDiff.removedFeatures(), selection, true);
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
            DungeonMapContentModel.MapInteractionFrame interactionFrame,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        DungeonMapContentModel.MapInteractionFrame safeFrame = interactionFrame == null
                ? DungeonMapContentModel.MapInteractionFrame.empty()
                : interactionFrame;
        for (DungeonEditorHandleSnapshot handle : handles) {
            if (!runtimePreparedPreviewHandle(handle, safeFrame)) {
                continue;
            }
            markers.add(previewHandleMarker(handle, selection));
        }
    }

    private static boolean runtimePreparedPreviewHandle(
            DungeonEditorHandleSnapshot handle,
            DungeonMapContentModel.MapInteractionFrame interactionFrame
    ) {
        return interactionFrame.previewHandleHitRefs()
                .contains(src.domain.dungeon.published.DungeonEditorMapHitRef.marker(handle.ref(), handle.cell()).value());
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
        if (!DungeonMapEditorProjectionContentPartModel.hasFeatureMarkerPlacement(feature, featureCells)) {
            return;
        }
        DungeonMapEditorProjectionContentPartModel.CellCenter center =
                DungeonMapEditorProjectionContentPartModel.featureMarkerCenter(feature, featureCells);
        addStairPreviewLevelLabels(labels, feature);
        markers.add(DungeonMapEditorProjectionContentPartModel.featureMarker(
                feature,
                center,
                DungeonMapEditorProjectionContentPartModel.featureMarkerLevel(feature, featureCells),
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
