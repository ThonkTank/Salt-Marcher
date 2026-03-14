package features.world.dungeonmap.ui.shared.format;

import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.projection.index.DungeonMapIndex;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DungeonRoomFeatureOrder {

    private DungeonRoomFeatureOrder() {
    }

    public static List<DungeonFeature> orderedRoomFeatures(DungeonMapIndex index, Long roomId) {
        if (index == null || roomId == null) {
            return List.of();
        }
        Map<Long, DungeonFeature> featuresById = new LinkedHashMap<>();
        for (DungeonSquare square : index.squaresForRoom(roomId)) {
            for (DungeonFeature feature : index.featuresAtSquare(square.squareId())) {
                if (feature != null && feature.featureId() != null) {
                    featuresById.putIfAbsent(feature.featureId(), feature);
                }
            }
        }
        List<DungeonFeature> features = new ArrayList<>(featuresById.values());
        features.sort(Comparator
                .comparingInt(DungeonFeature::sortOrder)
                .thenComparing(feature -> normalized(feature.name()))
                .thenComparing(feature -> feature.featureId() == null ? Long.MAX_VALUE : feature.featureId()));
        return features;
    }

    private static String normalized(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }
}
