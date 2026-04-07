package features.world.dungeonmap.structure.model;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.structure.model.boundary.StructureBoundary;
import features.world.dungeonmap.structure.model.boundary.Door;
import features.world.dungeonmap.structure.model.boundary.DoorRef;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Structure-owned room topology derived from one physical structure plus persisted room metadata.
 */
public final class StructureRoomTopology {

    private final long mapId;
    private final Long clusterId;
    private final Structure clusterStructure;
    private final List<Room> rooms;
    private final Map<Room, Map<Integer, Set<CellCoord>>> roomCellsByRoom;
    private final Map<Long, Room> roomsById;
    private final Map<CubePoint, Room> roomsByPoint;
    private final boolean hasOverlaps;
    private final List<DungeonConnection> localConnections;

    private Map<Long, Set<Long>> adjacentRoomIdsByRoomId;
    private List<Set<Long>> components;
    private Map<Long, Set<Long>> componentByRoomId;

    public static StructureRoomTopology empty() {
        return new StructureRoomTopology(0L, null, Structure.empty(), List.of(), Map.of(), Map.of(), Map.of(), false);
    }

    public static StructureRoomTopology derive(
            long mapId,
            Long clusterId,
            Structure clusterStructure,
            List<Room> roomMetadata
    ) {
        Structure resolvedStructure = clusterStructure == null ? Structure.empty() : clusterStructure;
        if (resolvedStructure.levels().isEmpty()) {
            return new StructureRoomTopology(mapId, clusterId, resolvedStructure, List.of(), Map.of(), Map.of(), Map.of(), false);
        }
        List<Room> metadata = roomMetadata == null ? List.of() : roomMetadata.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                .toList();
        Map<Integer, Set<CellCoord>> remainingCellsByLevel = new LinkedHashMap<>();
        for (Integer levelZ : resolvedStructure.levels().stream().sorted().toList()) {
            remainingCellsByLevel.put(levelZ, new LinkedHashSet<>(resolvedStructure.surfaceAtLevel(levelZ).cellCoords()));
        }

        List<Room> result = new ArrayList<>();
        Map<Room, Map<Integer, Set<CellCoord>>> roomCellsByRoom = new LinkedHashMap<>();
        for (Room metadataRoom : metadata) {
            Map<Integer, Set<CellCoord>> roomCellsByLevel = new LinkedHashMap<>();
            for (Map.Entry<Integer, CellCoord> anchorEntry : metadataRoom.anchorsByLevel().entrySet().stream()
                    .sorted(Map.Entry.comparingByKey())
                    .toList()) {
                Integer levelZ = anchorEntry.getKey();
                CellCoord anchor = anchorEntry.getValue();
                if (levelZ == null || anchor == null) {
                    continue;
                }
                Set<CellCoord> remainingLevelCells = remainingCellsByLevel.get(levelZ);
                if (remainingLevelCells == null || !remainingLevelCells.contains(anchor)) {
                    continue;
                }
                Set<CellCoord> roomCells = intersectCells(
                        resolvedStructure.surfaceAtLevel(levelZ).reachableFrom(anchor, resolvedStructure.boundaryAtLevel(levelZ).boundaryEdges()),
                        remainingLevelCells);
                if (roomCells.isEmpty()) {
                    continue;
                }
                remainingLevelCells.removeAll(roomCells);
                if (remainingLevelCells.isEmpty()) {
                    remainingCellsByLevel.remove(levelZ);
                }
                roomCellsByLevel.put(levelZ, Set.copyOf(roomCells));
            }
            if (roomCellsByLevel.isEmpty()) {
                continue;
            }
            PartitionedRoom projection = resolvedDerivedRoom(clusterId, mapId, metadataRoom, roomCellsByLevel, metadataRoom.narration());
            result.add(projection.room());
            roomCellsByRoom.put(projection.room(), projection.roomCellsByLevel());
        }

        for (Map.Entry<Integer, Set<CellCoord>> entry : new LinkedHashMap<>(remainingCellsByLevel).entrySet()) {
            Integer levelZ = entry.getKey();
            LinkedHashSet<CellCoord> unassigned = new LinkedHashSet<>(entry.getValue());
            while (!unassigned.isEmpty()) {
                CellCoord seed = unassigned.stream().min(CellCoord.ORDER).orElse(null);
                if (seed == null) {
                    break;
                }
                Set<CellCoord> roomCells = intersectCells(
                        resolvedStructure.surfaceAtLevel(levelZ).reachableFrom(seed, resolvedStructure.boundaryAtLevel(levelZ).boundaryEdges()),
                        unassigned);
                if (roomCells.isEmpty()) {
                    unassigned.remove(seed);
                    continue;
                }
                unassigned.removeAll(roomCells);
                Room metadataRoom = Room.metadata(
                        null,
                        mapId,
                        clusterId == null ? 0L : clusterId,
                        null,
                        Map.of(levelZ, seed),
                        RoomNarration.empty());
                PartitionedRoom projection = resolvedDerivedRoom(
                        clusterId,
                        mapId,
                        metadataRoom,
                        Map.of(levelZ, Set.copyOf(roomCells)),
                        metadataRoom.narration());
                result.add(projection.room());
                roomCellsByRoom.put(projection.room(), projection.roomCellsByLevel());
            }
        }

        List<Room> partitionedRooms = result.isEmpty() ? List.of() : List.copyOf(result);
        Map<Room, Map<Integer, Set<CellCoord>>> resolvedRoomCellsByRoom = immutableRoomCellsByRoom(roomCellsByRoom);
        Map<Long, Room> roomsById = indexRoomsById(partitionedRooms);
        OverlapIndex overlapIndex = indexRoomsByPoint(partitionedRooms, resolvedRoomCellsByRoom);
        return new StructureRoomTopology(
                mapId,
                clusterId,
                resolvedStructure,
                partitionedRooms,
                resolvedRoomCellsByRoom,
                roomsById,
                overlapIndex.roomsByPoint(),
                overlapIndex.hasOverlaps());
    }

