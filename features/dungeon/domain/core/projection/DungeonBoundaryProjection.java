package features.dungeon.domain.core.projection;

import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.graph.DungeonRelationGraph;

public record DungeonBoundaryProjection(
        List<DungeonBoundaryFacts> boundaries,
        List<DungeonRelationGraph.ContainmentRelation> containment,
        List<DungeonRelationGraph.ConnectionRelation> connections,
        Map<DungeonBoundaryKey, Long> boundaryIdsByKey,
        long nextBoundaryId
) {
    public DungeonBoundaryProjection {
        boundaries = List.copyOf(boundaries);
        containment = List.copyOf(containment);
        connections = List.copyOf(connections);
        boundaryIdsByKey = Map.copyOf(boundaryIdsByKey);
    }
}
