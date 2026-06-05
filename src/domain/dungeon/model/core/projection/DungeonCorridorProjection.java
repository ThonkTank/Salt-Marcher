package src.domain.dungeon.model.core.projection;

import java.util.List;
import src.domain.dungeon.model.core.graph.DungeonRelationGraph;
import src.domain.dungeon.model.worldspace.DungeonState;

public record DungeonCorridorProjection(
        long nextBoundaryId,
        List<DungeonState> aggregates,
        List<DungeonAreaFacts> areas,
        List<DungeonBoundaryFacts> boundaries,
        List<DungeonRelationGraph.ContainmentRelation> containment,
        List<DungeonRelationGraph.ConnectionRelation> connections
) {
    public DungeonCorridorProjection {
        aggregates = aggregates == null ? List.of() : List.copyOf(aggregates);
        areas = areas == null ? List.of() : List.copyOf(areas);
        boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
        containment = containment == null ? List.of() : List.copyOf(containment);
        connections = connections == null ? List.of() : List.copyOf(connections);
    }
}