    private StructureRoomTopology(
            long mapId,
            Long clusterId,
            Structure clusterStructure,
            List<Room> rooms,
            Map<Room, Map<Integer, Set<CellCoord>>> roomCellsByRoom,
            Map<Long, Room> roomsById,
            Map<CubePoint, Room> roomsByPoint,
            boolean hasOverlaps
    ) {
        this.mapId = mapId;
        this.clusterId = clusterId;
        this.clusterStructure = clusterStructure == null ? Structure.empty() : clusterStructure;
        this.rooms = rooms == null ? List.of() : List.copyOf(rooms);
        this.roomCellsByRoom = roomCellsByRoom == null ? Map.of() : immutableRoomCellsByRoom(roomCellsByRoom);
        this.roomsById = roomsById == null ? Map.of() : Map.copyOf(roomsById);
        this.roomsByPoint = roomsByPoint == null ? Map.of() : Map.copyOf(roomsByPoint);
        this.hasOverlaps = hasOverlaps;
        this.localConnections = deriveLocalConnections(mapId, clusterId, this.clusterStructure, this.roomCellsByRoom, this.roomsByPoint, this.rooms);
        this.adjacentRoomIdsByRoomId = null;
        this.components = null;
        this.componentByRoomId = null;
    }

    public long mapId() {
        return mapId;
    }

    public Long clusterId() {
        return clusterId;
    }

    public List<Room> rooms() {
        return rooms;
    }

    public List<DungeonConnection> localConnections() {
        return localConnections;
    }

    public StructureRoomTopology withRooms(List<Room> rooms) {
        return derive(mapId, clusterId, clusterStructure, rooms);
    }

    public StructureRoomTopology withClusterId(Long clusterId) {
        long resolvedClusterId = clusterId == null ? (this.clusterId == null ? 0L : this.clusterId) : clusterId;
        return derive(
                mapId,
                clusterId,
                clusterStructure,
                rooms.stream()
                        .map(room -> room == null ? null : room.withClusterId(resolvedClusterId))
                        .toList());
    }

    public StructureRoomTopology rebasedTo(Structure structure) {
        return derive(mapId, clusterId, structure, rooms);
    }

    public StructureRoomTopology translatedBy(CellCoord delta, int levelDelta, Structure movedStructure) {
        return derive(
                mapId,
                clusterId,
                movedStructure,
                rooms.stream()
                        .map(room -> room == null ? null : room.movedBy(delta, levelDelta))
                        .toList());
    }

    public StructureRoomTopology projectedToLevel(int levelZ, Structure projectedStructure) {
        if (projectedStructure == null || projectedStructure.levels().isEmpty()) {
            return empty();
        }
        List<Room> projectedRooms = rooms.stream()
                .map(room -> projectRoomToLevel(room, levelZ))
                .filter(Objects::nonNull)
                .toList();
        return derive(mapId, clusterId, projectedStructure, projectedRooms);
    }

