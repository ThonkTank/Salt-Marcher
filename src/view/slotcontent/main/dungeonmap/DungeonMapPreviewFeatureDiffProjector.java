package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedLabelKind;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewFeatureDiffFrame;

final class DungeonMapPreviewFeatureDiffProjector {

    void addPreviewFeatureDiff(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Label> labels,
            List<DungeonMapRenderState.Marker> markers,
            List<PreviewFeatureDiffFrame> features,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        for (PreviewFeatureDiffFrame feature : features) {
            addPreviewFeature(cells, labels, markers, feature, selection);
        }
    }

    private void addPreviewFeature(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Label> labels,
            List<DungeonMapRenderState.Marker> markers,
            PreviewFeatureDiffFrame feature,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        boolean selected = selectedFeature(feature, selection);
        List<DungeonMapRenderState.Cell> featureCells = new ArrayList<>();
        for (DungeonCellRef cell : feature.cells()) {
            featureCells.add(new DungeonMapRenderState.Cell(
                    cell.q(),
                    cell.r(),
                    cell.level(),
                    feature.label(),
                    DungeonMapRenderCells.featureCellKind(feature.kind()),
                    feature.id(),
                    0L,
                    DungeonMapRenderElementFactory.topologyRef(feature.topologyRef()),
                    selected,
                    false,
                    true,
                    feature.destructive()));
        }
        cells.addAll(featureCells);
        if (!hasFeatureMarkerPlacement(feature, featureCells)) {
            return;
        }
        DungeonMapRenderElementFactory.RenderCellCenter center = featureMarkerCenter(feature, featureCells);
        addStairPreviewLevelLabels(labels, feature);
        markers.add(featureMarker(
                feature,
                center,
                featureMarkerLevel(feature, featureCells),
                selected,
                true));
    }

    private static void addStairPreviewLevelLabels(
            List<DungeonMapRenderState.Label> labels,
            PreviewFeatureDiffFrame feature
    ) {
        if (!"STAIR".equalsIgnoreCase(feature.kind())) {
            return;
        }
        for (DungeonCellRef cell : feature.cells()) {
            addStairPreviewLevelLabel(
                    labels,
                    cell,
                    feature.id(),
                    DungeonMapRenderElementFactory.topologyRef(feature.topologyRef()));
        }
    }

    private static boolean selectedFeature(
            PreviewFeatureDiffFrame feature,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return selection != null
                && DungeonMapRenderElementFactory.topologyRef(feature.topologyRef())
                .equals(DungeonMapRenderElementFactory.topologyRef(selection.topologyRef()));
    }

    private static boolean hasFeatureMarkerPlacement(
            PreviewFeatureDiffFrame feature,
            List<DungeonMapRenderState.Cell> featureCells
    ) {
        return DungeonMapRenderMarkerPlacement.hasFeatureMarkerPlacement(
                feature == null ? null : feature.anchorEdge(),
                featureCells);
    }

    private static DungeonMapRenderElementFactory.RenderCellCenter featureMarkerCenter(
            PreviewFeatureDiffFrame feature,
            List<DungeonMapRenderState.Cell> featureCells
    ) {
        return DungeonMapRenderMarkerPlacement.featureMarkerCenter(
                feature == null ? null : feature.anchorEdge(),
                featureCells);
    }

    private static int featureMarkerLevel(
            PreviewFeatureDiffFrame feature,
            List<DungeonMapRenderState.Cell> featureCells
    ) {
        return DungeonMapRenderMarkerPlacement.featureMarkerLevel(
                feature == null ? null : feature.anchorEdge(),
                featureCells);
    }

    private static DungeonMapRenderState.Marker featureMarker(
            PreviewFeatureDiffFrame feature,
            DungeonMapRenderElementFactory.RenderCellCenter center,
            int level,
            boolean selected,
            boolean preview
    ) {
        DungeonEdgeRef anchorEdge = DungeonMapRenderMarkerPlacement.validAnchorEdge(feature.anchorEdge());
        DungeonMapRenderElementFactory.RenderCellCenter markerPoint =
                DungeonMapRenderMarkerPlacement.featureMarkerPoint(anchorEdge, center);
        int handleQ = (int) Math.floor(center.q());
        int handleR = (int) Math.floor(center.r());
        return new DungeonMapRenderState.Marker(
                DungeonMapRenderMarkerKinds.featureMarkerLabel(feature.kind()),
                markerPoint.q(),
                markerPoint.r(),
                level,
                DungeonMapRenderMarkerKinds.featureMarkerKind(feature.kind()),
                selected,
                featureMarkerHandle(feature, handleQ, handleR, level),
                preview,
                anchorEdge,
                feature.label());
    }

    private static DungeonMapRenderState.MarkerHandle featureMarkerHandle(
            PreviewFeatureDiffFrame feature,
            int q,
            int r,
            int level
    ) {
        if (DungeonFeatureKind.STAIR.name().equalsIgnoreCase(feature.kind())) {
            return DungeonMapRenderMarkerHandles.markerHandle(q, r, level);
        }
        DungeonMapRenderState.TopologyRef topologyRef = DungeonMapRenderElementFactory.topologyRef(feature.topologyRef());
        if (topologyRef.equals(DungeonMapRenderState.TopologyRef.empty())) {
            return DungeonMapRenderMarkerHandles.markerHandle(q, r, level);
        }
        return DungeonMapRenderMarkerHandles.markerHandle(topologyRef, q, r, level);
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
