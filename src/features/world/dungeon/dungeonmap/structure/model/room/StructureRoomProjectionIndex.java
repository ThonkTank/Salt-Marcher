package features.world.dungeon.dungeonmap.structure.model.room;

import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.model.structures.room.RoomNarration;
import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.dungeonmap.structure.model.StructureSpecification;
import features.world.dungeon.dungeonmap.structure.model.boundary.StructureBoundary;
import features.world.dungeon.dungeonmap.structure.model.surface.StructureSurface;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

final class StructureRoomProjectionIndex {

    private static final StructureRoomProjectionIndex EMPTY = new StructureRoomProjectionIndex(
            List.of(),
            Map.of(),
            Map.of(),
            Map.of(),
            Map.of(),
            Map.of(),
            false);

    private final List<Room> rooms;
    private final Map<Room, Map<Integer, Set<GridPoint>>> roomCellsByRoom;
    private final Map<Long, Room> roomsById;
    private final Map<Room, Structure> derivedStructuresByRoom;
    private final Map<Long, Structure> derivedStructuresByRoomId;
    private final Map<GridPoint, Room> roomsByPoint;
    private final boolean hasOverlaps;

    static StructureRoomProjectionIndex empty() {
        return EMPTY;
    }

    static StructureRoomProjectionIndex derive(
            long mapId,
            Long clusterId,
            Structure clusterStructure,
            List<Room> roomMetadata
    ) {
        Structure resolvedStructure = clusterStructure == null ? Structure.empty() : clusterStructure;
        if (resolvedStructure.levels().isEmpty()) {
            return EMPTY;
        }
        List<Room> metadata = roomMetadata == null ? List.of() : roomMetadata.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                .toList();
        Map<Integer, Set<GridPoint>> remainingCellsByLevel = new LinkedHashMap<>();
        for (Integer levelZ : resolvedStructure.levels().stream().sorted().toList()) {
            remainingCellsByLevel.put(levelZ, new LinkedHashSet<>(resolvedStructure.surfaceAtLevel(levelZ).surface().cellFootprint().cells()));
        }

        List<Room> result = new java.util.ArrayList<>();
        Map<Room, Map<Integer, Set<GridPoint>>> roomCellsByRoom = new LinkedHashMap<>();
        for (Room metadataRoom : metadata) {
            Map<Integer, Set<GridPoint>> roomCellsByLevel = new LinkedHashMap<>();
            for (Map.Entry<Integer, GridPoint> anchorEntry : metadataRoom.anchorsByLevel().entrySet().stream()
                    .sorted(Map.Entry.comparingByKey())
                    .toList()) {
                Integer levelZ = anchorEntry.getKey();
                GridPoint anchor = anchorEntry.getValue();
                if (levelZ == null || anchor == null) {
                    continue;
                }
                Set<GridPoint> remainingLevelCells = remainingCellsByLevel.get(levelZ);
                if (remainingLevelCells == null || !remainingLevelCells.contains(anchor)) {
                    continue;
                }
                Set<GridPoint> roomCells = intersectCells(
                        resolvedStructure.surfaceAtLevel(levelZ).surface()
                                .reachableFrom(
                                        anchor,
                                        resolvedStructure.boundaryAtLevel(levelZ).boundary())
                                .cells(),
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

        for (Map.Entry<Integer, Set<GridPoint>> entry : new LinkedHashMap<>(remainingCellsByLevel).entrySet()) {
            Integer levelZ = entry.getKey();
            LinkedHashSet<GridPoint> unassigned = new LinkedHashSet<>(entry.getValue());
            while (!unassigned.isEmpty()) {
                GridPoint seed = unassigned.stream().min(GridPoint.ORDER).orElse(null);
                if (seed == null) {
                    break;
                }
                Set<GridPoint> roomCells = intersectCells(
                        resolvedStructure.surfaceAtLevel(levelZ).surface()
                                .reachableFrom(
                                        seed,
                                        resolvedStructure.boundaryAtLevel(levelZ).boundary())
                                .cells(),
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
        Map<Room, Map<Integer, Set<GridPoint>>> resolvedRoomCellsByRoom = immutableRoomCellsByRoom(roomCellsByRoom);
        Map<Long, Room> roomsById = indexRoomsById(partitionedRooms);
        DerivedStructureIndex derivedStructureIndex = indexDerivedStructures(resolvedRoomCellsByRoom, resolvedStructure);
        OverlapIndex overlapIndex = indexRoomsByPoint(partitionedRooms, resolvedRoomCellsByRoom);
        return new StructureRoomProjectionIndex(
                partitionedRooms,
                resolvedRoomCellsByRoom,
                roomsById,
                derivedStructureIndex.structuresByRoom(),
                derivedStructureIndex.structuresByRoomId(),
                overlapIndex.roomsByPoint(),
                overlapIndex.hasOverlaps());
    }

    private StructureRoomProjectionIndex(
            List<Room> rooms,
            Map<Room, Map<Integer, Set<GridPoint>>> roomCellsByRoom,
            Map<Long, Room> roomsById,
            Map<Room, Structure> derivedStructuresByRoom,
            Map<Long, Structure> derivedStructuresByRoomId,
            Map<GridPoint, Room> roomsByPoint,
            boolean hasOverlaps
    ) {
        this.rooms = rooms == null ? List.of() : List.copyOf(rooms);
        this.roomCellsByRoom = roomCellsByRoom == null ? Map.of() : immutableRoomCellsByRoom(roomCellsByRoom);
        this.roomsById = roomsById == null ? Map.of() : Map.copyOf(roomsById);
        this.derivedStructuresByRoom = derivedStructuresByRoom == null ? Map.of() : Map.copyOf(derivedStructuresByRoom);
        this.derivedStructuresByRoomId = derivedStructuresByRoomId == null ? Map.of() : Map.copyOf(derivedStructuresByRoomId);
        this.roomsByPoint = roomsByPoint == null ? Map.of() : Map.copyOf(roomsByPoint);
        this.hasOverlaps = hasOverlaps;
    }

    boolean isEmpty() {
        return rooms.isEmpty();
    }

    List<Room> rooms() {
        return rooms;
    }

    Room findRoom(Long roomId) {
        return roomId == null ? null : roomsById.get(roomId);
    }

    Set<Long> roomIds() {
        return roomsById.keySet();
    }

    boolean containsRoom(Long roomId) {
        return roomId != null && roomsById.containsKey(roomId);
    }

    Room roomAt(GridPoint cell, int levelZ) {
        return cell == null ? null : roomsByPoint.get(GridPoint.cell(cell.x2() / 2, cell.y2() / 2, levelZ));
    }

    Room roomAt(GridPoint point) {
        return point == null ? null : roomsByPoint.get(point);
    }

    Set<GridPoint> cubePoints() {
        return Set.copyOf(roomsByPoint.keySet());
    }

    Structure structureFor(Room room) {
        if (room == null) {
            return Structure.empty();
        }
        Structure derivedStructure = derivedStructuresByRoom.get(room);
        if (derivedStructure != null) {
            return derivedStructure;
        }
        if (room.roomId() == null) {
            return Structure.empty();
        }
        return derivedStructuresByRoomId.getOrDefault(room.roomId(), Structure.empty());
    }

    Structure structureFor(Long roomId) {
        return roomId == null ? Structure.empty() : derivedStructuresByRoomId.getOrDefault(roomId, Structure.empty());
    }

    Map<Room, Map<Integer, Set<GridPoint>>> roomCellsByRoom() {
        return roomCellsByRoom;
    }

    Map<Long, Room> roomsById() {
        return roomsById;
    }

    Map<Room, Structure> derivedStructuresByRoom() {
        return derivedStructuresByRoom;
    }

    Map<GridPoint, Room> roomsByPoint() {
        return roomsByPoint;
    }

    boolean hasOverlaps() {
        return hasOverlaps;
    }

    private static PartitionedRoom resolvedDerivedRoom(
            Long clusterId,
            long mapId,
            Room metadataRoom,
            Map<Integer, Set<GridPoint>> roomCellsByLevel,
            features.world.dungeon.model.structures.room.RoomNarration narration
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

    private static Map<Long, Room> indexRoomsById(List<Room> rooms) {
        Map<Long, Room> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room != null && room.roomId() != null) {
                result.put(room.roomId(), room);
            }
        }
        return Map.copyOf(result);
    }

    private static OverlapIndex indexRoomsByPoint(List<Room> rooms, Map<Room, Map<Integer, Set<GridPoint>>> roomCellsByRoom) {
        Map<GridPoint, Room> result = new LinkedHashMap<>();
        boolean hasOverlaps = false;
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (Map.Entry<Integer, Set<GridPoint>> entry : roomCellsByLevel(room, roomCellsByRoom).entrySet()) {
                Integer levelZ = entry.getKey();
                if (levelZ == null) {
                    continue;
                }
                for (GridPoint cell : entry.getValue()) {
                    GridPoint point = GridPoint.cell(cell.x2() / 2, cell.y2() / 2, levelZ);
                    if (result.containsKey(point) && result.get(point) != room) {
                        hasOverlaps = true;
                    }
                    result.put(point, room);
                }
            }
        }
        return new OverlapIndex(Map.copyOf(result), hasOverlaps);
    }

    private static Map<Integer, Set<GridPoint>> roomCellsByLevel(
            Room room,
            Map<Room, Map<Integer, Set<GridPoint>>> roomCellsByRoom
    ) {
        if (room == null || roomCellsByRoom == null || roomCellsByRoom.isEmpty()) {
            return Map.of();
        }
        return roomCellsByRoom.getOrDefault(room, Map.of());
    }

    private static Map<Room, Map<Integer, Set<GridPoint>>> immutableRoomCellsByRoom(
            Map<Room, Map<Integer, Set<GridPoint>>> mutable
    ) {
        if (mutable == null || mutable.isEmpty()) {
            return Map.of();
        }
        Map<Room, Map<Integer, Set<GridPoint>>> result = new LinkedHashMap<>();
        for (Map.Entry<Room, Map<Integer, Set<GridPoint>>> entry : mutable.entrySet()) {
            if (entry != null && entry.getKey() != null) {
                result.put(entry.getKey(), immutableCellsByLevel(entry.getValue()));
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Integer, Set<GridPoint>> immutableCellsByLevel(Map<Integer, Set<GridPoint>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Set<GridPoint>> result = new LinkedHashMap<>();
        source.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), features.world.dungeon.geometry.GridArea.of(entry.getValue()).cells()));
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Set<GridPoint> intersectCells(Collection<GridPoint> left, Collection<GridPoint> right) {
        if (left == null || right == null) {
            return Set.of();
        }
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        Set<GridPoint> rightSet = right instanceof Set<GridPoint> set ? set : new LinkedHashSet<>(right);
        for (GridPoint cell : left) {
            if (rightSet.contains(cell)) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static GridPoint anchorCell(Set<GridPoint> roomCells, GridPoint preferredAnchor) {
        return preferredAnchor != null && roomCells.contains(preferredAnchor)
                ? preferredAnchor
                : features.world.dungeon.geometry.GridArea.of(roomCells).center();
    }

    private static DerivedStructureIndex indexDerivedStructures(
            Map<Room, Map<Integer, Set<GridPoint>>> roomCellsByRoom,
            Structure clusterStructure
    ) {
        if (roomCellsByRoom == null || roomCellsByRoom.isEmpty()) {
            return new DerivedStructureIndex(Map.of(), Map.of());
        }
        Map<Room, Structure> structuresByRoom = new LinkedHashMap<>();
        Map<Long, Structure> structuresByRoomId = new LinkedHashMap<>();
        for (Map.Entry<Room, Map<Integer, Set<GridPoint>>> entry : roomCellsByRoom.entrySet().stream()
                .sorted(Map.Entry.comparingByKey(Comparator.comparing(Room::roomId, Comparator.nullsLast(Long::compareTo))))
                .toList()) {
            Room room = entry.getKey();
            if (room == null) {
                continue;
            }
            Structure derivedStructure = structureForDerivedRoom(entry.getValue(), room.anchorsByLevel(), clusterStructure);
            if (derivedStructure.levels().isEmpty()) {
                continue;
            }
            structuresByRoom.put(room, derivedStructure);
            if (room.roomId() != null) {
                structuresByRoomId.put(room.roomId(), derivedStructure);
            }
        }
        return new DerivedStructureIndex(
                structuresByRoom.isEmpty() ? Map.of() : Map.copyOf(structuresByRoom),
                structuresByRoomId.isEmpty() ? Map.of() : Map.copyOf(structuresByRoomId));
    }

    private static Structure structureForDerivedRoom(
            Map<Integer, Set<GridPoint>> roomCellsByLevel,
            Map<Integer, GridPoint> preferredAnchorsByLevel,
            Structure clusterStructure
    ) {
        Map<Integer, StructureSpecification.LevelSpecification> levelsByZ = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<GridPoint>> entry : roomCellsByLevel.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .toList()) {
            Integer levelZ = entry.getKey();
            Set<GridPoint> roomCells = entry.getValue();
            if (levelZ == null || roomCells == null || roomCells.isEmpty()) {
                continue;
            }
            GridPoint preferredAnchor = preferredAnchorsByLevel == null ? null : preferredAnchorsByLevel.get(levelZ);
            StructureSurface clippedSurface = clusterStructure.surfaceAtLevel(levelZ).clippedTo(
                    features.world.dungeon.geometry.GridArea.of(roomCells),
                    anchorCell(roomCells, preferredAnchor));
            if (clippedSurface.isEmpty()) {
                continue;
            }
            StructureBoundary clippedBoundary = clusterStructure.boundaryAtLevel(levelZ)
                    .clippedToSurface(clippedSurface.surface().cellFootprint());
            levelsByZ.put(levelZ, new StructureSpecification.LevelSpecification(
                    clippedSurface.surface().anchorCell(),
                    clippedSurface.surface().cellFootprint(),
                    clippedSurface.floor().cellFootprint(),
                    clippedBoundary.doors(),
                    clippedBoundary.walls()));
        }
        return levelsByZ.isEmpty() ? Structure.empty() : Structure.fromSpecification(new StructureSpecification(levelsByZ));
    }

    private record DerivedStructureIndex(Map<Room, Structure> structuresByRoom, Map<Long, Structure> structuresByRoomId) {
    }

    private record PartitionedRoom(Room room, Map<Integer, Set<GridPoint>> roomCellsByLevel) {
    }

    private record OverlapIndex(Map<GridPoint, Room> roomsByPoint, boolean hasOverlaps) {
    }
}