    public Set<Integer> roomLevels(Room room) {
        return structureFor(room).levels();
    }

    public Set<Integer> roomLevels(Long roomId) {
        return structureFor(roomId).levels();
    }

    public int roomPrimaryLevel(Room room) {
        return structureFor(room).primaryLevel();
    }

    public int roomPrimaryLevel(Long roomId) {
        return structureFor(roomId).primaryLevel();
    }

    public List<Integer> roomRelevantLevels(Room room, CellCoord focusCell, int focusLevelZ) {
        Structure roomStructure = structureFor(room);
        if (focusCell != null && roomStructure.surfaceAtLevel(focusLevelZ).contains(focusCell)) {
            return List.of(focusLevelZ);
        }
        return roomStructure.levels().stream()
                .sorted()
                .toList();
    }

    public CellCoord roomAnchorCellAtLevel(Room room, int levelZ) {
        return structureFor(room).surfaceAtLevel(levelZ).anchorCell();
    }

    public CellCoord roomAnchorCellAtLevel(Long roomId, int levelZ) {
        return structureFor(roomId).surfaceAtLevel(levelZ).anchorCell();
    }

    public CellCoord roomCenterCellAtLevel(Room room, int levelZ) {
        return structureFor(room).surfaceAtLevel(levelZ).centerCellCoord();
    }

    public CellCoord roomCenterCellAtLevel(Long roomId, int levelZ) {
        return structureFor(roomId).surfaceAtLevel(levelZ).centerCellCoord();
    }

    public CellCoord roomSurfaceCenterCellAtLevel(Room room, int levelZ) {
        return structureFor(room).surfaceAtLevel(levelZ).surfaceCenterCellCoord();
    }

    public Set<CellCoord> roomCellsAtLevel(Room room, int levelZ) {
        return structureFor(room).surfaceAtLevel(levelZ).cellCoords();
    }

    public Set<CellCoord> roomCellsAtLevel(Long roomId, int levelZ) {
        return structureFor(roomId).surfaceAtLevel(levelZ).cellCoords();
    }

    public Set<CellCoord> roomFloorCellsAtLevel(Room room, int levelZ) {
        return structureFor(room).surfaceAtLevel(levelZ).floorCells();
    }

    public Set<CellCoord> roomFloorCellsAtLevel(Long roomId, int levelZ) {
        return structureFor(roomId).surfaceAtLevel(levelZ).floorCells();
    }

    public boolean roomContainsCell(Room room, CellCoord cell, int levelZ) {
        return structureFor(room).surfaceAtLevel(levelZ).contains(cell);
    }

    public boolean roomContainsCell(Long roomId, CellCoord cell, int levelZ) {
        return structureFor(roomId).surfaceAtLevel(levelZ).contains(cell);
    }

    public boolean roomHasFloorCell(Room room, CellCoord cell, int levelZ) {
        return structureFor(room).surfaceAtLevel(levelZ).hasFloorCell(cell);
    }

    public boolean roomHasFloorCell(Long roomId, CellCoord cell, int levelZ) {
        return structureFor(roomId).surfaceAtLevel(levelZ).hasFloorCell(cell);
    }

    public Room findRoom(Long roomId) {
        return roomId == null ? null : roomsById.get(roomId);
    }

    public Set<Long> roomIds() {
        return roomsById.keySet();
    }

    public boolean containsRoom(Long roomId) {
        return roomId != null && roomsById.containsKey(roomId);
    }

    public Room roomAt(CellCoord cell, int levelZ) {
        return cell == null ? null : roomsByPoint.get(CubePoint.at(cell, levelZ));
    }

    public Room roomAt(CubePoint point) {
        return point == null ? null : roomsByPoint.get(point);
    }

    public Set<CubePoint> cubePoints() {
        return Set.copyOf(roomsByPoint.keySet());
    }

    public List<Room> adjacentRooms(Room room) {
        if (room == null || room.roomId() == null) {
            return List.of();
        }
        return adjacentRoomIds(room.roomId()).stream()
                .map(this::findRoom)
                .filter(Objects::nonNull)
                .toList();
    }

    public Set<Long> adjacentRoomIds(Long roomId) {
        return roomId == null ? Set.of() : adjacency().getOrDefault(roomId, Set.of());
    }

