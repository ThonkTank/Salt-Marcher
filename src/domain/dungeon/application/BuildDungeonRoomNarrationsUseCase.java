package src.domain.dungeon.application;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
import src.domain.dungeon.map.value.DungeonTopologyElementKind;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.map.value.DungeonTraversalEndpoint;
import src.domain.dungeon.map.value.DungeonTraversalLink;

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
        return selectedRooms.stream()
                .sorted(Comparator
                        .comparing(DungeonRoom::name, String.CASE_INSENSITIVE_ORDER)
                        .thenComparingLong(DungeonRoom::roomId))
                .map(room -> roomNarration(derived, room))
                .toList();
    }

    private static List<DungeonRoom> selectedRooms(
            DungeonMap dungeonMap,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        if (clusterSelection && clusterId > 0L) {
            return dungeonMap.rooms().rooms().stream()
                    .filter(room -> room.clusterId() == clusterId)
                    .toList();
        }
        if (!isRoomSelection(topologyRef)) {
            return List.of();
        }
        return dungeonMap.rooms().findRoom(topologyRef.id()).stream().toList();
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
        Set<DungeonCell> roomCells = areaForRoom(derived, room.roomId())
                .map(area -> Set.copyOf(area.cells()))
                .orElseGet(Set::of);
        return new LoadDungeonSnapshotUseCase.RoomNarrationData(
                room.roomId(),
                room.name(),
                room.narration().visualDescription(),
                derived.traversalLinks().stream()
                        .filter(link -> link.touches(roomCells))
                        .flatMap(link -> exitNarration(room, link, roomCells).stream())
                        .sorted(Comparator
                                .comparing(LoadDungeonSnapshotUseCase.RoomExitNarrationData::label,
                                        String.CASE_INSENSITIVE_ORDER)
                                .thenComparing(exit -> exit.direction().name()))
                        .toList());
    }

    private static Optional<LoadDungeonSnapshotUseCase.RoomExitNarrationData> exitNarration(
            DungeonRoom room,
            DungeonTraversalLink link,
            Set<DungeonCell> roomCells
    ) {
        DungeonTraversalEndpoint endpoint = link.endpointFrom(roomCells);
        DungeonEdgeDirection direction = endpoint == null ? null : link.directionFrom(endpoint.tile());
        if (endpoint == null || direction == null) {
            return Optional.empty();
        }
        return Optional.of(new LoadDungeonSnapshotUseCase.RoomExitNarrationData(
                link.source().label(),
                endpoint.tile(),
                direction,
                room.narration().exitDescriptions().stream()
                        .filter(exit -> matchesExitDescription(exit, endpoint.tile(), direction))
                        .map(DungeonRoomExitDescription::description)
                        .findFirst()
                        .orElse("")));
    }

    private static boolean matchesExitDescription(
            DungeonRoomExitDescription exit,
            DungeonCell roomCell,
            DungeonEdgeDirection direction
    ) {
        return exit.roomCell().equals(roomCell) && exit.direction() == direction;
    }

    private static Optional<DungeonAreaFacts> areaForRoom(DungeonDerivedState derived, long roomId) {
        return derived.map().areas().stream()
                .filter(area -> area.kind() == DungeonAreaType.ROOM && area.id() == roomId)
                .findFirst();
    }
}
