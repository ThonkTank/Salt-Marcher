package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.features.dungeon.runtime.DungeonEditorMapHitRefs;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewAreaDiffFrame;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewBoundaryDiffFrame;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewFeatureDiffFrame;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewHandleDiffFrame;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewRenderDiffFrame;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.Cell;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.CellKind;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.Edge;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.Label;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.Marker;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.TopologyRef;

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
                roomLabelPlacementContentPartModel);
        addPreviewAreaDiff(
                cells,
                labels,
                safePreviewRenderDiff.removedAreas(),
                selection,
                roomLabelPlacementContentPartModel);
        addPreviewBoundaryDiff(edges, safePreviewRenderDiff.changedBoundaries(), selection);
        addPreviewBoundaryDiff(edges, safePreviewRenderDiff.removedBoundaries(), selection);
        addPreviewHandleDiff(markers, safePreviewRenderDiff.changedHandles(), interactionFrame, selection);
        addPreviewHandleDiff(markers, safePreviewRenderDiff.removedHandles(), interactionFrame, selection);
        addPreviewFeatureDiff(cells, labels, markers, safePreviewRenderDiff.changedFeatures(), selection);
        addPreviewFeatureDiff(cells, labels, markers, safePreviewRenderDiff.removedFeatures(), selection);
    }

    private void addPreviewAreaDiff(
            List<Cell> cells,
            List<Label> labels,
            List<PreviewAreaDiffFrame> areas,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
    ) {
        for (PreviewAreaDiffFrame area : areas) {
            addPreviewArea(cells, labels, area, selection, roomLabelPlacementContentPartModel);
        }
    }

    private void addPreviewBoundaryDiff(
            List<Edge> edges,
            List<PreviewBoundaryDiffFrame> boundaries,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        for (PreviewBoundaryDiffFrame boundary : boundaries) {
            DungeonEdgeRef edge = boundary.edge();
            edges.add(new Edge(
                    edge.from().q(),
                    edge.from().r(),
                    edge.to().q(),
                    edge.to().r(),
                    edge.from().level(),
                    DungeonMapEditorProjectionContentPartModel.boundaryKind(boundary.kind()),
                    boundary.label(),
                    boundary.id(),
                    topologyRef(boundary.topologyRef()),
                    selectedBoundary(boundary, selection),
                    true));
        }
    }

    private void addPreviewHandleDiff(
            List<Marker> markers,
            List<PreviewHandleDiffFrame> handles,
            DungeonMapContentModel.MapInteractionFrame interactionFrame,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        DungeonMapContentModel.MapInteractionFrame safeFrame = interactionFrame == null
                ? DungeonMapContentModel.MapInteractionFrame.empty()
                : interactionFrame;
        for (PreviewHandleDiffFrame handle : handles) {
            if (!runtimePreparedPreviewHandle(handle, safeFrame)) {
                continue;
            }
            markers.add(previewHandleMarker(handle, selection));
        }
    }

    private static boolean runtimePreparedPreviewHandle(
            PreviewHandleDiffFrame handle,
            DungeonMapContentModel.MapInteractionFrame interactionFrame
    ) {
        return interactionFrame.previewHandleHitRefs()
                .contains(DungeonEditorMapHitRefs.marker(handle.ref(), handle.cell()).value());
    }

    private Marker previewHandleMarker(
            PreviewHandleDiffFrame handle,
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

    private static double previewMarkerQ(PreviewHandleDiffFrame handle) {
        DungeonEdgeRef sourceEdge = handle.ref().sourceEdge();
        return sourceEdge == null
                ? handle.markerQ()
                : midpoint(sourceEdge.from().q(), sourceEdge.to().q());
    }

    private static double previewMarkerR(PreviewHandleDiffFrame handle) {
        DungeonEdgeRef sourceEdge = handle.ref().sourceEdge();
        return sourceEdge == null
                ? handle.markerR()
                : midpoint(sourceEdge.from().r(), sourceEdge.to().r());
    }

    private static double midpoint(int first, int second) {
        return (first + second) / 2.0;
    }

    private void addPreviewFeatureDiff(
            List<Cell> cells,
            List<Label> labels,
            List<Marker> markers,
            List<PreviewFeatureDiffFrame> features,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        for (PreviewFeatureDiffFrame feature : features) {
            addPreviewFeature(cells, labels, markers, feature, selection);
        }
    }

    private void addPreviewArea(
            List<Cell> cells,
            List<Label> labels,
            PreviewAreaDiffFrame area,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
    ) {
        boolean selected = selectedArea(area, selection);
        boolean surfaceSelected = selectedAreaSurface(area, selection);
        List<Cell> previewCells = new ArrayList<>();
        for (DungeonCellRef cell : area.cells()) {
            previewCells.add(new Cell(
                    cell.q(),
                    cell.r(),
                    cell.level(),
                    area.label(),
                    areaKind(area),
                    area.id(),
                    area.clusterId(),
                    topologyRef(area.topologyRef()),
                    surfaceSelected,
                    false,
                    true,
                    area.destructive()));
        }
        cells.addAll(previewCells);
        if (previewCells.isEmpty()) {
            return;
        }
        labels.add(DungeonMapEditorProjectionContentPartModel.roomLabel(
                area.label(),
                area.id(),
                area.clusterId(),
                topologyRef(area.topologyRef()),
                previewCells,
                roomLabelPlacementContentPartModel,
                selected,
                true));
    }

    private void addPreviewFeature(
            List<Cell> cells,
            List<Label> labels,
            List<Marker> markers,
            PreviewFeatureDiffFrame feature,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        boolean selected = selectedFeature(feature, selection);
        List<Cell> featureCells = new ArrayList<>();
        for (DungeonCellRef cell : feature.cells()) {
            featureCells.add(new Cell(
                    cell.q(),
                    cell.r(),
                    cell.level(),
                    feature.label(),
                    DungeonMapEditorProjectionContentPartModel.featureCellKind(feature.kind()),
                    feature.id(),
                    0L,
                    topologyRef(feature.topologyRef()),
                    selected,
                    false,
                    true,
                    feature.destructive()));
        }
        cells.addAll(featureCells);
        if (!hasFeatureMarkerPlacement(feature, featureCells)) {
            return;
        }
        DungeonMapEditorProjectionContentPartModel.CellCenter center = featureMarkerCenter(feature, featureCells);
        addStairPreviewLevelLabels(labels, feature);
        markers.add(featureMarker(
                feature,
                center,
                featureMarkerLevel(feature, featureCells),
                selected,
                true));
    }

    private static void addStairPreviewLevelLabels(
            List<Label> labels,
            PreviewFeatureDiffFrame feature
    ) {
        if (!"STAIR".equalsIgnoreCase(feature.kind())) {
            return;
        }
        for (DungeonCellRef cell : feature.cells()) {
            DungeonMapStairPreviewLevelLabelContentPartModel.addLevelLabel(
                    labels,
                    cell,
                    feature.id(),
                    topologyRef(feature.topologyRef()));
        }
    }

    private static CellKind areaKind(PreviewAreaDiffFrame area) {
        return "CORRIDOR".equalsIgnoreCase(area.kind())
                ? CellKind.CORRIDOR
                : CellKind.ROOM;
    }

    private static boolean selectedArea(
            PreviewAreaDiffFrame area,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        if (selection == null) {
            return false;
        }
        if (selection.clusterSelection()) {
            return areaKind(area) == CellKind.ROOM && area.clusterId() == selection.clusterId();
        }
        return topologyRef(area.topologyRef()).equals(topologyRef(selection.topologyRef()));
    }

    private static boolean selectedAreaSurface(
            PreviewAreaDiffFrame area,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return selection != null
                && !selection.clusterSelection()
                && topologyRef(area.topologyRef()).equals(topologyRef(selection.topologyRef()));
    }

    private static boolean selectedBoundary(
            PreviewBoundaryDiffFrame boundary,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return selection != null
                && topologyRef(boundary.topologyRef()).equals(topologyRef(selection.topologyRef()));
    }

    private static boolean selectedFeature(
            PreviewFeatureDiffFrame feature,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return selection != null
                && topologyRef(feature.topologyRef()).equals(topologyRef(selection.topologyRef()));
    }

    private static boolean hasFeatureMarkerPlacement(
            PreviewFeatureDiffFrame feature,
            List<Cell> featureCells
    ) {
        return featureCells != null && !featureCells.isEmpty()
                || !DungeonMapEditorProjectionContentPartModel.invalidEdge(feature == null ? null : feature.anchorEdge());
    }

    private static DungeonMapEditorProjectionContentPartModel.CellCenter featureMarkerCenter(
            PreviewFeatureDiffFrame feature,
            List<Cell> featureCells
    ) {
        DungeonEdgeRef anchorEdge = feature == null ? null : feature.anchorEdge();
        if (!DungeonMapEditorProjectionContentPartModel.invalidEdge(anchorEdge)) {
            return new DungeonMapEditorProjectionContentPartModel.CellCenter(
                    (anchorEdge.from().q() + anchorEdge.to().q()) / 2.0,
                    (anchorEdge.from().r() + anchorEdge.to().r()) / 2.0);
        }
        return DungeonMapEditorProjectionContentPartModel.centerOfCells(featureCells);
    }

    private static int featureMarkerLevel(
            PreviewFeatureDiffFrame feature,
            List<Cell> featureCells
    ) {
        if (featureCells != null && !featureCells.isEmpty()) {
            return featureCells.getFirst().z();
        }
        DungeonEdgeRef anchorEdge = feature == null ? null : feature.anchorEdge();
        return DungeonMapEditorProjectionContentPartModel.invalidEdge(anchorEdge) ? 0 : anchorEdge.from().level();
    }

    private static Marker featureMarker(
            PreviewFeatureDiffFrame feature,
            DungeonMapEditorProjectionContentPartModel.CellCenter center,
            int level,
            boolean selected,
            boolean preview
    ) {
        DungeonEdgeRef anchorEdge = feature.anchorEdge();
        double markerQ = center.q();
        double markerR = center.r();
        if (!DungeonMapEditorProjectionContentPartModel.invalidEdge(anchorEdge)) {
            markerQ = (anchorEdge.from().q() + anchorEdge.to().q()) / 2.0;
            markerR = (anchorEdge.from().r() + anchorEdge.to().r()) / 2.0;
        }
        int handleQ = (int) Math.floor(center.q());
        int handleR = (int) Math.floor(center.r());
        return new Marker(
                DungeonMapEditorProjectionContentPartModel.featureMarkerLabel(feature.kind()),
                markerQ,
                markerR,
                level,
                DungeonMapEditorProjectionContentPartModel.featureMarkerKind(feature.kind()),
                selected,
                featureMarkerHandle(feature, handleQ, handleR, level),
                preview,
                DungeonMapEditorProjectionContentPartModel.invalidEdge(anchorEdge) ? null : anchorEdge,
                feature.label());
    }

    private static DungeonMapContentModel.DungeonMapRenderState.MarkerHandle featureMarkerHandle(
            PreviewFeatureDiffFrame feature,
            int q,
            int r,
            int level
    ) {
        if (DungeonFeatureKind.STAIR.name().equalsIgnoreCase(feature.kind())) {
            return DungeonMapEditorProjectionContentPartModel.markerHandle(q, r, level);
        }
        TopologyRef topologyRef = topologyRef(feature.topologyRef());
        if (topologyRef.equals(TopologyRef.empty())) {
            return DungeonMapEditorProjectionContentPartModel.markerHandle(q, r, level);
        }
        return DungeonMapEditorProjectionContentPartModel.markerHandle(topologyRef, q, r, level);
    }

    private static TopologyRef topologyRef(src.domain.dungeon.published.DungeonEditorTopologyElementRef ref) {
        return DungeonMapEditorProjectionContentPartModel.topologyRef(ref);
    }

}