    public List<Set<Long>> components() {
        return componentsLazy();
    }

    public Set<Long> componentContaining(Long roomId) {
        return roomId == null ? Set.of() : componentByRoomId().getOrDefault(roomId, Set.of());
    }

    public Set<Long> componentContaining(CellCoord cell, int levelZ) {
        Room room = roomAt(cell, levelZ);
        return room == null ? Set.of() : componentContaining(room.roomId());
    }

    public boolean isConnected() {
        return roomsById.isEmpty() || componentsLazy().size() <= 1;
    }

    public boolean hasOverlappingRooms() {
        return hasOverlaps;
    }

    public boolean canMergeRooms(Set<Long> roomIds) {
        Set<Long> selected = normalizedRoomIds(roomIds);
        if (selected.size() < 2 || !roomsById.keySet().containsAll(selected)) {
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

    public Map<Long, Set<Long>> adjacencyIndex() {
        return adjacency();
    }

    public Map<Long, Set<Long>> componentByRoomIdIndex() {
        return componentByRoomId();
    }

    public Structure structureFor(Room room) {
        if (room == null) {
            return Structure.empty();
        }
        Map<Integer, Set<CellCoord>> roomCellsByLevel = roomCellsByRoom.get(room);
        if (roomCellsByLevel != null) {
            return structureForDerivedRoom(roomCellsByLevel, room.anchorsByLevel(), clusterStructure);
        }
        if (room.roomId() == null) {
            return Structure.empty();
        }
        return structureFor(room.roomId());
    }

    public Structure structureFor(Long roomId) {
        if (roomId == null) {
            return Structure.empty();
        }
        Room room = roomsById.get(roomId);
        if (room == null) {
            return Structure.empty();
        }
        Map<Integer, Set<CellCoord>> roomCellsByLevel = roomCellsByRoom.get(room);
        return roomCellsByLevel == null
                ? Structure.empty()
                : structureForDerivedRoom(roomCellsByLevel, room.anchorsByLevel(), clusterStructure);
    }

    private Map<Long, Set<Long>> adjacency() {
        if (adjacentRoomIdsByRoomId == null) {
            adjacentRoomIdsByRoomId = immutableSetMap(indexAdjacentRoomIds(roomCellsByRoom, roomsById, roomsByPoint));
        }
        return adjacentRoomIdsByRoomId;
    }

    private List<Set<Long>> componentsLazy() {
        if (components == null) {
            components = components(roomsById.keySet(), adjacency());
        }
        return components;
    }

    private Map<Long, Set<Long>> componentByRoomId() {
        if (componentByRoomId == null) {
            componentByRoomId = indexComponentByRoomId(componentsLazy());
        }
        return componentByRoomId;
    }

    private static List<DungeonConnection> deriveLocalConnections(
            long mapId,
            Long clusterId,
            Structure clusterStructure,
            Map<Room, Map<Integer, Set<CellCoord>>> roomCellsByRoom,
            Map<CubePoint, Room> roomsByPoint,
            List<Room> rooms
    ) {
        if (rooms.isEmpty()) {
            return List.of();
        }
        long resolvedClusterId = clusterId == null ? 0L : clusterId;
        Map<String, DoorComponent> doorsByKey = new LinkedHashMap<>();
        List<DungeonConnection> result = new ArrayList<>();
        Set<String> seenKeys = new LinkedHashSet<>();
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            Structure roomStructure = structureForDerivedRoom(
                    roomCellsByLevel(room, roomCellsByRoom),
                    room.anchorsByLevel(),
                    clusterStructure);
            for (Integer levelZ : roomStructure.levels()) {
                for (Door door : roomStructure.boundaryAtLevel(levelZ).doors()) {
                    if (door != null && !door.isEmpty()) {
                        String key = doorKey(levelZ, door);
                        if (seenKeys.add(key)) {
                            DoorComponent doorComponent = new DoorComponent(levelZ, door);
                            DungeonConnection connection = localConnectionForDoor(doorComponent, mapId, resolvedClusterId, roomsByPoint);
                            if (connection != null) {
                                result.add(connection);
                            }
                        }
                    }
                }
            }
        }
        return List.copyOf(result);
    }

    private static DungeonConnection localConnectionForDoor(
            DoorComponent doorComponent,
            long mapId,
            long clusterId,
            Map<CubePoint, Room> roomsByPoint
    ) {
        if (doorComponent == null || doorComponent.door() == null || doorComponent.door().isEmpty()) {
            return null;
        }
        List<Room> touchingRooms = new ArrayList<>();
        for (GridSegment2x segment2x : doorComponent.door().segments2x()) {
            for (CellCoord cell : segment2x.touchingCells().stream().sorted(CellCoord.ORDER).toList()) {
                Room room = roomsByPoint.get(CubePoint.at(cell, doorComponent.levelZ()));
                if (room != null && !touchingRooms.contains(room)) {
                    touchingRooms.add(room);
                }
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
                doorComponent.levelZ(),
                new DoorConnectionCarrier(new DoorRef(doorComponent.door().doorId())),
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

    private static String doorKey(int levelZ, Door door) {
        StringBuilder builder = new StringBuilder();
        builder.append(levelZ).append(':');
        boolean first = true;
        for (GridSegment2x segment2x : (door == null ? List.<GridSegment2x>of() : door.segments2x()).stream()
                .sorted(GridSegment2x.ORDER)
                .toList()) {
            if (!first) {
                builder.append('|');
            }
            first = false;
            builder.append(segment2x.start().x2()).append(',').append(segment2x.start().y2())
                    .append('-')
                    .append(segment2x.end().x2()).append(',').append(segment2x.end().y2());
        }
        return builder.toString();
    }

    private static Structure structureForDerivedRoom(
            Map<Integer, Set<CellCoord>> roomCellsByLevel,
            Map<Integer, CellCoord> preferredAnchorsByLevel,
            Structure clusterStructure
    ) {
        Map<Integer, Structure.LevelStructure> levelsByZ = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<CellCoord>> entry : roomCellsByLevel.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .toList()) {
            Integer levelZ = entry.getKey();
            Set<CellCoord> roomCells = entry.getValue();
            if (levelZ == null || roomCells == null || roomCells.isEmpty()) {
                continue;
            }
            CellCoord preferredAnchor = preferredAnchorsByLevel == null ? null : preferredAnchorsByLevel.get(levelZ);
            StructureSurface clippedSurface = clusterStructure.surfaceAtLevel(levelZ).clippedTo(
                    roomCells,
                    anchorCell(roomCells, preferredAnchor));
            if (clippedSurface.isEmpty()) {
                continue;
            }
            StructureBoundary clippedBoundary = clusterStructure.boundaryAtLevel(levelZ).clippedToSurface(clippedSurface.cellCoords());
            levelsByZ.put(levelZ, Structure.LevelStructure.fromSurfaceAndBoundary(clippedSurface, clippedBoundary));
        }
        return levelsByZ.isEmpty() ? Structure.empty() : Structure.fromLevels(levelsByZ);
    }

    private static PartitionedRoom resolvedDerivedRoom(
            Long clusterId,
            long mapId,
            Room metadataRoom,
            Map<Integer, Set<CellCoord>> roomCellsByLevel,
            RoomNarration narration
    ) {
        Room room = new Room(
                metadataRoom.roomId(),
                mapId,
                clusterId == null ? 0L : clusterId,
                metadataRoom.name(),
                metadataRoom.anchorsByLevel(),
                narration);
        return new PartitionedRoom(room, immutableCellsByLevel(roomCellsByLevel));
    }

    private static Room projectRoomToLevel(Room room, int levelZ) {
        if (room == null || room.anchorAtLevel(levelZ) == null) {
            return null;
        }
        return Room.metadata(
                room.roomId(),
                room.mapId(),
                room.clusterId(),
                room.name(),
                Map.of(levelZ, room.anchorAtLevel(levelZ)),
                room.narration());
    }

    private static Map<Long, Room> indexRoomsById(List<Room> rooms) {
        Map<Long, Room> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room != null && room.roomId() != null) {
                result.put(room.roomId(), room);
            }
        }
        return Map.copyOf(result);
    }

    private static OverlapIndex indexRoomsByPoint(List<Room> rooms, Map<Room, Map<Integer, Set<CellCoord>>> roomCellsByRoom) {
        Map<CubePoint, Room> result = new LinkedHashMap<>();
        boolean hasOverlaps = false;
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (Map.Entry<Integer, Set<CellCoord>> entry : roomCellsByLevel(room, roomCellsByRoom).entrySet()) {
                Integer levelZ = entry.getKey();
                if (levelZ == null) {
                    continue;
                }
                for (CellCoord cell : entry.getValue()) {
                    CubePoint point = CubePoint.at(cell, levelZ);
                    if (result.containsKey(point) && result.get(point) != room) {
                        hasOverlaps = true;
                    }
                    result.put(point, room);
                }
            }
        }
        return new OverlapIndex(Map.copyOf(result), hasOverlaps);
    }

