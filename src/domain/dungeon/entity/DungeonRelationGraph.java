package src.domain.dungeon.entity;

import java.util.List;

/**
 * First-class relation store between dungeon owners.
 */
public record DungeonRelationGraph(
        List<ContainmentRelation> containment,
        List<ConnectionRelation> connections
) {

    public DungeonRelationGraph {
        containment = containment == null ? List.of() : List.copyOf(containment);
        connections = connections == null ? List.of() : List.copyOf(connections);
    }

    public record ContainmentRelation(long aggregateId, long memberId, String memberKind) {
    }

    public record ConnectionRelation(long corridorId, long roomId, String direction) {
    }
}
