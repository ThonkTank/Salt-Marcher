package src.domain.dungeon.model.map.model;


import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

final class DungeonCorridorProjectionAssembler {

    private static final String DOOR_KIND = "door";

    private final List<DungeonState> aggregates = new ArrayList<>();
    private final List<DungeonPrimitive> primitives = new ArrayList<>();
    private final List<DungeonAreaFacts> areas = new ArrayList<>();
    private final List<DungeonBoundaryFacts> boundaries = new ArrayList<>();
    private final List<DungeonRelationGraph.ContainmentRelation> containment = new ArrayList<>();
    private final List<DungeonRelationGraph.ConnectionRelation> connections = new ArrayList<>();
    private final Map<DungeonBoundaryKey, Long> boundaryIdsByKey;
    private final Set<String> seenContainment = new LinkedHashSet<>();
    private final Set<String> seenConnections = new LinkedHashSet<>();
    private long primitiveId;

    DungeonCorridorProjectionAssembler(long primitiveId, Map<DungeonBoundaryKey, Long> existingDoorIdsByKey) {
        this.primitiveId = primitiveId;
        this.boundaryIdsByKey = new LinkedHashMap<>(existingDoorIdsByKey == null ? Map.of() : existingDoorIdsByKey);
    }

    void addCorridor(
            DungeonCorridor corridor,
            List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints,
            List<DungeonCell> cells
    ) {
        DungeonState aggregate = new DungeonState(
                corridor.corridorId(),
                DungeonAreaType.CORRIDOR,
                "Corridor " + corridor.corridorId(),
                cells);
        aggregates.add(aggregate);
        areas.add(new DungeonAreaFacts(aggregate.kind(), aggregate.id(), aggregate.label(), aggregate.cells()));
        for (DungeonCorridorEndpointResolver.CorridorEndpoint endpoint : endpoints) {
            if (endpoint.isDoor()) {
                addDoorEndpoint(corridor, endpoint);
            }
        }
    }

    DungeonCorridorProjection toProjection() {
        return new DungeonCorridorProjection(primitiveId, aggregates, primitives, areas, boundaries, containment, connections);
    }

    private void addDoorEndpoint(
            DungeonCorridor corridor,
            DungeonCorridorEndpointResolver.CorridorEndpoint endpoint
    ) {
        DungeonBoundaryKey key = DungeonBoundaryKey.from(Objects.requireNonNull(endpoint.edge()));
        long roomId = Objects.requireNonNull(endpoint.roomId());
        long doorId = boundaryIdsByKey.getOrDefault(
                key,
                endpoint.topologyRef().present() ? endpoint.topologyRef().id() : key.stableId());
        if (!boundaryIdsByKey.containsKey(key)) {
            addNewDoor(corridor, endpoint, key, doorId, roomId);
        } else {
            addContainment(corridor.corridorId(), doorId, DOOR_KIND);
        }
        addConnection(corridor.corridorId(), roomId, DOOR_KIND);
    }

    private void addNewDoor(
            DungeonCorridor corridor,
            DungeonCorridorEndpointResolver.CorridorEndpoint endpoint,
            DungeonBoundaryKey key,
            long doorId,
            long roomId
    ) {
        DungeonTopologyRef topologyRef = endpoint.topologyRef();
        DungeonPrimitive door = new DungeonPrimitive(doorId, DOOR_KIND, "Corridor Door", endpoint.edge());
        primitiveId = Math.max(primitiveId, doorId + 1L);
        primitives.add(door);
        boundaries.add(new DungeonBoundaryFacts(
                door.kind(),
                door.id(),
                door.label(),
                door.edge(),
                topologyRef.present() ? topologyRef : new DungeonTopologyRef(DungeonTopologyElementKind.DOOR, door.id())));
        boundaryIdsByKey.put(key, doorId);
        addContainment(corridor.corridorId(), door.id(), DOOR_KIND);
        addContainment(roomId, door.id(), DOOR_KIND);
    }

    private void addContainment(long containerId, long containedId, String kind) {
        String key = containerId + ":" + containedId + ":" + kind;
        if (seenContainment.add(key)) {
            containment.add(new DungeonRelationGraph.ContainmentRelation(containerId, containedId, kind));
        }
    }

    private void addConnection(long fromId, long toId, String kind) {
        String key = fromId + ":" + toId + ":" + kind;
        if (seenConnections.add(key)) {
            connections.add(new DungeonRelationGraph.ConnectionRelation(fromId, toId, kind));
        }
    }
}
