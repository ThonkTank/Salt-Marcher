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

    public List<String> summaries() {
        java.util.ArrayList<String> result = new java.util.ArrayList<>();
        connections.stream()
                .map(connection -> "corridor " + connection.corridorId() + " -> room " + connection.roomId()
                        + " (" + connection.direction() + ")")
                .forEach(result::add);
        featureRelations.stream()
                .map(relation -> relation.ownerKind() + " " + relation.ownerId()
                        + " -> " + relation.targetKind() + " " + relation.targetId()
                        + " (" + relation.relationKind() + ")")
                .forEach(result::add);
        return List.copyOf(result);
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
