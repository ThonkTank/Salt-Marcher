package src.domain.dungeon.model.core.projection;

import java.util.List;
import src.domain.dungeon.model.core.structure.feature.FeatureMarker;
import src.domain.dungeon.model.core.structure.feature.FeatureMarkerKind;

final class DungeonMarkerFeatureProjection {

    private DungeonMarkerFeatureProjection() {
    }

    static void append(List<DungeonFeatureFacts> features, List<FeatureMarker> markers) {
        for (FeatureMarker marker : markers == null ? List.<FeatureMarker>of() : markers) {
            if (marker == null) {
                continue;
            }
            FeatureMarkerKind markerKind = marker.kind();
            features.add(new DungeonFeatureFacts(
                    DungeonFeatureType.valueOf(markerKind.name()),
                    marker.markerId(),
                    marker.label(),
                    List.of(marker.anchor()),
                    markerDescription(marker),
                    "",
                    markerFacts(marker),
                    marker.topologyRef()));
        }
    }

    private static String markerDescription(FeatureMarker marker) {
        if (marker == null) {
            return "";
        }
        String markerFacts = "markerCategory: " + marker.kind().name()
                + " | topologyRef: " + marker.topologyRef().kind().name() + " " + marker.topologyRef().id();
        return marker.description().isBlank() ? markerFacts : marker.description() + " | " + markerFacts;
    }

    private static List<String> markerFacts(FeatureMarker marker) {
        if (marker == null) {
            return List.of();
        }
        return List.of(
                "markerCategory: " + marker.kind().name(),
                "topologyRef: " + marker.topologyRef().kind().name() + " " + marker.topologyRef().id());
    }
}
