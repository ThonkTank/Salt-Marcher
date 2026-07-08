package src.domain.dungeon.model.core.projection;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonRelationGraph;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.corridor.Corridor;

/**
 * Projection boundary for corridor, room, and cluster read facts supplied by
 * core structure owners.
 */
final class DungeonCorridorProjectionAssembler {

    private static final String DOOR_KIND = "door";

    private final List<DungeonState> aggregates = new ArrayList<>();
    private final List<DungeonAreaFacts> areas = new ArrayList<>();
    private final List<DungeonBoundaryFacts> boundaries = new ArrayList<>();
    private final List<DungeonRelationGraph.ContainmentRelation> containment = new ArrayList<>();
    private final List<DungeonRelationGraph.ConnectionRelation> connections = new ArrayList<>();
    private final Map<DungeonBoundaryKey, Long> boundaryIdsByKey;
    private final Set<String> seenContainment = new LinkedHashSet<>();
    private final Set<String> seenConnections = new LinkedHashSet<>();
    private long boundaryIdCursor;

    DungeonCorridorProjectionAssembler(long boundaryIdCursor, Map<DungeonBoundaryKey, Long> existingDoorIdsByKey) {
        this.boundaryIdCursor = boundaryIdCursor;
        this.boundaryIdsByKey = new LinkedHashMap<>(existingDoorIdsByKey == null ? Map.of() : existingDoorIdsByKey);
    }

    void addCorridor(
            Corridor corridor,
            List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints,
            List<Cell> cells
    ) {
        DungeonState aggregate = new DungeonState(
                corridor.corridorId(),
                DungeonAreaType.CORRIDOR,
                "Corridor " + corridor.corridorId(),
                cells);
        aggregates.add(aggregate);
        areas.add(new DungeonAreaFacts(
                aggregate.kind(),
                aggregate.id(),
                0L,
                aggregate.label(),
                aggregate.cells(),
                new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR, corridor.corridorId())));
        for (DungeonCorridorEndpointResolver.CorridorEndpoint endpoint : endpoints) {
            if (endpoint.isDoor()) {
                addDoorEndpoint(corridor, endpoint);
            }
        }
    }

    DungeonCorridorProjection toProjection() {
        return new DungeonCorridorProjection(boundaryIdCursor, aggregates, areas, boundaries, containment, connections);
    }

    private void addDoorEndpoint(
            Corridor corridor,
            DungeonCorridorEndpointResolver.CorridorEndpoint endpoint
    ) {
        Edge edge = Objects.requireNonNull(endpoint.edge());
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        long roomId = Objects.requireNonNull(endpoint.roomId());
        long doorId = boundaryIdsByKey.getOrDefault(
                key,
                endpoint.topologyRef().present() ? endpoint.topologyRef().id() : key.stableId());
        if (!boundaryIdsByKey.containsKey(key)) {
            addNewDoor(corridor, endpoint, edge, key, doorId, roomId);
        } else {
            addContainment(corridor.corridorId(), doorId, DOOR_KIND);
        }
        addConnection(corridor.corridorId(), roomId, DOOR_KIND);
    }

    private void addNewDoor(
            Corridor corridor,
            DungeonCorridorEndpointResolver.CorridorEndpoint endpoint,
            Edge edge,
            DungeonBoundaryKey key,
            long doorId,
            long roomId
    ) {
        DungeonTopologyRef topologyRef = endpoint.topologyRef();
        boundaryIdCursor = Math.max(boundaryIdCursor, doorId + 1L);
        boundaries.add(new DungeonBoundaryFacts(
                DOOR_KIND,
                doorId,
                "Corridor Door",
                edge,
                topologyRef.present() ? topologyRef : new DungeonTopologyRef(DungeonTopologyElementKind.DOOR, doorId)));
        boundaryIdsByKey.put(key, doorId);
        addContainment(corridor.corridorId(), doorId, DOOR_KIND);
        addContainment(roomId, doorId, DOOR_KIND);
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
