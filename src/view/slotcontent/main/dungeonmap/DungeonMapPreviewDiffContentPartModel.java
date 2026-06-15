package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorPreviewDiff;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;

final class DungeonMapPreviewDiffContentPartModel {
    private static final String ROOM_LABEL_KIND = "ROOM_LABEL";
    private static final String FEATURE_LABEL_KIND = "FEATURE_LABEL";

    void addPreviewDiff(
            List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells,
            List<DungeonMapContentModel.DungeonMapRenderState.Edge> edges,
            List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
            List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers,
            DungeonEditorPreviewDiff previewDiff,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        DungeonEditorPreviewDiff safePreviewDiff = previewDiff == null
                ? DungeonEditorPreviewDiff.empty()
                : previewDiff;
        if (safePreviewDiff.isEmpty()) {
            return;
        }
        addPreviewAreaDiff(cells, labels, safePreviewDiff.changedAreas(), selection, false);
        addPreviewAreaDiff(cells, labels, safePreviewDiff.removedAreas(), selection, true);
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
            boolean destructive
    ) {
        for (DungeonEditorMapSnapshot.Area area : areas) {
            addPreviewArea(cells, labels, area, selection, destructive);
        }
    }

    private void addPreviewBoundaryDiff(
            List<DungeonMapContentModel.DungeonMapRenderState.Edge> edges,
            List<DungeonEditorMapSnapshot.Boundary> boundaries,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        for (DungeonEditorMapSnapshot.Boundary boundary : boundaries) {
            edges.add(DungeonMapContentModel.EditorRenderElements.edge(
                    boundary,
                    0,
                    0,
                    0,
                    true,
                    DungeonMapContentModel.EditorSelectionFacts.selectedBoundary(boundary, selection)));
        }
    }

    private void addPreviewHandleDiff(
            List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers,
            List<DungeonEditorHandleSnapshot> handles,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        for (DungeonEditorHandleSnapshot handle : handles) {
            if (!DungeonMapContentModel.EditorHandleVisibility.visibleCanvasHandle(handle.ref(), selection)) {
                continue;
            }
            markers.add(DungeonMapContentModel.EditorRenderElements.handleMarker(handle, selection, true));
        }
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
            boolean destructive
    ) {
        boolean selected = DungeonMapContentModel.EditorSelectionFacts.selectedArea(area, selection);
        List<DungeonMapContentModel.DungeonMapRenderState.Cell> previewCells = new ArrayList<>();
        for (DungeonCellRef cell : area.cells()) {
            previewCells.add(DungeonMapContentModel.EditorRenderElements.cell(area, cell, selected, true, destructive, 0, 0, 0));
        }
        cells.addAll(previewCells);
        if (previewCells.isEmpty()) {
            return;
        }
        DungeonMapContentModel.EditorProjectionFacts.CellCenter center =
                DungeonMapContentModel.EditorProjectionFacts.centerOfCells(previewCells);
        labels.add(new DungeonMapContentModel.DungeonMapRenderState.Label(
                area.label(),
                center.q(),
                center.r(),
                previewCells.getFirst().z(),
                area.id(),
                DungeonMapContentModel.EditorProjectionFacts.clusterId(area),
                DungeonMapContentModel.EditorProjectionFacts.areaTopologyRef(area),
                ROOM_LABEL_KIND,
                selected,
                true,
                DungeonMapContentModel.EditorProjectionFacts.roomLabelRotationDegrees(previewCells)));
    }

    private void addPreviewFeature(
            List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells,
            List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
            List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers,
            DungeonEditorMapSnapshot.Feature feature,
            DungeonEditorStateSnapshot.Selection selection,
            boolean destructive
    ) {
        boolean selected = DungeonMapContentModel.EditorSelectionFacts.selectedFeature(feature, selection);
        List<DungeonMapContentModel.DungeonMapRenderState.Cell> featureCells = new ArrayList<>();
        for (DungeonCellRef cell : feature.cells()) {
            featureCells.add(DungeonMapContentModel.EditorRenderElements.featureCell(feature, cell, selected, true, destructive));
        }
        cells.addAll(featureCells);
        if (featureCells.isEmpty()) {
            return;
        }
        DungeonMapContentModel.EditorProjectionFacts.CellCenter center =
                DungeonMapContentModel.EditorProjectionFacts.centerOfCells(featureCells);
        labels.add(new DungeonMapContentModel.DungeonMapRenderState.Label(
                feature.label(),
                center.q(),
                center.r(),
                featureCells.getFirst().z(),
                feature.id(),
                0L,
                DungeonMapContentModel.EditorProjectionFacts.featureTopologyRef(feature),
                FEATURE_LABEL_KIND,
                selected,
                true,
                0.0));
        markers.add(DungeonMapContentModel.EditorRenderElements.featureMarker(
                feature,
                center,
                featureCells.getFirst().z(),
                selected,
                true));
    }
}
