package src.domain.dungeon.map.service;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonRoomNarration;
import src.domain.dungeon.map.value.RoomCatalog;
import src.domain.dungeon.map.value.SpatialTopology;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonRoomTopologyEditor {

    public DungeonMap paintRectangle(DungeonMap dungeonMap, DungeonCell start, DungeonCell end) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        DungeonRoomCellProjector cellProjector = new DungeonRoomCellProjector();
        Set<DungeonCell> paintedCells = rectangle(start, end);
        if (paintedCells.isEmpty()) {
            return dungeonMap;
        }
        List<ClusterWork> clusters = workClusters(dungeonMap, cellProjector);
        List<ClusterWork> affected = affectedClusters(clusters, paintedCells);
        long mapId = dungeonMap.metadata().mapId().value();
        IdAllocator ids = new IdAllocator(dungeonMap);
        if (affected.isEmpty()) {
            clusters.add(new ClusterWork(
                    newCluster(ids.nextClusterId(), mapId, paintedCells),
                    List.of(newRoom(ids.nextRoomId(), mapId, ids.currentClusterId(), paintedCells, null)),
                    cellsByLevel(paintedCells)));
            return rebuilt(dungeonMap, clusters, cellProjector);
        }

        ClusterWork target = affected.stream()
                .min(Comparator.comparingLong(work -> work.cluster().clusterId()))
                .orElseThrow();
        Set<DungeonCell> targetLevelCells = new LinkedHashSet<>(target.cellsAt(start.level()));
        targetLevelCells.addAll(paintedCells);
        for (ClusterWork work : affected) {
            targetLevelCells.addAll(work.cellsAt(start.level()));
        }
        List<ClusterWork> nextClusters = new ArrayList<>();
        for (ClusterWork work : clusters) {
            if (!affected.contains(work)) {
                nextClusters.add(work);
            }
        }
        Map<Integer, List<DungeonCell>> nextCells = new LinkedHashMap<>(target.cellsByLevel());
        nextCells.put(start.level(), DungeonRoomCellProjector.sortedCells(targetLevelCells));
        nextClusters.add(target.withCellsByLevel(nextCells));
        return rebuilt(dungeonMap, nextClusters, cellProjector);
    }

    public DungeonMap deleteRectangle(DungeonMap dungeonMap, DungeonCell start, DungeonCell end) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        DungeonRoomCellProjector cellProjector = new DungeonRoomCellProjector();
        Set<DungeonCell> deletedCells = rectangle(start, end);
        if (deletedCells.isEmpty()) {
            return dungeonMap;
        }
        List<ClusterWork> clusters = workClusters(dungeonMap, cellProjector);
        IdAllocator ids = new IdAllocator(dungeonMap);
        List<ClusterWork> nextClusters = new ArrayList<>();
        for (ClusterWork work : clusters) {
            if (!intersects(work.cellsAt(start.level()), deletedCells)) {
                nextClusters.add(work);
                continue;
            }
            Set<DungeonCell> remainingAtLevel = new LinkedHashSet<>(work.cellsAt(start.level()));
            remainingAtLevel.removeAll(deletedCells);
            List<Set<DungeonCell>> components = cellProjector.connectedComponents(remainingAtLevel);
            Map<Integer, List<DungeonCell>> otherLevels = new LinkedHashMap<>(work.cellsByLevel());
            otherLevels.remove(start.level());
            if (components.isEmpty() && otherLevels.values().stream().allMatch(List::isEmpty)) {
                continue;
            }
            if (components.isEmpty()) {
                nextClusters.add(work.withCellsByLevel(otherLevels));
                continue;
            }
            boolean first = true;
            for (Set<DungeonCell> component : components) {
                Map<Integer, List<DungeonCell>> componentCells = new LinkedHashMap<>();
                if (first) {
                    componentCells.putAll(otherLevels);
                    componentCells.put(start.level(), DungeonRoomCellProjector.sortedCells(component));
                    nextClusters.add(work.withCellsByLevel(componentCells));
                    first = false;
                } else {
                    componentCells.put(start.level(), DungeonRoomCellProjector.sortedCells(component));
                    long clusterId = ids.nextClusterId();
                    long roomId = ids.nextRoomId();
                    nextClusters.add(new ClusterWork(
                            newCluster(clusterId, work.cluster().mapId(), component),
                            List.of(newRoom(roomId, work.cluster().mapId(), clusterId, component, null)),
                            componentCells));
                }
            }
        }
        return rebuilt(dungeonMap, nextClusters, cellProjector);
    }

    private static List<ClusterWork> workClusters(DungeonMap dungeonMap, DungeonRoomCellProjector cellProjector) {
        Map<Long, List<DungeonRoom>> roomsByCluster = roomsByCluster(dungeonMap.rooms().rooms());
        List<ClusterWork> result = new ArrayList<>();
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            List<DungeonRoom> rooms = roomsByCluster.getOrDefault(cluster.clusterId(), List.of());
            result.add(new ClusterWork(
                    cluster,
                    rooms,
                    cellProjector.cellsByLevel(cluster, rooms)));
        }
        return result;
    }

    private static List<ClusterWork> affectedClusters(List<ClusterWork> clusters, Set<DungeonCell> cells) {
        return clusters.stream()
                .filter(work -> intersects(work.cellsAt(cells.iterator().next().level()), cells))
                .toList();
    }

    private static DungeonMap rebuilt(
            DungeonMap dungeonMap,
            List<ClusterWork> workClusters,
            DungeonRoomCellProjector cellProjector
    ) {
        List<DungeonRoomCluster> clusters = new ArrayList<>();
        List<DungeonRoom> rooms = new ArrayList<>();
        for (ClusterWork work : workClusters.stream()
                .sorted(Comparator.comparingLong(work -> work.cluster().clusterId()))
                .toList()) {
            if (work.allCells().isEmpty()) {
                continue;
            }
            List<DungeonRoom> rebuiltRooms = roomsFor(work);
            if (rebuiltRooms.isEmpty()) {
                continue;
            }
            clusters.add(clusterFor(work, cellProjector));
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

    private static DungeonRoomCluster clusterFor(ClusterWork work, DungeonRoomCellProjector cellProjector) {
        Map<Integer, List<DungeonCell>> verticesByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : work.cellsByLevel().entrySet()) {
            if (!entry.getValue().isEmpty()) {
                verticesByLevel.put(
                        entry.getKey(),
                        cellProjector.relativeCellLoops(work.cluster().center(), entry.getValue()));
            }
        }
        return new DungeonRoomCluster(
                work.cluster().clusterId(),
                work.cluster().mapId(),
                work.cluster().center(),
                verticesByLevel,
                preservedBoundaries(work.cluster(), work.cellsByLevel()));
    }

    private static List<DungeonRoom> roomsFor(ClusterWork work) {
        DungeonRoom template = work.rooms().isEmpty() ? null : work.rooms().getFirst();
        DungeonCell anchor = DungeonRoomCellProjector.sortedCells(work.allCells()).stream().findFirst().orElse(null);
        if (anchor == null) {
            return List.of();
        }
        long roomId = template == null ? nextRoomId(work.cluster(), work.rooms()) : template.roomId();
        return List.of(new DungeonRoom(
                roomId,
                work.cluster().mapId(),
                work.cluster().clusterId(),
                template == null ? "Raum " + roomId : template.name(),
                anchorsByLevel(work.cellsByLevel()),
                template == null ? DungeonRoomNarration.empty() : template.narration()));
    }

    private static Map<Integer, DungeonCell> anchorsByLevel(Map<Integer, List<DungeonCell>> cellsByLevel) {
        Map<Integer, DungeonCell> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : cellsByLevel.entrySet()) {
            if (!entry.getValue().isEmpty()) {
                result.put(entry.getKey(), DungeonRoomCellProjector.sortedCells(entry.getValue()).getFirst());
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Integer, List<DungeonClusterBoundary>> preservedBoundaries(
            DungeonRoomCluster cluster,
            Map<Integer, List<DungeonCell>> cellsByLevel
    ) {
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : cluster.boundariesByLevel().entrySet()) {
            Set<DungeonCell> cells = new LinkedHashSet<>(cellsByLevel.getOrDefault(entry.getKey(), List.of()));
            List<DungeonClusterBoundary> preserved = entry.getValue().stream()
                    .filter(boundary -> cells.contains(boundary.absoluteCell(cluster.center())))
                    .toList();
            if (!preserved.isEmpty()) {
                result.put(entry.getKey(), preserved);
            }
        }
        return Map.copyOf(result);
    }

    private static DungeonRoomCluster newCluster(long clusterId, long mapId, Set<DungeonCell> cells) {
        DungeonCell center = DungeonRoomCellProjector.sortedCells(cells).getFirst();
        return new DungeonRoomCluster(clusterId, mapId, center, Map.of(), Map.of());
    }

    private static DungeonRoom newRoom(
            long roomId,
            long mapId,
            long clusterId,
            Set<DungeonCell> cells,
            @Nullable DungeonRoom template
    ) {
        return new DungeonRoom(
                roomId,
                mapId,
                clusterId,
                template == null ? "Raum " + roomId : template.name(),
                anchorsByLevel(cellsByLevel(cells)),
                template == null ? DungeonRoomNarration.empty() : template.narration());
    }

    private static long nextRoomId(DungeonRoomCluster cluster, List<DungeonRoom> rooms) {
        return rooms.stream()
                .mapToLong(DungeonRoom::roomId)
                .min()
                .orElse(Math.max(1L, cluster.clusterId()));
    }

    private static Map<Long, List<DungeonRoom>> roomsByCluster(List<DungeonRoom> rooms) {
        Map<Long, List<DungeonRoom>> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            result.computeIfAbsent(room.clusterId(), ignored -> new ArrayList<>()).add(room);
        }
        return Map.copyOf(result);
    }

    private static boolean intersects(List<DungeonCell> left, Set<DungeonCell> right) {
        for (DungeonCell cell : left == null ? List.<DungeonCell>of() : left) {
            if (right.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    private static Set<DungeonCell> rectangle(DungeonCell start, DungeonCell end) {
        if (start == null || end == null) {
            return Set.of();
        }
        int level = start.level();
        int minQ = Math.min(start.q(), end.q());
        int maxQ = Math.max(start.q(), end.q());
        int minR = Math.min(start.r(), end.r());
        int maxR = Math.max(start.r(), end.r());
        Set<DungeonCell> cells = new LinkedHashSet<>();
        for (int q = minQ; q <= maxQ; q++) {
            for (int r = minR; r <= maxR; r++) {
                cells.add(new DungeonCell(q, r, level));
            }
        }
        return Set.copyOf(cells);
    }

    private static Map<Integer, List<DungeonCell>> cellsByLevel(Iterable<DungeonCell> cells) {
        Map<Integer, List<DungeonCell>> grouped = new LinkedHashMap<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            grouped.computeIfAbsent(cell.level(), ignored -> new ArrayList<>()).add(cell);
        }
        Map<Integer, List<DungeonCell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : grouped.entrySet()) {
            result.put(entry.getKey(), DungeonRoomCellProjector.sortedCells(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private record ClusterWork(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms,
            Map<Integer, List<DungeonCell>> cellsByLevel
    ) {

        private ClusterWork {
            rooms = rooms == null ? List.of() : List.copyOf(rooms);
            cellsByLevel = cellsByLevel == null ? Map.of() : Map.copyOf(cellsByLevel);
        }

        List<DungeonCell> cellsAt(int level) {
            return cellsByLevel.getOrDefault(level, List.of());
        }

        List<DungeonCell> allCells() {
            List<DungeonCell> result = new ArrayList<>();
            for (List<DungeonCell> cells : cellsByLevel.values()) {
                result.addAll(cells);
            }
            return DungeonRoomCellProjector.sortedCells(result);
        }

        ClusterWork withCellsByLevel(Map<Integer, List<DungeonCell>> nextCellsByLevel) {
            return new ClusterWork(cluster, rooms, nextCellsByLevel);
        }
    }

    private static final class IdAllocator {

        private long nextClusterId;
        private long nextRoomId;
        private long currentClusterId;

        IdAllocator(DungeonMap dungeonMap) {
            this.nextClusterId = dungeonMap.topology().roomClusters().stream()
                    .mapToLong(DungeonRoomCluster::clusterId)
                    .max()
                    .orElse(0L) + 1L;
            this.nextRoomId = dungeonMap.rooms().rooms().stream()
                    .mapToLong(DungeonRoom::roomId)
                    .max()
                    .orElse(0L) + 1L;
        }

        long nextClusterId() {
            currentClusterId = nextClusterId++;
            return currentClusterId;
        }

        long currentClusterId() {
            return currentClusterId;
        }

        long nextRoomId() {
            return nextRoomId++;
        }
    }
}
