package features.dungeon.domain.core.projection;

import java.util.List;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;

final class DungeonMarkerFeatureProjection {

    private DungeonMarkerFeatureProjection() {
    }

    static void append(List<DungeonFeatureFacts> features, List<FeatureMarker> markers) {
        for (FeatureMarker marker : markers == null ? List.<FeatureMarker>of() : markers) {
            if (marker == null) {
                continue;
            }
            features.add(new DungeonFeatureFacts(
                    featureType(marker.kind()),
                    marker.markerId(),
                    marker.label(),
                    List.of(marker.anchor()),
                    marker.description(),
                    "",
                    DungeonFeatureFacts.StatePanelFacts.empty(),
                    marker.topologyRef(),
                    null));
        }
    }

    private static DungeonFeatureType featureType(FeatureMarkerKind kind) {
        return switch (kind) {
            case OBJECT -> DungeonFeatureType.OBJECT;
            case ENCOUNTER -> DungeonFeatureType.ENCOUNTER;
            case POI -> DungeonFeatureType.POI;
        };
    }
}
