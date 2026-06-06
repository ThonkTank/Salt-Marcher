package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;

import src.domain.dungeon.model.core.structure.room.DungeonClusterBoundary;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.dungeon.model.core.structure.room.DungeonRoomNarration;
import src.domain.dungeon.model.core.structure.room.Room;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;

final class DungeonRoomClusterRebuildLogic {

    DungeonMap rebuilt(DungeonMap dungeonMap, List<DungeonRoomTopologyClusterWork> workClusters) {
        List<DungeonRoomCluster> clusters = new ArrayList<>();
        List<DungeonRoom> rooms = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : sortedByClusterId(workClusters)) {
            if (work.allCells().isEmpty()) {
                continue;
            }
            List<DungeonRoom> rebuiltRooms = roomsFor(work);
            if (rebuiltRooms.isEmpty()) {
                continue;
            }
            clusters.add(work.rebuiltCluster());
            rooms.addAll(rebuiltRooms);
        }
        SpatialTopology nextTopology = dungeonMap.topology().withRoomClusters(clusters);
        return new DungeonMap(
                dungeonMap.metadata(),
                nextTopology,
                new RoomCatalog(rooms),
                dungeonMap.corridors(),
                dungeonMap.stairs(),
                dungeonMap.transitionCatalog(),
                dungeonMap.revision() + 1L);
    }

    DungeonMap rebuiltPreservingRooms(DungeonMap dungeonMap, List<DungeonRoomTopologyClusterWork> workClusters) {
        List<DungeonRoomCluster> clusters = new ArrayList<>();
        List<DungeonRoom> rooms = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : sortedByClusterId(workClusters)) {
            if (work.allCells().isEmpty() || work.rooms().isEmpty()) {
                continue;
            }
            clusters.add(work.cluster());
            rooms.addAll(work.rooms());
        }
        SpatialTopology nextTopology = dungeonMap.topology().withRoomClusters(clusters);
        return new DungeonMap(
                dungeonMap.metadata(),
                nextTopology,
                new RoomCatalog(rooms),
                dungeonMap.corridors(),
                dungeonMap.stairs(),
                dungeonMap.transitionCatalog(),
                dungeonMap.revision() + 1L);
    }

    DungeonRoomCluster clusterWithBoundaries(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return new DungeonRoomCluster(
                work.cluster().clusterId(),
                work.cluster().mapId(),
                work.cluster().center(),
                work.cluster().relativeVerticesByLevel(),
                boundariesByLevel);
    }

    DungeonRoomCluster clusterForStretch(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return work.rebuiltClusterWithBoundaries(boundariesByLevel);
    }

    private static List<DungeonRoom> roomsFor(DungeonRoomTopologyClusterWork work) {
        Optional<Room> rebuilt = work.toCore().rebuiltRoom();
        if (rebuilt.isEmpty()) {
            return List.of();
        }
        Room room = rebuilt.get();
        return List.of(DungeonRoom.fromCore(room, narrationFor(work, room.roomId())));
    }

    private static DungeonRoomNarration narrationFor(DungeonRoomTopologyClusterWork work, long roomId) {
        for (DungeonRoom room : work.rooms()) {
            if (room != null && room.roomId() == roomId) {
                return room.narration();
            }
        }
        return DungeonRoomNarration.empty();
    }

    private static List<DungeonRoomTopologyClusterWork> sortedByClusterId(
            List<DungeonRoomTopologyClusterWork> workClusters
    ) {
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>(
                workClusters == null ? List.of() : workClusters);
        result.sort(DungeonRoomClusterRebuildLogic::compareClusterWork);
        return result;
    }

    private static int compareClusterWork(DungeonRoomTopologyClusterWork left, DungeonRoomTopologyClusterWork right) {
        return Long.compare(left.cluster().clusterId(), right.cluster().clusterId());
    }

}
