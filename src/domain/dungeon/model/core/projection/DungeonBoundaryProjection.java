package src.domain.dungeon.model.core.projection;

import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.graph.DungeonRelationGraph;

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