    private static Map<Long, Set<Long>> indexAdjacentRoomIds(
            Map<Room, Map<Integer, Set<CellCoord>>> roomCellsByRoom,
            Map<Long, Room> roomsById,
            Map<CubePoint, Room> roomsByPoint
    ) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Long roomId : roomsById.keySet()) {
            result.put(roomId, new LinkedHashSet<>());
        }
        for (Map.Entry<Room, Map<Integer, Set<CellCoord>>> roomEntry : roomCellsByRoom.entrySet()) {
            Room room = roomEntry.getKey();
            if (room == null || room.roomId() == null) {
                continue;
            }
            for (Map.Entry<Integer, Set<CellCoord>> levelEntry : roomEntry.getValue().entrySet()) {
                int levelZ = levelEntry.getKey();
                for (CellCoord cell : levelEntry.getValue()) {
                    for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                        Room neighbor = roomsByPoint.get(CubePoint.at(cell.add(step), levelZ));
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

    private static Map<Integer, Set<CellCoord>> roomCellsByLevel(
            Room room,
            Map<Room, Map<Integer, Set<CellCoord>>> roomCellsByRoom
    ) {
        if (room == null || roomCellsByRoom == null || roomCellsByRoom.isEmpty()) {
            return Map.of();
        }
        return roomCellsByRoom.getOrDefault(room, Map.of());
    }

    private static Map<Room, Map<Integer, Set<CellCoord>>> immutableRoomCellsByRoom(
            Map<Room, Map<Integer, Set<CellCoord>>> mutable
    ) {
        if (mutable == null || mutable.isEmpty()) {
            return Map.of();
        }
        Map<Room, Map<Integer, Set<CellCoord>>> result = new LinkedHashMap<>();
        for (Map.Entry<Room, Map<Integer, Set<CellCoord>>> entry : mutable.entrySet()) {
            if (entry != null && entry.getKey() != null) {
                result.put(entry.getKey(), immutableCellsByLevel(entry.getValue()));
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Integer, Set<CellCoord>> immutableCellsByLevel(Map<Integer, Set<CellCoord>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
        source.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), CellCoord.normalize(entry.getValue())));
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Set<CellCoord> intersectCells(Collection<CellCoord> left, Collection<CellCoord> right) {
        if (left == null || right == null) {
            return Set.of();
        }
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        Set<CellCoord> rightSet = right instanceof Set<CellCoord> set ? set : new LinkedHashSet<>(right);
        for (CellCoord cell : left) {
            if (rightSet.contains(cell)) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static CellCoord anchorCell(Set<CellCoord> roomCells, CellCoord preferredAnchor) {
        return preferredAnchor != null && roomCells.contains(preferredAnchor)
                ? preferredAnchor
                : CellCoord.bestCenter(roomCells);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof StructureRoomTopology that)) {
            return false;
        }
        return mapId == that.mapId
                && hasOverlaps == that.hasOverlaps
                && Objects.equals(clusterId, that.clusterId)
                && Objects.equals(rooms, that.rooms)
                && Objects.equals(roomCellsByRoom, that.roomCellsByRoom)
                && Objects.equals(roomsById, that.roomsById)
                && Objects.equals(roomsByPoint, that.roomsByPoint)
                && Objects.equals(localConnections, that.localConnections);
    }

    @Override
    public int hashCode() {
        return Objects.hash(mapId, clusterId, rooms, roomCellsByRoom, roomsById, roomsByPoint, hasOverlaps, localConnections);
    }

    @Override
    public String toString() {
        return "StructureRoomTopology[mapId=" + mapId
                + ", clusterId=" + clusterId
                + ", rooms=" + rooms
                + ", hasOverlaps=" + hasOverlaps + "]";
    }

    private record DoorComponent(int levelZ, Door door) {
    }

    private record PartitionedRoom(Room room, Map<Integer, Set<CellCoord>> roomCellsByLevel) {
    }

    private record OverlapIndex(Map<CubePoint, Room> roomsByPoint, boolean hasOverlaps) {
    }
}
