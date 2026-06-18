package src.domain.dungeon.model.core.projection;

import java.util.List;
import src.domain.dungeon.model.core.graph.DungeonRelationGraph;
import src.domain.dungeon.model.core.structure.feature.FeatureMarker;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.transition.Transition;

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
