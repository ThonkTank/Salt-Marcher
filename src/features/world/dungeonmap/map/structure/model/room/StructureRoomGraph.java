package features.world.dungeonmap.map.structure.model.room;

import features.world.dungeonmap.geometry.CardinalDirection;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.map.structure.model.Structure;
import features.world.dungeonmap.map.structure.model.boundary.door.Door;
import features.world.dungeonmap.map.structure.model.boundary.door.DoorRef;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class StructureRoomGraph {

    private static final StructureRoomGraph EMPTY = new StructureRoomGraph(Map.of(), List.of(), Map.of(), List.of());

    private final Map<Long, Set<Long>> adjacencyByRoomId;
    private final List<Set<Long>> components;
    private final Map<Long, Set<Long>> componentByRoomId;
    private final List<DungeonConnection> localConnections;

    static StructureRoomGraph empty() {
        return EMPTY;
    }

    static StructureRoomGraph derive(
            long mapId,
            Long clusterId,
            Structure clusterStructure,
            StructureRoomProjectionIndex projectionIndex
    ) {
        if (projectionIndex == null || projectionIndex.isEmpty()) {
            return EMPTY;
        }
        Map<Long, Set<Long>> adjacency = immutableSetMap(indexAdjacentRoomIds(
                projectionIndex.roomCellsByRoom(),
                projectionIndex.roomsById(),
                projectionIndex.roomsByPoint()));
        List<Set<Long>> components = components(projectionIndex.roomIds(), adjacency);
        return new StructureRoomGraph(
                adjacency,
                components,
                indexComponentByRoomId(components),
                deriveLocalConnections(mapId, clusterId, clusterStructure, projectionIndex.roomsByPoint()));
    }

    private StructureRoomGraph(
            Map<Long, Set<Long>> adjacencyByRoomId,
            List<Set<Long>> components,
            Map<Long, Set<Long>> componentByRoomId,
            List<DungeonConnection> localConnections
    ) {
        this.adjacencyByRoomId = adjacencyByRoomId == null ? Map.of() : Map.copyOf(adjacencyByRoomId);
        this.components = components == null ? List.of() : List.copyOf(components);
        this.componentByRoomId = componentByRoomId == null ? Map.of() : Map.copyOf(componentByRoomId);
        this.localConnections = localConnections == null ? List.of() : List.copyOf(localConnections);
    }

    List<DungeonConnection> localConnections() {
        return localConnections;
    }

    Set<Long> adjacentRoomIds(Long roomId) {
        return roomId == null ? Set.of() : adjacencyByRoomId.getOrDefault(roomId, Set.of());
    }

    List<Set<Long>> components() {
        return components;
    }

    Set<Long> componentContaining(Long roomId) {
        return roomId == null ? Set.of() : componentByRoomId.getOrDefault(roomId, Set.of());
    }

    boolean isConnected() {
        return adjacencyByRoomId.isEmpty() || components.size() <= 1;
    }

    boolean canMergeRooms(Set<Long> roomIds) {
        Set<Long> selected = normalizedRoomIds(roomIds);
        if (selected.size() < 2 || !adjacencyByRoomId.keySet().containsAll(selected)) {
            return false;
        }
        ArrayDeque<Long> queue = new ArrayDeque<>();
        Set<Long> visited = new LinkedHashSet<>();
        Long seed = selected.iterator().next();
        queue.add(seed);
        while (!queue.isEmpty()) {
            Long current = queue.removeFirst();
            if (!visited.add(current)) {
                continue;
            }
            for (Long neighbor : adjacentRoomIds(current)) {
                if (selected.contains(neighbor) && !visited.contains(neighbor)) {
                    queue.addLast(neighbor);
                }
            }
        }
        return visited.equals(selected);
    }

    private static List<DungeonConnection> deriveLocalConnections(
            long mapId,
            Long clusterId,
            Structure clusterStructure,
            Map<GridPoint, Room> roomsByPoint
    ) {
        if (clusterStructure == null || clusterStructure.levels().isEmpty()) {
            return List.of();
        }
        long resolvedClusterId = clusterId == null ? 0L : clusterId;
        List<DungeonConnection> result = new ArrayList<>();
        Set<DoorIdentity> seenDoors = new LinkedHashSet<>();
        for (Integer levelZ : clusterStructure.levels().stream().sorted().toList()) {
            for (Door door : clusterStructure.boundaryAtLevel(levelZ).doors()) {
                if (door == null || !door.hasBoundarySegments()) {
                    continue;
                }
                DoorIdentity doorIdentity = doorIdentity(levelZ, door);
                if (doorIdentity == null || !seenDoors.add(doorIdentity)) {
                    continue;
                }
                DungeonConnection connection = localConnectionForDoor(levelZ, door, mapId, resolvedClusterId, roomsByPoint);
                if (connection != null) {
                    result.add(connection);
                }
            }
        }
        return List.copyOf(result);
    }

    private static DungeonConnection localConnectionForDoor(
            int levelZ,
            Door door,
            long mapId,
            long clusterId,
            Map<GridPoint, Room> roomsByPoint
    ) {
        if (door == null || !door.hasBoundarySegments()) {
            return null;
        }
        List<Room> touchingRooms = new ArrayList<>();
        for (GridPoint cell : door.touchingCells().stream().sorted(GridPoint.ORDER).toList()) {
            Room room = roomsByPoint.get(GridPoint.cell(cell.cellX(), cell.cellY(), levelZ));
            if (room != null && !touchingRooms.contains(room)) {
                touchingRooms.add(room);
            }
        }
        List<ConnectionEndpoint> endpoints = endpointsForDoor(touchingRooms);
        if (endpoints.size() != 2) {
            return null;
        }
        return new DungeonConnection(
                ConnectionKind.LOCAL,
                clusterId,
                mapId,
                levelZ,
                new DoorConnectionCarrier(new DoorRef(door.doorId())),
                endpoints);
    }

    private static List<ConnectionEndpoint> endpointsForDoor(List<Room> touchingRooms) {
        if (touchingRooms == null || touchingRooms.size() < 2) {
            return List.of();
        }
        Room leftRoom = touchingRooms.getFirst();
        Room rightRoom = touchingRooms.get(1);
        if (leftRoom.roomId() == null || rightRoom.roomId() == null || leftRoom.roomId().equals(rightRoom.roomId())) {
            return List.of();
        }
        return List.of(ConnectionEndpoint.room(leftRoom.roomId()), ConnectionEndpoint.room(rightRoom.roomId()));
    }

    private static DoorIdentity doorIdentity(int levelZ, Door door) {
        if (door == null || door.doorId() == null || door.doorId() == 0L) {
            return null;
        }
        return new DoorIdentity(levelZ, new DoorRef(door.doorId()));
    }

    private static Map<Long, Set<Long>> indexAdjacentRoomIds(
            Map<Room, Map<Integer, Set<GridPoint>>> roomCellsByRoom,
            Map<Long, Room> roomsById,
            Map<GridPoint, Room> roomsByPoint
    ) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Long roomId : roomsById.keySet()) {
            result.put(roomId, new LinkedHashSet<>());
        }
        for (Map.Entry<Room, Map<Integer, Set<GridPoint>>> roomEntry : roomCellsByRoom.entrySet()) {
            Room room = roomEntry.getKey();
            if (room == null || room.roomId() == null) {
                continue;
            }
            for (Map.Entry<Integer, Set<GridPoint>> levelEntry : roomEntry.getValue().entrySet()) {
                int levelZ = levelEntry.getKey();
                for (GridPoint cell : levelEntry.getValue()) {
                    for (CardinalDirection direction : CardinalDirection.values()) {
                        Room neighbor = roomsByPoint.get(GridPoint.cell(
                                cell.cellX() + direction.dxCells(),
                                cell.cellY() + direction.dyCells(),
                                levelZ));
                        if (neighbor == null || neighbor.roomId() == null || neighbor.roomId().equals(room.roomId())) {
                            continue;
                        }
                        result.get(room.roomId()).add(neighbor.roomId());
                    }
                }
            }
        }
        return result;
    }

    private static List<Set<Long>> components(Set<Long> roomIds, Map<Long, Set<Long>> adjacency) {
        Set<Long> unvisited = new LinkedHashSet<>(roomIds);
        List<Set<Long>> result = new ArrayList<>();
        while (!unvisited.isEmpty()) {
            Long seed = unvisited.iterator().next();
            Set<Long> component = new LinkedHashSet<>();
            ArrayDeque<Long> queue = new ArrayDeque<>();
            queue.add(seed);
            unvisited.remove(seed);
            while (!queue.isEmpty()) {
                Long current = queue.removeFirst();
                if (!component.add(current)) {
                    continue;
                }
                for (Long neighbor : adjacency.getOrDefault(current, Set.of())) {
                    if (unvisited.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            result.add(Set.copyOf(component));
        }
        return List.copyOf(result);
    }

    private static Map<Long, Set<Long>> indexComponentByRoomId(List<Set<Long>> components) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Set<Long> component : components) {
            for (Long roomId : component) {
                result.put(roomId, component);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, Set<Long>> immutableSetMap(Map<Long, Set<Long>> mutable) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Set<Long>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static Set<Long> normalizedRoomIds(Set<Long> roomIds) {
        Set<Long> result = new LinkedHashSet<>();
        if (roomIds == null) {
            return result;
        }
        for (Long roomId : roomIds) {
            if (roomId != null) {
                result.add(roomId);
            }
        }
        return Set.copyOf(result);
    }

    private record DoorIdentity(int levelZ, DoorRef doorRef) {
    }
}
