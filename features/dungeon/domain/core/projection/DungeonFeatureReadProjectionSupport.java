package features.dungeon.domain.core.projection;

import java.util.ArrayList;
import java.util.List;
import features.dungeon.domain.core.graph.DungeonRelationGraph;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.transition.Transition;

final class DungeonFeatureReadProjectionSupport {

    private DungeonFeatureReadProjectionSupport() {
    }

    static DungeonFeatureReadProjection.Result project(
            StairCollection stairs,
            List<Transition> transitions,
            List<FeatureMarker> featureMarkers
    ) {
        List<DungeonFeatureFacts> features = new ArrayList<>();
        List<DungeonRelationGraph.FeatureRelation> relations = new ArrayList<>();
        DungeonStairFeatureProjection.append(features, relations, stairs);
        DungeonTransitionFeatureProjection.append(features, relations, transitions);
        DungeonMarkerFeatureProjection.append(features, featureMarkers);
        return new DungeonFeatureReadProjection.Result(features, relations);
    }
}
