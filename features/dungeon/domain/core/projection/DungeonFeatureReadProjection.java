package features.dungeon.domain.core.projection;

import java.util.List;
import features.dungeon.domain.core.graph.DungeonRelationGraph;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.transition.Transition;

public final class DungeonFeatureReadProjection {

    public Result project(StairCollection stairs, List<Transition> transitions, List<FeatureMarker> featureMarkers) {
        return DungeonFeatureReadProjectionSupport.project(stairs, transitions, featureMarkers);
    }

    public record Result(
            List<DungeonFeatureFacts> features,
            List<DungeonRelationGraph.FeatureRelation> relations
    ) {
        public Result {
            features = features == null ? List.of() : List.copyOf(features);
            relations = relations == null ? List.of() : List.copyOf(relations);
        }
    }
}
