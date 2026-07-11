package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;

final class DungeonMapEditorFeatureProjector {

    private DungeonMapEditorFeatureProjector() {
    }

    static void addFeatures(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Marker> markers,
            DungeonEditorMapSnapshot map,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        for (DungeonEditorMapSnapshot.Feature feature : map.features()) {
            addFeature(cells, markers, feature, DungeonMapRenderSelection.selectedFeature(feature, selection));
        }
    }

    private static void addFeature(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Marker> markers,
            DungeonEditorMapSnapshot.Feature feature,
            boolean selected
    ) {
        List<DungeonMapRenderState.Cell> featureCells = new ArrayList<>();
        for (DungeonCellRef cell : feature.cells()) {
            featureCells.add(DungeonMapRenderCells.featureCell(feature, cell, selected));
        }
        cells.addAll(featureCells);
        if (!DungeonMapRenderMarkerPlacement.hasFeatureMarkerPlacement(feature, featureCells)) {
            return;
        }
        DungeonMapRenderElementFactory.RenderCellCenter center =
                DungeonMapRenderMarkerPlacement.featureMarkerCenter(feature, featureCells);
        markers.add(DungeonMapRenderMarkers.featureMarker(
                feature,
                center,
                DungeonMapRenderMarkerPlacement.featureMarkerLevel(feature, featureCells),
                selected));
    }
}
