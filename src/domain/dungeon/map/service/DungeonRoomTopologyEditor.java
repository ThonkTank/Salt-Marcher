package src.domain.dungeon.map.service;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
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

    public DungeonMap editBoundaries(
            DungeonMap dungeonMap,
            long clusterId,
            List<DungeonEdge> edges,
            DungeonClusterBoundaryKind kind,
            boolean deleteBoundary
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (clusterId <= 0L || edges == null || edges.isEmpty()) {
            return dungeonMap;
        }
        DungeonRoomCellProjector cellProjector = new DungeonRoomCellProjector();
        List<ClusterWork> clusters = workClusters(dungeonMap, cellProjector);
        ClusterWork target = clusters.stream()
                .filter(work -> work.cluster().clusterId() == clusterId)
                .findFirst()
                .orElse(null);
        if (target == null) {
            return dungeonMap;
        }
        BoundaryEditResult edit = editBoundaries(target, cellProjector, edges, kind, deleteBoundary);
        if (!edit.changed()) {
            return dungeonMap;
        }
        IdAllocator ids = new IdAllocator(dungeonMap);
        List<DungeonRoom> rooms = roomsForBoundaryEdit(target, edit.boundariesByLevel(), ids);
        DungeonRoomCluster cluster = new DungeonRoomCluster(
                target.cluster().clusterId(),
                target.cluster().mapId(),
                target.cluster().center(),
                target.cluster().relativeVerticesByLevel(),
                edit.boundariesByLevel());
        List<ClusterWork> nextClusters = new ArrayList<>();
        for (ClusterWork work : clusters) {
            nextClusters.add(work.cluster().clusterId() == clusterId
                    ? new ClusterWork(cluster, rooms, target.cellsByLevel())
                    : work);
        }
        return rebuiltPreservingRooms(dungeonMap, nextClusters);
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

    private static DungeonMap rebuiltPreservingRooms(
            DungeonMap dungeonMap,
            List<ClusterWork> workClusters
    ) {
        List<DungeonRoomCluster> clusters = new ArrayList<>();
        List<DungeonRoom> rooms = new ArrayList<>();
        for (ClusterWork work : workClusters.stream()
                .sorted(Comparator.comparingLong(work -> work.cluster().clusterId()))
                .toList()) {
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

    private static BoundaryEditResult editBoundaries(
            ClusterWork target,
            DungeonRoomCellProjector cellProjector,
            List<DungeonEdge> edges,
            DungeonClusterBoundaryKind kind,
            boolean deleteBoundary
    ) {
        DungeonClusterBoundaryKind resolvedKind = kind == null ? DungeonClusterBoundaryKind.WALL : kind;
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = boundaryMap(target.cluster());
        Map<Long, List<DungeonCell>> roomCells = cellProjector.cellsByRoom(target.cluster(), target.rooms());
        boolean changed = false;
        for (DungeonEdge edge : edges) {
            DungeonClusterBoundary candidate = boundaryForEdge(target, edge, resolvedKind);
            if (candidate == null) {
                continue;
            }
            DungeonBoundaryKey key = DungeonBoundaryKey.from(candidate.absoluteEdge(target.cluster().center()));
            DungeonClusterBoundary existing = boundaries.get(key);
            if (deleteBoundary) {
                if (existing != null && existing.kind() == resolvedKind) {
                    boundaries.remove(key);
                    changed = true;
                }
                continue;
            }
            if (resolvedKind == DungeonClusterBoundaryKind.DOOR
                    && !editableDoorBoundary(existing, edge, roomCells)) {
                continue;
            }
            if (resolvedKind == DungeonClusterBoundaryKind.WALL
                    && existing != null
                    && existing.kind() == DungeonClusterBoundaryKind.DOOR) {
                continue;
            }
            if (existing != null && existing.kind() == resolvedKind) {
                continue;
            }
            boundaries.put(key, candidate);
            changed = true;
        }
        return new BoundaryEditResult(boundariesByLevel(boundaries.values()), changed);
    }

    private static Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap(DungeonRoomCluster cluster) {
        Map<DungeonBoundaryKey, DungeonClusterBoundary> result = new LinkedHashMap<>();
        for (List<DungeonClusterBoundary> boundaries : cluster.boundariesByLevel().values()) {
            for (DungeonClusterBoundary boundary : boundaries) {
                result.put(DungeonBoundaryKey.from(boundary.absoluteEdge(cluster.center())), boundary);
            }
        }
        return result;
    }

    private static @Nullable DungeonClusterBoundary boundaryForEdge(
            ClusterWork target,
            DungeonEdge edge,
            DungeonClusterBoundaryKind kind
    ) {
        if (edge == null || edge.from() == null || edge.to() == null) {
            return null;
        }
        List<DungeonCell> touchingCells = DungeonRoomCellProjector.sortedCells(edge.touchingCells());
        if (touchingCells.size() != 2 || touchingCells.getFirst().level() != touchingCells.get(1).level()) {
            return null;
        }
        List<DungeonCell> clusterCells = target.cellsAt(touchingCells.getFirst().level());
        if (!clusterCells.contains(touchingCells.getFirst()) || !clusterCells.contains(touchingCells.get(1))) {
            return null;
        }
        DungeonCell baseCell = touchingCells.getFirst();
        DungeonEdgeDirection direction = directionFrom(baseCell, edge);
        if (direction == null) {
            return null;
        }
        DungeonCell center = target.cluster().center();
        return new DungeonClusterBoundary(
                target.cluster().clusterId(),
                baseCell.level(),
                new DungeonCell(baseCell.q() - center.q(), baseCell.r() - center.r(), baseCell.level()),
                direction,
                kind);
    }

    private static @Nullable DungeonEdgeDirection directionFrom(DungeonCell cell, DungeonEdge edge) {
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
            if (DungeonBoundaryKey.from(DungeonEdge.sideOf(cell, direction)).equals(key)) {
                return direction;
            }
        }
        return null;
    }

    private static boolean editableDoorBoundary(
            @Nullable DungeonClusterBoundary existing,
            DungeonEdge edge,
            Map<Long, List<DungeonCell>> roomCells
    ) {
        return existing != null
                && existing.kind() != DungeonClusterBoundaryKind.DOOR
                && touchingRoomCount(edge, roomCells) >= 2;
    }

    private static long touchingRoomCount(DungeonEdge edge, Map<Long, List<DungeonCell>> cellsByRoom) {
        if (edge == null || cellsByRoom.isEmpty()) {
            return 0L;
        }
        Set<DungeonCell> touching = Set.copyOf(edge.touchingCells());
        return cellsByRoom.values().stream()
                .filter(roomCells -> roomCells.stream().anyMatch(touching::contains))
                .limit(2L)
                .count();
    }

    private static Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel(
            Iterable<DungeonClusterBoundary> boundaries
    ) {
        Map<Integer, List<DungeonClusterBoundary>> grouped = new LinkedHashMap<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            grouped.computeIfAbsent(boundary.level(), ignored -> new ArrayList<>()).add(boundary);
        }
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : grouped.entrySet()) {
            result.put(entry.getKey(), entry.getValue().stream()
                    .sorted(Comparator
                            .comparingInt((DungeonClusterBoundary boundary) -> boundary.relativeCell().r())
                            .thenComparingInt(boundary -> boundary.relativeCell().q())
                            .thenComparing(DungeonClusterBoundary::direction))
                    .toList());
        }
        return Map.copyOf(result);
    }

    private static List<DungeonRoom> roomsForBoundaryEdit(
            ClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            IdAllocator ids
    ) {
        List<RoomComponent> components = roomComponents(work, boundariesByLevel);
        Set<Long> usedRoomIds = new LinkedHashSet<>();
        List<DungeonRoom> rooms = new ArrayList<>();
        for (RoomComponent component : components) {
            DungeonRoom template = templateForComponent(work.rooms(), component, usedRoomIds);
            long roomId = template == null ? ids.nextRoomId() : template.roomId();
            usedRoomIds.add(roomId);
            rooms.add(new DungeonRoom(
                    roomId,
                    work.cluster().mapId(),
                    work.cluster().clusterId(),
                    template == null ? "Raum " + roomId : template.name(),
                    Map.of(component.level(), component.anchor()),
                    template == null ? DungeonRoomNarration.empty() : template.narration()));
        }
        return List.copyOf(rooms);
    }

    private static List<RoomComponent> roomComponents(
            ClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        List<RoomComponent> result = new ArrayList<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : work.cellsByLevel().entrySet()) {
            int level = entry.getKey();
            List<DungeonClusterBoundary> barriers = boundariesByLevel.getOrDefault(level, List.of());
            for (Set<DungeonCell> component : connectedComponents(entry.getValue(), barriers, work.cluster().center())) {
                List<DungeonCell> cells = DungeonRoomCellProjector.sortedCells(component);
                if (!cells.isEmpty()) {
                    result.add(new RoomComponent(level, cells));
                }
            }
        }
        return result.stream()
                .sorted(Comparator
                        .comparingInt(RoomComponent::level)
                        .thenComparingInt(component -> component.anchor().r())
                        .thenComparingInt(component -> component.anchor().q()))
                .toList();
    }

    private static List<Set<DungeonCell>> connectedComponents(
            List<DungeonCell> cells,
            List<DungeonClusterBoundary> barriers,
            DungeonCell center
    ) {
        Set<DungeonCell> remaining = new LinkedHashSet<>(cells == null ? List.<DungeonCell>of() : cells);
        List<Set<DungeonCell>> components = new ArrayList<>();
        while (!remaining.isEmpty()) {
            DungeonCell start = remaining.iterator().next();
            Set<DungeonCell> component = new LinkedHashSet<>();
            Set<DungeonCell> frontier = new LinkedHashSet<>(remaining);
            java.util.ArrayDeque<DungeonCell> queue = new java.util.ArrayDeque<>();
            queue.add(start);
            frontier.remove(start);
            remaining.remove(start);
            while (!queue.isEmpty()) {
                DungeonCell current = queue.removeFirst();
                component.add(current);
                for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
                    DungeonCell neighbor = direction.neighborOf(current);
                    if (!frontier.contains(neighbor) || isBlocked(barriers, center, current, neighbor)) {
                        continue;
                    }
                    frontier.remove(neighbor);
                    remaining.remove(neighbor);
                    queue.addLast(neighbor);
                }
            }
            components.add(Set.copyOf(component));
        }
        return List.copyOf(components);
    }

    private static boolean isBlocked(
            List<DungeonClusterBoundary> barriers,
            DungeonCell center,
            DungeonCell current,
            DungeonCell neighbor
    ) {
        DungeonEdge movementEdge = edgeBetweenAdjacentCells(current, neighbor);
        if (movementEdge == null) {
            return false;
        }
        DungeonBoundaryKey movement = DungeonBoundaryKey.from(movementEdge);
        for (DungeonClusterBoundary barrier : barriers == null ? List.<DungeonClusterBoundary>of() : barriers) {
            if (DungeonBoundaryKey.from(barrier.absoluteEdge(center)).equals(movement)) {
                return true;
            }
        }
        return false;
    }

    private static @Nullable DungeonEdge edgeBetweenAdjacentCells(DungeonCell current, DungeonCell neighbor) {
        if (current == null || neighbor == null || current.level() != neighbor.level()) {
            return null;
        }
        int deltaQ = neighbor.q() - current.q();
        int deltaR = neighbor.r() - current.r();
        for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
            if (direction.deltaQ() == deltaQ && direction.deltaR() == deltaR) {
                return DungeonEdge.sideOf(current, direction);
            }
        }
        return null;
    }

    private static @Nullable DungeonRoom templateForComponent(
            List<DungeonRoom> rooms,
            RoomComponent component,
            Set<Long> usedRoomIds
    ) {
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            DungeonCell anchor = room.floorAnchors().get(component.level());
            if (anchor != null && component.cells().contains(anchor) && !usedRoomIds.contains(room.roomId())) {
                return room;
            }
        }
        return null;
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

    private record BoundaryEditResult(
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            boolean changed
    ) {
        private BoundaryEditResult {
            boundariesByLevel = boundariesByLevel == null ? Map.of() : Map.copyOf(boundariesByLevel);
        }
    }

    private record RoomComponent(
            int level,
            List<DungeonCell> cells
    ) {
        private RoomComponent {
            cells = cells == null ? List.of() : List.copyOf(cells);
        }

        DungeonCell anchor() {
            return cells.isEmpty() ? new DungeonCell(0, 0, level) : cells.getFirst();
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
