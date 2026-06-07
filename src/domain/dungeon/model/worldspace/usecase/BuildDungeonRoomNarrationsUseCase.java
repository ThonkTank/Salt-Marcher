package src.domain.dungeon.model.worldspace.usecase;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.graph.DungeonTraversalEndpoint;
import src.domain.dungeon.model.core.graph.DungeonTraversalLink;
import src.domain.dungeon.model.core.projection.DungeonAreaFacts;
import src.domain.dungeon.model.core.projection.DungeonAreaType;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomExitDescription;
import src.domain.dungeon.model.core.structure.DungeonMap;

final class BuildDungeonRoomNarrationsUseCase {

    List<LoadDungeonSnapshotUseCase.RoomNarrationData> execute(
            DungeonMap dungeonMap,
            DungeonDerivedState derived,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        List<DungeonRoom> selectedRooms = selectedRooms(dungeonMap, topologyRef, clusterId, clusterSelection);
        if (selectedRooms.isEmpty()) {
            return List.of();
        }
        List<DungeonRoom> sortedRooms = new ArrayList<>(selectedRooms);
        sortedRooms.sort(BuildDungeonRoomNarrationsUseCase::compareRooms);
        List<LoadDungeonSnapshotUseCase.RoomNarrationData> narrations = new ArrayList<>();
        for (DungeonRoom room : sortedRooms) {
            narrations.add(roomNarration(derived, room));
        }
        return List.copyOf(narrations);
    }

    private static List<DungeonRoom> selectedRooms(
            DungeonMap dungeonMap,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        if (clusterSelection && clusterId > 0L) {
            List<DungeonRoom> rooms = new ArrayList<>();
            for (DungeonRoom room : dungeonMap.rooms().rooms()) {
                if (room.clusterId() == clusterId) {
                    rooms.add(room);
                }
            }
            return List.copyOf(rooms);
        }
        if (!isRoomSelection(topologyRef)) {
            return List.of();
        }
        DungeonRoom room = dungeonMap.rooms().findRoom(topologyRef.id()).orElse(null);
        return room == null ? List.of() : List.of(room);
    }

    private static boolean isRoomSelection(DungeonTopologyRef topologyRef) {
        return topologyRef != null
                && topologyRef.present()
                && topologyRef.kind() == DungeonTopologyElementKind.ROOM;
    }

    private static LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration(
            DungeonDerivedState derived,
            DungeonRoom room
    ) {
        Optional<DungeonAreaFacts> area = areaForRoom(derived, room.roomId());
        Set<Cell> roomCells = area.isPresent() ? Set.copyOf(area.get().cells()) : Set.of();
        List<LoadDungeonSnapshotUseCase.RoomExitNarrationData> exits = new ArrayList<>();
        for (DungeonTraversalLink link : derived.traversalLinks()) {
            if (link.touches(roomCells)) {
                LoadDungeonSnapshotUseCase.RoomExitNarrationData exit = exitNarration(room, link, roomCells)
                        .orElse(null);
                if (exit != null) {
                    exits.add(exit);
                }
            }
        }
        exits.sort(BuildDungeonRoomNarrationsUseCase::compareExits);
        return new LoadDungeonSnapshotUseCase.RoomNarrationData(
                room.roomId(),
                room.name(),
                room.narration().visualDescription(),
                exits);
    }

    private static Optional<LoadDungeonSnapshotUseCase.RoomExitNarrationData> exitNarration(
            DungeonRoom room,
            DungeonTraversalLink link,
            Set<Cell> roomCells
    ) {
        DungeonTraversalEndpoint endpoint = link.endpointFrom(roomCells);
        Direction direction = endpoint == null ? null : link.directionFrom(endpoint.tile());
        if (endpoint == null || direction == null) {
            return Optional.empty();
        }
        return Optional.of(new LoadDungeonSnapshotUseCase.RoomExitNarrationData(
                link.source().label(),
                endpoint.tile(),
                direction,
                matchingExitDescription(room, endpoint.tile(), direction)));
    }

    private static String matchingExitDescription(
            DungeonRoom room,
            Cell roomCell,
            Direction direction
    ) {
        for (DungeonRoomExitDescription exit : room.narration().exitDescriptions()) {
            if (matchesExitDescription(exit, roomCell, direction)) {
                return exit.description();
            }
        }
        return "";
    }

    private static boolean matchesExitDescription(
            DungeonRoomExitDescription exit,
            Cell roomCell,
            Direction direction
    ) {
        return exit.roomCell().equals(roomCell) && exit.direction() == direction;
    }

    private static Optional<DungeonAreaFacts> areaForRoom(DungeonDerivedState derived, long roomId) {
        for (DungeonAreaFacts area : derived.map().areas()) {
            if (area.kind() == DungeonAreaType.ROOM && area.id() == roomId) {
                return Optional.of(area);
            }
        }
        return Optional.empty();
    }

    private static int compareRooms(DungeonRoom left, DungeonRoom right) {
        int nameComparison = Comparator.nullsFirst(String.CASE_INSENSITIVE_ORDER).compare(left.name(), right.name());
        if (nameComparison != 0) {
            return nameComparison;
        }
        return Long.compare(left.roomId(), right.roomId());
    }

    private static int compareExits(
            LoadDungeonSnapshotUseCase.RoomExitNarrationData left,
            LoadDungeonSnapshotUseCase.RoomExitNarrationData right
    ) {
        int labelComparison = Comparator.nullsFirst(String.CASE_INSENSITIVE_ORDER).compare(left.label(), right.label());
        if (labelComparison != 0) {
            return labelComparison;
        }
        return left.direction().name().compareTo(right.direction().name());
    }
}
