package src.domain.dungeon.map.service;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonPrimitive;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonCorridorAnchorBinding;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonRelationGraph;
import src.domain.dungeon.map.value.DungeonTopologyRef;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonCorridorReadProjector {

    private static final String DOOR_KIND = "door";
    private static final DungeonCorridorEndpointResolver ENDPOINT_RESOLVER = new DungeonCorridorEndpointResolver();
    private static final DungeonCorridorCellProjector CELL_PROJECTOR = new DungeonCorridorCellProjector();

    public Result project(
            List<DungeonCorridor> corridors,
            Map<Long, DungeonRoomCluster> clustersById,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, List<DungeonCell>> roomCellsByRoom,
            long primitiveId,
            Map<DungeonBoundaryKey, Long> existingDoorIdsByKey
    ) {
        ResultBuilder result = new ResultBuilder(primitiveId, existingDoorIdsByKey);
        Set<DungeonCell> allRoomCells = allRoomCells(roomCellsByRoom);
        Map<DungeonTopologyRef, DungeonCorridorAnchorBinding> anchorsByRef = ENDPOINT_RESOLVER.anchorBindingsByRef(corridors);
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            if (corridor == null || !DungeonCorridorOps.isReadable(corridor)) {
                continue;
            }
            List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints = ENDPOINT_RESOLVER.corridorEndpoints(
                    corridor,
                    clustersById,
                    roomsById,
                    roomCellsByRoom,
                    anchorsByRef);
            result.addCorridor(corridor, endpoints, CELL_PROJECTOR.corridorCells(corridor, clustersById, endpoints, allRoomCells));
        }
        return result.toResult();
    }

    private static Set<DungeonCell> allRoomCells(Map<Long, List<DungeonCell>> roomCellsByRoom) {
        Set<DungeonCell> result = new LinkedHashSet<>();
        for (List<DungeonCell> roomCells : roomCellsByRoom.values()) {
            result.addAll(roomCells);
        }
        return Set.copyOf(result);
    }

    public record Result(
            long nextPrimitiveId,
            List<DungeonAggregate> aggregates,
            List<DungeonPrimitive> primitives,
            List<DungeonAreaFacts> areas,
            List<DungeonBoundaryFacts> boundaries,
            List<DungeonRelationGraph.ContainmentRelation> containment,
            List<DungeonRelationGraph.ConnectionRelation> connections
    ) {
        public Result {
            aggregates = aggregates == null ? List.of() : List.copyOf(aggregates);
            primitives = primitives == null ? List.of() : List.copyOf(primitives);
            areas = areas == null ? List.of() : List.copyOf(areas);
            boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
            containment = containment == null ? List.of() : List.copyOf(containment);
            connections = connections == null ? List.of() : List.copyOf(connections);
        }
    }

    private static final class ResultBuilder {

        private final List<DungeonAggregate> aggregates = new ArrayList<>();
        private final List<DungeonPrimitive> primitives = new ArrayList<>();
        private final List<DungeonAreaFacts> areas = new ArrayList<>();
        private final List<DungeonBoundaryFacts> boundaries = new ArrayList<>();
        private final List<DungeonRelationGraph.ContainmentRelation> containment = new ArrayList<>();
        private final List<DungeonRelationGraph.ConnectionRelation> connections = new ArrayList<>();
        private final Map<DungeonBoundaryKey, Long> boundaryIdsByKey;
        private final Set<String> seenContainment = new LinkedHashSet<>();
        private final Set<String> seenConnections = new LinkedHashSet<>();
        private long primitiveId;

        private ResultBuilder(long primitiveId, Map<DungeonBoundaryKey, Long> existingDoorIdsByKey) {
            this.primitiveId = primitiveId;
            this.boundaryIdsByKey = new LinkedHashMap<>(
                    existingDoorIdsByKey == null ? Map.of() : existingDoorIdsByKey);
        }

        private void addCorridor(
                DungeonCorridor corridor,
                List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints,
                List<DungeonCell> cells
        ) {
            DungeonAggregate aggregate = new DungeonAggregate(
                    corridor.corridorId(),
                    DungeonAreaType.CORRIDOR,
                    "Corridor " + corridor.corridorId(),
                    cells);
            aggregates.add(aggregate);
            areas.add(new DungeonAreaFacts(aggregate.kind(), aggregate.id(), aggregate.label(), aggregate.cells()));
            for (DungeonCorridorEndpointResolver.CorridorEndpoint endpoint : endpoints) {
                if (endpoint.kind() == DungeonCorridorEndpointResolver.CorridorEndpointKind.DOOR) {
                    addDoorEndpoint(corridor, endpoint);
                }
            }
        }

        private void addDoorEndpoint(
                DungeonCorridor corridor,
                DungeonCorridorEndpointResolver.CorridorEndpoint endpoint
        ) {
            DungeonEdge edge = Objects.requireNonNull(endpoint.edge());
            Long roomId = Objects.requireNonNull(endpoint.roomId());
            DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
            boolean preexisting = boundaryIdsByKey.containsKey(key);
            long doorId = boundaryIdsByKey.getOrDefault(
                    key,
                    endpoint.topologyRef().present() ? endpoint.topologyRef().id() : key.stableId());
            if (!preexisting) {
                DungeonTopologyRef topologyRef = endpoint.topologyRef();
                DungeonPrimitive door = new DungeonPrimitive(doorId, DOOR_KIND, "Corridor Door", edge);
                primitiveId = Math.max(primitiveId, doorId + 1L);
                primitives.add(door);
                boundaries.add(new DungeonBoundaryFacts(
                        door.kind(),
                        door.id(),
                        door.label(),
                        door.edge(),
                        topologyRef.present()
                                ? topologyRef
                                : new DungeonTopologyRef(DungeonTopologyElementKind.DOOR, door.id())));
                boundaryIdsByKey.put(key, doorId);
                addContainment(corridor.corridorId(), door.id(), DOOR_KIND);
                addContainment(roomId, door.id(), DOOR_KIND);
            } else {
                addContainment(corridor.corridorId(), doorId, DOOR_KIND);
            }
            addConnection(corridor.corridorId(), roomId, DOOR_KIND);
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

        private Result toResult() {
            return new Result(primitiveId, aggregates, primitives, areas, boundaries, containment, connections);
        }
    }

}
