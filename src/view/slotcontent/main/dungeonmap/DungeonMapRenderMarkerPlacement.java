package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;

final class DungeonMapRenderMarkerPlacement {

    private DungeonMapRenderMarkerPlacement() {
    }

    static boolean hasFeatureMarkerPlacement(
            DungeonEditorMapSnapshot.Feature feature,
            List<DungeonMapRenderState.Cell> featureCells
    ) {
        return hasFeatureMarkerPlacement(feature == null ? null : feature.anchorEdge(), featureCells);
    }

    static boolean hasFeatureMarkerPlacement(
            DungeonEdgeRef anchorEdge,
            List<DungeonMapRenderState.Cell> featureCells
    ) {
        return featureCells != null && !featureCells.isEmpty()
                || !DungeonMapRenderElementFactory.invalidEdge(anchorEdge);
    }

    static DungeonMapRenderElementFactory.RenderCellCenter featureMarkerCenter(
            DungeonEditorMapSnapshot.Feature feature,
            List<DungeonMapRenderState.Cell> featureCells
    ) {
        return featureMarkerCenter(feature == null ? null : feature.anchorEdge(), featureCells);
    }

    static DungeonMapRenderElementFactory.RenderCellCenter featureMarkerCenter(
            DungeonEdgeRef anchorEdge,
            List<DungeonMapRenderState.Cell> featureCells
    ) {
        if (!DungeonMapRenderElementFactory.invalidEdge(anchorEdge)) {
            return new DungeonMapRenderElementFactory.RenderCellCenter(
                    (anchorEdge.from().q() + anchorEdge.to().q()) / 2.0,
                    (anchorEdge.from().r() + anchorEdge.to().r()) / 2.0);
        }
        return DungeonMapRenderElementFactory.centerOfCells(featureCells);
    }

    static int featureMarkerLevel(
            DungeonEditorMapSnapshot.Feature feature,
            List<DungeonMapRenderState.Cell> featureCells
    ) {
        return featureMarkerLevel(feature == null ? null : feature.anchorEdge(), featureCells);
    }

    static int featureMarkerLevel(
            DungeonEdgeRef anchorEdge,
            List<DungeonMapRenderState.Cell> featureCells
    ) {
        if (featureCells != null && !featureCells.isEmpty()) {
            return featureCells.getFirst().z();
        }
        return DungeonMapRenderElementFactory.invalidEdge(anchorEdge) ? 0 : anchorEdge.from().level();
    }

    static DungeonMapRenderElementFactory.RenderCellCenter featureMarkerPoint(
            DungeonEdgeRef anchorEdge,
            DungeonMapRenderElementFactory.RenderCellCenter fallbackCenter
    ) {
        if (DungeonMapRenderElementFactory.invalidEdge(anchorEdge)) {
            return fallbackCenter;
        }
        return new DungeonMapRenderElementFactory.RenderCellCenter(
                (anchorEdge.from().q() + anchorEdge.to().q()) / 2.0,
                (anchorEdge.from().r() + anchorEdge.to().r()) / 2.0);
    }

    static DungeonEdgeRef validAnchorEdge(DungeonEdgeRef anchorEdge) {
        return DungeonMapRenderElementFactory.invalidEdge(anchorEdge) ? null : anchorEdge;
    }
}
