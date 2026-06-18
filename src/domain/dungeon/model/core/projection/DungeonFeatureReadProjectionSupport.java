package src.domain.dungeon.model.core.projection;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.graph.DungeonRelationGraph;
import src.domain.dungeon.model.core.structure.feature.FeatureMarker;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.transition.Transition;

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
