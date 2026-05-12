package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonRoomClusterRebuildLogic {

    private static final DungeonRoomCellProjection CELL_PROJECTOR = new DungeonRoomCellProjection();

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
            clusters.add(clusterFor(work));
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
        return new DungeonRoomCluster(
                work.cluster().clusterId(),
                work.cluster().mapId(),
                work.cluster().center(),
                verticesByLevel(work),
                boundariesByLevel);
    }

    private DungeonRoomCluster clusterFor(DungeonRoomTopologyClusterWork work) {
        return new DungeonRoomCluster(
                work.cluster().clusterId(),
                work.cluster().mapId(),
                work.cluster().center(),
                verticesByLevel(work),
                preservedBoundaries(work.cluster(), work.cellsByLevel()));
    }

    private List<DungeonRoom> roomsFor(DungeonRoomTopologyClusterWork work) {
        DungeonRoom template = work.rooms().isEmpty() ? null : work.rooms().getFirst();
        List<DungeonCell> sortedCells = DungeonCellOrdering.sortedCells(work.allCells());
        DungeonCell anchor = sortedCells.isEmpty() ? null : sortedCells.getFirst();
        if (anchor == null) {
            return List.of();
        }
        long roomId = template == null ? nextRoomId(work.cluster(), work.rooms()) : template.roomId();
        return List.of(new DungeonRoom(
                roomId,
                work.cluster().mapId(),
                work.cluster().clusterId(),
                template == null ? "Raum " + roomId : template.name(),
                DungeonRoomCellProjection.anchorsByLevel(work.cellsByLevel()),
                template == null ? DungeonRoomNarration.empty() : template.narration()));
    }

    private Map<Integer, List<DungeonClusterBoundary>> preservedBoundaries(
            DungeonRoomCluster cluster,
            Map<Integer, List<DungeonCell>> cellsByLevel
    ) {
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : cluster.boundariesByLevel().entrySet()) {
            Set<DungeonCell> cells = new LinkedHashSet<>(cellsByLevel.getOrDefault(entry.getKey(), List.of()));
            List<DungeonClusterBoundary> preserved = new ArrayList<>();
            for (DungeonClusterBoundary boundary : entry.getValue()) {
                if (boundary != null && cells.contains(boundary.absoluteCell(cluster.center()))) {
                    preserved.add(boundary);
                }
            }
            if (!preserved.isEmpty()) {
                result.put(entry.getKey(), preserved);
            }
        }
        return Map.copyOf(result);
    }

    private long nextRoomId(DungeonRoomCluster cluster, List<DungeonRoom> rooms) {
        long result = 0L;
        boolean found = false;
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            if (room != null && (!found || room.roomId() < result)) {
                result = room.roomId();
                found = true;
            }
        }
        return found ? result : Math.max(1L, cluster.clusterId());
    }

    private static List<DungeonRoomTopologyClusterWork> sortedByClusterId(
            List<DungeonRoomTopologyClusterWork> workClusters
    ) {
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>(
                workClusters == null ? List.of() : workClusters);
        result.sort(new ClusterWorkComparator());
        return result;
    }

    private static final class ClusterWorkComparator implements java.util.Comparator<DungeonRoomTopologyClusterWork> {
        @Override
        public int compare(DungeonRoomTopologyClusterWork left, DungeonRoomTopologyClusterWork right) {
            return Long.compare(left.cluster().clusterId(), right.cluster().clusterId());
        }
    }

    private Map<Integer, List<DungeonCell>> verticesByLevel(DungeonRoomTopologyClusterWork work) {
        Map<Integer, List<DungeonCell>> verticesByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : work.cellsByLevel().entrySet()) {
            if (!entry.getValue().isEmpty()) {
                verticesByLevel.put(
                        entry.getKey(),
                        CELL_PROJECTOR.relativeCellLoops(work.cluster().center(), entry.getValue()));
            }
        }
        return Map.copyOf(verticesByLevel);
    }
}
