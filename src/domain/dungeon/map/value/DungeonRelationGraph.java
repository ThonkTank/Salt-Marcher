package src.domain.dungeon.map.value;

import java.util.List;

/**
 * First-class relation store between dungeon owners.
 */
public record DungeonRelationGraph(
        List<ContainmentRelation> containment,
        List<ConnectionRelation> connections,
        List<FeatureRelation> featureRelations
) {

    public DungeonRelationGraph {
        containment = containment == null ? List.of() : List.copyOf(containment);
        connections = connections == null ? List.of() : List.copyOf(connections);
        featureRelations = featureRelations == null ? List.of() : List.copyOf(featureRelations);
    }

    public DungeonRelationGraph(
            List<ContainmentRelation> containment,
            List<ConnectionRelation> connections
    ) {
        this(containment, connections, List.of());
    }

    public record ContainmentRelation(long aggregateId, long memberId, String memberKind) {
    }

    public record ConnectionRelation(long corridorId, long roomId, String direction) {
    }

    public record FeatureRelation(long ownerId, String ownerKind, long targetId, String targetKind, String relationKind) {
        public FeatureRelation {
            ownerKind = ownerKind == null ? "" : ownerKind;
            targetKind = targetKind == null ? "" : targetKind;
            relationKind = relationKind == null ? "" : relationKind;
        }
    }
}
