package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

final class DungeonRoomClusterRebuildLogic {

    private final DungeonRoomClusterTopologyRebuildLogic topologyLogic =
            new DungeonRoomClusterTopologyRebuildLogic();
    private final DungeonRoomClusterRoomRebuildLogic roomLogic = new DungeonRoomClusterRoomRebuildLogic();

    DungeonMap rebuilt(DungeonMap dungeonMap, List<DungeonRoomTopologyClusterWork> workClusters) {
        List<DungeonRoomCluster> clusters = new ArrayList<>();
        List<DungeonRoom> rooms = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : sortedByClusterId(workClusters)) {
            if (work.allCells().isEmpty()) {
                continue;
            }
            List<DungeonRoom> rebuiltRooms = roomLogic.roomsFor(work);
            if (rebuiltRooms.isEmpty()) {
                continue;
            }
            clusters.add(topologyLogic.clusterFor(work));
            rooms.addAll(rebuiltRooms);
        }
        SpatialTopology nextTopology = dungeonMap.topology().withRoomClusters(clusters);
        return new DungeonMap(
                dungeonMap.metadata(),
                nextTopology,
                dungeonMap.spaces(),
                new RoomCatalog(rooms),
                dungeonMap.connections(),
                dungeonMap.features(),
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
                dungeonMap.spaces(),
                new RoomCatalog(rooms),
                dungeonMap.connections(),
                dungeonMap.features(),
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
        return topologyLogic.clusterForStretch(work, boundariesByLevel);
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
