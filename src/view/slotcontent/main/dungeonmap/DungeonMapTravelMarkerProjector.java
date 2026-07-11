package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;

final class DungeonMapTravelMarkerProjector {

    List<DungeonMapRenderState.Marker> travelMarkers(
            List<DungeonFeatureSnapshot> features
    ) {
        List<DungeonMapRenderState.Marker> markers = new ArrayList<>();
        for (DungeonFeatureSnapshot feature : features) {
            if (!travelMarkerPlacementPresent(feature)) {
                continue;
            }
            TravelCellCenter center = travelMarkerCenter(feature);
            DungeonEdgeRef anchorEdge = feature.anchorEdge();
            double markerQ = center.q();
            double markerR = center.r();
            if (!DungeonMapRenderElementFactory.invalidEdge(anchorEdge)) {
                markerQ = (anchorEdge.from().q() + anchorEdge.to().q()) / 2.0;
                markerR = (anchorEdge.from().r() + anchorEdge.to().r()) / 2.0;
            }
            markers.add(new DungeonMapRenderState.Marker(
                    DungeonMapRenderMarkerKinds.featureMarkerLabel(feature.kind()),
                    markerQ,
                    markerR,
                    center.level(),
                    DungeonMapRenderMarkerKinds.featureMarkerKind(feature.kind()),
                    false,
                    travelMarkerHandle(feature, center),
                    false,
                    DungeonMapRenderElementFactory.invalidEdge(anchorEdge) ? null : anchorEdge,
                    feature.label()));
        }
        return List.copyOf(markers);
    }

    private static boolean travelMarkerPlacementPresent(DungeonFeatureSnapshot feature) {
        return feature != null
                && (!feature.cells().isEmpty()
                || !DungeonMapRenderElementFactory.invalidEdge(feature.anchorEdge()));
    }

    private static TravelCellCenter travelMarkerCenter(DungeonFeatureSnapshot feature) {
        DungeonEdgeRef anchorEdge = feature.anchorEdge();
        if (!DungeonMapRenderElementFactory.invalidEdge(anchorEdge)) {
            return new TravelCellCenter(
                    (anchorEdge.from().q() + anchorEdge.to().q()) / 2.0,
                    (anchorEdge.from().r() + anchorEdge.to().r()) / 2.0,
                    anchorEdge.from().level());
        }
        return TravelCellCenter.of(feature.cells());
    }

    private static DungeonMapRenderState.MarkerHandle travelMarkerHandle(
            DungeonFeatureSnapshot feature,
            TravelCellCenter center
    ) {
        int q = (int) Math.floor(center.q());
        int r = (int) Math.floor(center.r());
        int level = center.level();
        if (feature.kind() != DungeonFeatureKind.TRANSITION) {
            return DungeonMapRenderMarkerHandles.markerHandle(q, r, level);
        }
        return DungeonMapRenderMarkerHandles.markerHandle(
                DungeonMapRenderElementFactory.topologyRef(feature.topologyRef()),
                q,
                r,
                level);
    }

    record TravelCellCenter(double q, double r, int level) {

    static TravelCellCenter of(List<DungeonCellRef> cells) {
        if (cells == null || cells.isEmpty()) {
            return new TravelCellCenter(0.5, 0.5, 0);
        }
        double q = 0.0;
        double r = 0.0;
        int level = cells.getFirst().level();
        for (DungeonCellRef cell : cells) {
            q += cell.q() + 0.5;
            r += cell.r() + 0.5;
        }
        return new TravelCellCenter(q / cells.size(), r / cells.size(), level);
    }}
}
