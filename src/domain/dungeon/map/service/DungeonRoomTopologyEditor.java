package src.domain.dungeon.map.service;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonCorridorDoorBinding;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonRoomNarration;
import src.domain.dungeon.map.value.DungeonTopologyRef;
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
        BoundaryEditResult edit = editBoundaries(dungeonMap, target, cellProjector, edges, kind, deleteBoundary);
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

    public DungeonMap moveBoundaryStretch(
            DungeonMap dungeonMap,
            long clusterId,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (clusterId <= 0L || sourceEdges == null || sourceEdges.isEmpty()) {
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
        StretchSelection stretch = resolveStretch(target, sourceEdges, deltaQ, deltaR, deltaLevel);
        if (stretch == null || stretch.movement() == 0) {
            return dungeonMap;
        }
        return stretch.outer()
                ? moveOuterStretch(dungeonMap, clusters, target, stretch, cellProjector)
                : moveInnerStretch(dungeonMap, clusters, target, stretch);
    }

    private static @Nullable StretchSelection resolveStretch(
            ClusterWork target,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (deltaLevel != 0) {
            return null;
        }
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = boundaryMap(target.cluster());
        StretchSeed seed = stretchSeed(target, boundaries, sourceEdges);
        if (seed == null) {
            return null;
        }
        List<StretchEdge> sortedEdges = sortedStretchEdges(seed, sourceEdges, boundaries);
        if (sortedEdges == null) {
            return null;
        }
        int movement = movementAlongNormal(seed.orientation(), deltaQ, deltaR);
        if (movement == 0) {
            return null;
        }
        int startVariable = variableCoordinate(seed.orientation(), sortedEdges.getFirst().edge());
        return new StretchSelection(
                target.cluster().clusterId(),
                seed.level(),
                seed.orientation(),
                seed.outer(),
                seed.fixedCoordinate(),
                startVariable,
                startVariable + sortedEdges.size(),
                movement,
                seed.side(),
                sortedEdges,
                sortedEdges.stream().map(StretchEdge::key).collect(java.util.stream.Collectors.toSet()));
    }

    private static DungeonMap moveInnerStretch(
            DungeonMap dungeonMap,
            List<ClusterWork> clusters,
            ClusterWork target,
            StretchSelection stretch
    ) {
        Set<DungeonCell> levelCells = new LinkedHashSet<>(target.cellsAt(stretch.level()));
        if (!validInnerStretchSource(dungeonMap, target, stretch, levelCells)) {
            return dungeonMap;
        }
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = new LinkedHashMap<>(boundaryMap(target.cluster()));
        if (!innerStretchCanMove(boundaries, stretch)
                || !applyStretchConnectors(dungeonMap, target, stretch, levelCells, boundaries, true)
                || !replaceStretchEdges(target, stretch, levelCells, boundaries)) {
            return dungeonMap;
        }
        Map<Integer, List<DungeonClusterBoundary>> nextBoundaries = boundariesByLevel(boundaries.values());
        IdAllocator ids = new IdAllocator(dungeonMap);
        List<DungeonRoom> rooms = roomsForBoundaryEdit(target, nextBoundaries, ids);
        DungeonRoomCluster cluster = new DungeonRoomCluster(
                target.cluster().clusterId(),
                target.cluster().mapId(),
                target.cluster().center(),
                target.cluster().relativeVerticesByLevel(),
                nextBoundaries);
        List<ClusterWork> nextClusters = new ArrayList<>();
        for (ClusterWork work : clusters) {
            nextClusters.add(work.cluster().clusterId() == target.cluster().clusterId()
                    ? new ClusterWork(cluster, rooms, target.cellsByLevel())
                    : work);
        }
        return rebuiltPreservingRooms(dungeonMap, nextClusters);
    }

    private static DungeonMap moveOuterStretch(
            DungeonMap dungeonMap,
            List<ClusterWork> clusters,
            ClusterWork target,
            StretchSelection stretch,
            DungeonRoomCellProjector cellProjector
    ) {
        Map<Integer, List<DungeonCell>> nextCellsByLevel = new LinkedHashMap<>(target.cellsByLevel());
        Set<DungeonCell> currentLevelCells = new LinkedHashSet<>(target.cellsAt(stretch.level()));
        Set<DungeonCell> stripCells = stripCells(stretch);
        if (stripCells.isEmpty()) {
            return dungeonMap;
        }
        if (stretch.movesOutward()) {
            currentLevelCells.addAll(stripCells);
        } else {
            currentLevelCells.removeAll(stripCells);
        }
        if (currentLevelCells.isEmpty()) {
            return dungeonMap;
        }
        nextCellsByLevel.put(stretch.level(), DungeonRoomCellProjector.sortedCells(currentLevelCells));
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = new LinkedHashMap<>(boundaryMap(target.cluster()));
        for (BoundaryVertex vertex : stretch.vertices()) {
            if (!hasPerpendicularBoundary(boundaries, stretch.sourceKeys(), vertex, stretch.orientation())) {
                continue;
            }
            if (!applyConnectorPath(dungeonMap, target, stretch, currentLevelCells, boundaries, vertex)) {
                return dungeonMap;
            }
        }
        Map<Integer, List<DungeonClusterBoundary>> nextBoundaries =
                filterBoundaries(boundaries.values(), nextCellsByLevel, target.cluster().center());
        IdAllocator ids = new IdAllocator(dungeonMap);
        ClusterWork nextWork = new ClusterWork(target.cluster(), target.rooms(), nextCellsByLevel);
        List<DungeonRoom> rooms = roomsForBoundaryEdit(nextWork, nextBoundaries, ids);
        DungeonRoomCluster cluster = clusterForStretch(nextWork, cellProjector, nextBoundaries);
        List<ClusterWork> nextClusters = new ArrayList<>();
        for (ClusterWork work : clusters) {
            nextClusters.add(work.cluster().clusterId() == target.cluster().clusterId()
                    ? new ClusterWork(cluster, rooms, nextCellsByLevel)
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
            DungeonMap dungeonMap,
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
                    if (resolvedKind == DungeonClusterBoundaryKind.DOOR
                            && touchesCorridorBinding(
                            dungeonMap,
                            target.cluster().center(),
                            target.cluster().clusterId(),
                            existing.level(),
                            Set.of(key))) {
                        continue;
                    }
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
        List<DungeonCell> insideCells = touchingCells.stream()
                .filter(clusterCells::contains)
                .toList();
        if (insideCells.isEmpty()
                || (kind != DungeonClusterBoundaryKind.DOOR && insideCells.size() != 2)
                || (kind == DungeonClusterBoundaryKind.DOOR && insideCells.size() > 2)) {
            return null;
        }
        DungeonCell baseCell = insideCells.getFirst();
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
        long touchingRoomCount = touchingRoomCount(edge, roomCells);
        if (touchingRoomCount >= 2) {
            return existing != null && existing.kind() != DungeonClusterBoundaryKind.DOOR;
        }
        return touchingRoomCount == 1 && (existing == null || existing.kind() != DungeonClusterBoundaryKind.DOOR);
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
        return new DungeonRoomCluster(
                work.cluster().clusterId(),
                work.cluster().mapId(),
                work.cluster().center(),
                verticesByLevel(work, cellProjector),
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

    private static @Nullable StretchSeed stretchSeed(
            ClusterWork target,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            List<DungeonEdge> sourceEdges
    ) {
        DungeonEdge firstEdge = sourceEdges == null || sourceEdges.isEmpty() ? null : sourceEdges.getFirst();
        if (firstEdge == null || firstEdge.from() == null || firstEdge.to() == null) {
            return null;
        }
        Orientation orientation = Orientation.from(firstEdge);
        if (orientation == null) {
            return null;
        }
        int level = firstEdge.from().level();
        Set<DungeonCell> clusterCells = new LinkedHashSet<>(target.cellsAt(level));
        if (clusterCells.isEmpty()) {
            return null;
        }
        return stretchSeed(boundaries, firstEdge, clusterCells);
    }

    private static @Nullable StretchSeed stretchSeed(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            DungeonEdge edge,
            Set<DungeonCell> clusterCells
    ) {
        Orientation orientation = Orientation.from(edge);
        if (orientation == null) {
            return null;
        }
        int fixedCoordinate = fixedCoordinate(orientation, edge);
        BoundaryTouch touch = touch(edge, clusterCells);
        if (!touch.valid()) {
            return null;
        }
        BoundarySide side = BoundarySide.resolve(orientation, touch, fixedCoordinate);
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        DungeonClusterBoundary existing = boundaries.get(key);
        boolean outer = touch.insideCount() == 1;
        if ((outer && existing != null) || (!outer && existing == null)) {
            return null;
        }
        return new StretchSeed(
                edge.from().level(),
                orientation,
                fixedCoordinate,
                outer,
                side,
                Set.copyOf(clusterCells));
    }

    private static @Nullable StretchEdge matchingStretchEdge(
            StretchSeed seed,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            DungeonEdge edge
    ) {
        if (edge == null || edge.from() == null || edge.to() == null || edge.from().level() != seed.level()) {
            return null;
        }
        Orientation orientation = Orientation.from(edge);
        if (orientation != seed.orientation() || fixedCoordinate(orientation, edge) != seed.fixedCoordinate()) {
            return null;
        }
        BoundaryTouch touch = touch(edge, seed.clusterCells());
        if (!touch.valid()
                || seed.outer() != (touch.insideCount() == 1)
                || seed.side() != BoundarySide.resolve(orientation, touch, seed.fixedCoordinate())) {
            return null;
        }
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        DungeonClusterBoundary existing = boundaries.get(key);
        if ((seed.outer() && existing != null) || (!seed.outer() && existing == null)) {
            return null;
        }
        return new StretchEdge(edge, key, existing);
    }

    private static @Nullable List<StretchEdge> sortedStretchEdges(
            StretchSeed seed,
            List<DungeonEdge> sourceEdges,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        List<StretchEdge> stretchEdges = new ArrayList<>();
        for (DungeonEdge edge : sourceEdges) {
            StretchEdge stretchEdge = matchingStretchEdge(seed, boundaries, edge);
            if (stretchEdge == null) {
                return null;
            }
            stretchEdges.add(stretchEdge);
        }
        List<StretchEdge> sortedEdges = stretchEdges.stream()
                .sorted(Comparator.comparingInt(edge -> variableCoordinate(seed.orientation(), edge.edge())))
                .toList();
        int startVariable = variableCoordinate(seed.orientation(), sortedEdges.getFirst().edge());
        for (int index = 0; index < sortedEdges.size(); index++) {
            if (variableCoordinate(seed.orientation(), sortedEdges.get(index).edge()) != startVariable + index) {
                return null;
            }
        }
        return sortedEdges;
    }

    private static boolean validInnerStretchSource(
            DungeonMap dungeonMap,
            ClusterWork target,
            StretchSelection stretch,
            Set<DungeonCell> levelCells
    ) {
        return sourceStaysInternal(stretch, levelCells)
                && !touchesCorridorBinding(
                        dungeonMap,
                        target.cluster().center(),
                        target.cluster().clusterId(),
                        stretch.level(),
                        stretch.sourceKeys());
    }

    private static boolean innerStretchCanMove(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            StretchSelection stretch
    ) {
        List<BoundaryVertex> vertices = stretch.vertices();
        for (int index = 1; index < vertices.size() - 1; index++) {
            if (hasPerpendicularBoundary(boundaries, stretch.sourceKeys(), vertices.get(index), stretch.orientation())) {
                return false;
            }
        }
        return true;
    }

    private static boolean applyStretchConnectors(
            DungeonMap dungeonMap,
            ClusterWork target,
            StretchSelection stretch,
            Set<DungeonCell> clusterCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            boolean requireTouch
    ) {
        for (BoundaryVertex endpoint : List.of(stretch.vertices().getFirst(), stretch.vertices().getLast())) {
            boolean touchesOuter = touchesOuterBoundary(clusterCells, endpoint);
            boolean hasAttachment = hasPerpendicularBoundary(boundaries, stretch.sourceKeys(), endpoint, stretch.orientation());
            if (requireTouch && !touchesOuter && !hasAttachment) {
                continue;
            }
            if (!applyConnectorPath(dungeonMap, target, stretch, clusterCells, boundaries, endpoint)) {
                return false;
            }
        }
        return true;
    }

    private static boolean applyConnectorPath(
            DungeonMap dungeonMap,
            ClusterWork target,
            StretchSelection stretch,
            Set<DungeonCell> clusterCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            BoundaryVertex endpoint
    ) {
        List<DungeonEdge> connectorPath = stretch.connectorPath(endpoint);
        if (connectorPath.isEmpty()) {
            return true;
        }
        if (touchesCorridorBinding(
                dungeonMap,
                target.cluster().center(),
                target.cluster().clusterId(),
                stretch.level(),
                connectorPath)) {
            return false;
        }
        ConnectorAction connectorAction = connectorAction(boundaries, stretch.sourceKeys(), connectorPath);
        if (connectorAction == null) {
            return false;
        }
        applyConnectorAction(boundaries, connectorAction, target.cluster().center(), clusterCells, target.cluster().clusterId());
        return true;
    }

    private static boolean replaceStretchEdges(
            ClusterWork target,
            StretchSelection stretch,
            Set<DungeonCell> levelCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        for (StretchEdge edge : stretch.edges()) {
            boundaries.remove(edge.key());
        }
        for (StretchEdge edge : stretch.edges()) {
            DungeonEdge movedEdge = moveEdge(edge.edge(), stretch.orientation(), stretch.movement());
            DungeonBoundaryKey movedKey = DungeonBoundaryKey.from(movedEdge);
            if (boundaries.containsKey(movedKey)) {
                return false;
            }
            DungeonClusterBoundary moved = boundaryForEdge(
                    levelCells,
                    target.cluster().center(),
                    target.cluster().clusterId(),
                    movedEdge,
                    edge.kind(),
                    preserveTopologyRef(edge, target.cluster().center()));
            if (moved == null) {
                return false;
            }
            boundaries.put(movedKey, moved);
        }
        return true;
    }

    private static @Nullable ConnectorAction connectorAction(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            Set<DungeonBoundaryKey> sourceKeys,
            List<DungeonEdge> path
    ) {
        if (path.isEmpty()) {
            return null;
        }
        List<DungeonBoundaryKey> keys = path.stream().map(DungeonBoundaryKey::from).toList();
        long presentCount = keys.stream()
                .filter(key -> !sourceKeys.contains(key) && boundaries.containsKey(key))
                .count();
        if (presentCount == 0L) {
            return new ConnectorAction(ConnectorMode.ADD, path);
        }
        if (presentCount == keys.size()) {
            for (DungeonBoundaryKey key : keys) {
                DungeonClusterBoundary boundary = boundaries.get(key);
                if (boundary == null || sourceKeys.contains(key) || boundary.kind() == DungeonClusterBoundaryKind.DOOR) {
                    return null;
                }
            }
            return new ConnectorAction(ConnectorMode.REMOVE, path);
        }
        return null;
    }

    private static void applyConnectorAction(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            ConnectorAction action,
            DungeonCell center,
            Set<DungeonCell> clusterCells,
            long clusterId
    ) {
        if (action.mode() == ConnectorMode.REMOVE) {
            for (DungeonEdge edge : action.path()) {
                boundaries.remove(DungeonBoundaryKey.from(edge));
            }
            return;
        }
        for (DungeonEdge edge : action.path()) {
            DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
            if (boundaries.containsKey(key)) {
                continue;
            }
            DungeonClusterBoundary connector = boundaryForEdge(
                    clusterCells,
                    center,
                    clusterId,
                    edge,
                    DungeonClusterBoundaryKind.WALL,
                    null);
            if (connector != null) {
                boundaries.put(key, connector);
            }
        }
    }

    private static boolean sourceStaysInternal(StretchSelection stretch, Set<DungeonCell> clusterCells) {
        for (StretchEdge edge : stretch.edges()) {
            BoundaryTouch movedTouch = touch(moveEdge(edge.edge(), stretch.orientation(), stretch.movement()), clusterCells);
            if (!movedTouch.valid() || movedTouch.insideCount() != 2) {
                return false;
            }
        }
        return true;
    }

    private static boolean hasPerpendicularBoundary(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            Set<DungeonBoundaryKey> sourceKeys,
            BoundaryVertex vertex,
            Orientation sourceOrientation
    ) {
        for (Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary> entry : boundaries.entrySet()) {
            if (sourceKeys.contains(entry.getKey())) {
                continue;
            }
            if (sourceOrientation.perpendicularTo(Orientation.from(entry.getKey()))
                    && touches(entry.getKey(), vertex)) {
                return true;
            }
        }
        return false;
    }

    private static boolean touches(DungeonBoundaryKey key, BoundaryVertex vertex) {
        return sameVertex(key.lower(), vertex) || sameVertex(key.upper(), vertex);
    }

    private static boolean sameVertex(DungeonCell cell, BoundaryVertex vertex) {
        return cell != null
                && vertex != null
                && cell.q() == vertex.q()
                && cell.r() == vertex.r()
                && cell.level() == vertex.level();
    }

    private static boolean touchesOuterBoundary(Set<DungeonCell> clusterCells, BoundaryVertex vertex) {
        for (DungeonCell cell : clusterCells) {
            for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
                DungeonCell neighbor = direction.neighborOf(cell);
                if (clusterCells.contains(neighbor)) {
                    continue;
                }
                if (touches(DungeonBoundaryKey.from(DungeonEdge.sideOf(cell, direction)), vertex)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static Set<DungeonCell> stripCells(StretchSelection stretch) {
        Set<DungeonCell> result = new LinkedHashSet<>();
        if (stretch.orientation() == Orientation.VERTICAL) {
            int minQ = Math.min(stretch.fixedCoordinate(), stretch.fixedCoordinate() + stretch.movement());
            int maxQ = Math.max(stretch.fixedCoordinate(), stretch.fixedCoordinate() + stretch.movement());
            for (int q = minQ; q < maxQ; q++) {
                for (int r = stretch.startVariable(); r < stretch.endVariable(); r++) {
                    result.add(new DungeonCell(q, r, stretch.level()));
                }
            }
        } else {
            int minR = Math.min(stretch.fixedCoordinate(), stretch.fixedCoordinate() + stretch.movement());
            int maxR = Math.max(stretch.fixedCoordinate(), stretch.fixedCoordinate() + stretch.movement());
            for (int r = minR; r < maxR; r++) {
                for (int q = stretch.startVariable(); q < stretch.endVariable(); q++) {
                    result.add(new DungeonCell(q, r, stretch.level()));
                }
            }
        }
        return Set.copyOf(result);
    }

    private static Map<Integer, List<DungeonClusterBoundary>> filterBoundaries(
            Iterable<DungeonClusterBoundary> boundaries,
            Map<Integer, List<DungeonCell>> cellsByLevel,
            DungeonCell center
    ) {
        List<DungeonClusterBoundary> filtered = new ArrayList<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            Set<DungeonCell> cells = new LinkedHashSet<>(cellsByLevel.getOrDefault(boundary.level(), List.of()));
            int insideCount = touch(boundary.absoluteEdge(center), cells).insideCells().size();
            if (insideCount >= 1
                    && (boundary.kind() == DungeonClusterBoundaryKind.DOOR || insideCount == 2)) {
                filtered.add(boundary);
            }
        }
        return boundariesByLevel(filtered);
    }

    private static DungeonRoomCluster clusterForStretch(
            ClusterWork work,
            DungeonRoomCellProjector cellProjector,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return new DungeonRoomCluster(
                work.cluster().clusterId(),
                work.cluster().mapId(),
                work.cluster().center(),
                verticesByLevel(work, cellProjector),
                boundariesByLevel);
    }

    private static Map<Integer, List<DungeonCell>> verticesByLevel(
            ClusterWork work,
            DungeonRoomCellProjector cellProjector
    ) {
        Map<Integer, List<DungeonCell>> verticesByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : work.cellsByLevel().entrySet()) {
            if (!entry.getValue().isEmpty()) {
                verticesByLevel.put(
                        entry.getKey(),
                        cellProjector.relativeCellLoops(work.cluster().center(), entry.getValue()));
            }
        }
        return Map.copyOf(verticesByLevel);
    }

    private static @Nullable DungeonClusterBoundary boundaryForEdge(
            Set<DungeonCell> clusterCells,
            DungeonCell center,
            long clusterId,
            DungeonEdge edge,
            DungeonClusterBoundaryKind kind,
            @Nullable DungeonTopologyRef topologyRef
    ) {
        if (edge == null || edge.from() == null || edge.to() == null) {
            return null;
        }
        List<DungeonCell> touchingCells = DungeonRoomCellProjector.sortedCells(edge.touchingCells());
        if (touchingCells.size() != 2 || touchingCells.getFirst().level() != touchingCells.get(1).level()) {
            return null;
        }
        List<DungeonCell> insideCells = touchingCells.stream()
                .filter(clusterCells::contains)
                .toList();
        if (insideCells.isEmpty()
                || (kind != DungeonClusterBoundaryKind.DOOR && insideCells.size() != 2)
                || (kind == DungeonClusterBoundaryKind.DOOR && insideCells.size() > 2)) {
            return null;
        }
        DungeonCell baseCell = insideCells.getFirst();
        DungeonEdgeDirection direction = directionFrom(baseCell, edge);
        if (direction == null) {
            return null;
        }
        return new DungeonClusterBoundary(
                clusterId,
                baseCell.level(),
                new DungeonCell(baseCell.q() - center.q(), baseCell.r() - center.r(), baseCell.level()),
                direction,
                kind,
                topologyRef == null ? DungeonTopologyRef.empty() : topologyRef);
    }

    private static BoundaryTouch touch(DungeonEdge edge, Set<DungeonCell> clusterCells) {
        List<DungeonCell> insideCells = edge.touchingCells().stream()
                .filter(clusterCells::contains)
                .toList();
        return new BoundaryTouch(insideCells);
    }

    private static boolean touchesCorridorBinding(
            DungeonMap dungeonMap,
            DungeonCell clusterCenter,
            long clusterId,
            int level,
            Set<DungeonBoundaryKey> keys
    ) {
        if (keys == null || keys.isEmpty()) {
            return false;
        }
        Set<DungeonBoundaryKey> bindingKeys = corridorBindingKeys(dungeonMap, clusterCenter, clusterId, level);
        return keys.stream().anyMatch(bindingKeys::contains);
    }

    private static boolean touchesCorridorBinding(
            DungeonMap dungeonMap,
            DungeonCell clusterCenter,
            long clusterId,
            int level,
            List<DungeonEdge> path
    ) {
        if (path == null || path.isEmpty()) {
            return false;
        }
        Set<DungeonBoundaryKey> bindingKeys = corridorBindingKeys(dungeonMap, clusterCenter, clusterId, level);
        return path.stream()
                .map(DungeonBoundaryKey::from)
                .anyMatch(bindingKeys::contains);
    }

    private static Set<DungeonBoundaryKey> corridorBindingKeys(
            DungeonMap dungeonMap,
            DungeonCell clusterCenter,
            long clusterId,
            int level
    ) {
        Set<DungeonBoundaryKey> result = new LinkedHashSet<>();
        if (dungeonMap == null || clusterCenter == null || clusterId <= 0L) {
            return result;
        }
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            for (DungeonCorridorDoorBinding binding : corridor.bindings().doorBindings()) {
                if (binding.clusterId() != clusterId || binding.relativeCell().level() != level) {
                    continue;
                }
                result.add(DungeonBoundaryKey.from(absoluteDoorEdge(binding, clusterCenter)));
            }
        }
        return Set.copyOf(result);
    }

    private static DungeonEdge absoluteDoorEdge(DungeonCorridorDoorBinding binding, DungeonCell clusterCenter) {
        return DungeonEdge.sideOf(absoluteRoomCell(binding, clusterCenter), binding.direction());
    }

    private static DungeonCell absoluteRoomCell(DungeonCorridorDoorBinding binding, DungeonCell clusterCenter) {
        DungeonCell relativeCell = binding.relativeCell();
        return new DungeonCell(
                clusterCenter.q() + relativeCell.q(),
                clusterCenter.r() + relativeCell.r(),
                relativeCell.level());
    }

    private static int fixedCoordinate(Orientation orientation, DungeonEdge edge) {
        return orientation == Orientation.VERTICAL ? edge.from().q() : edge.from().r();
    }

    private static int variableCoordinate(Orientation orientation, DungeonEdge edge) {
        return orientation == Orientation.VERTICAL
                ? Math.min(edge.from().r(), edge.to().r())
                : Math.min(edge.from().q(), edge.to().q());
    }

    private static int movementAlongNormal(Orientation orientation, int deltaQ, int deltaR) {
        return switch (orientation) {
            case VERTICAL -> deltaR == 0 ? deltaQ : 0;
            case HORIZONTAL -> deltaQ == 0 ? deltaR : 0;
        };
    }

    private static DungeonEdge moveEdge(DungeonEdge edge, Orientation orientation, int movement) {
        return switch (orientation) {
            case VERTICAL -> new DungeonEdge(
                    new DungeonCell(edge.from().q() + movement, edge.from().r(), edge.from().level()),
                    new DungeonCell(edge.to().q() + movement, edge.to().r(), edge.to().level()));
            case HORIZONTAL -> new DungeonEdge(
                    new DungeonCell(edge.from().q(), edge.from().r() + movement, edge.from().level()),
                    new DungeonCell(edge.to().q(), edge.to().r() + movement, edge.to().level()));
        };
    }

    private static @Nullable DungeonTopologyRef preserveTopologyRef(
            StretchEdge edge,
            DungeonCell center
    ) {
        if (edge.existing() == null) {
            return null;
        }
        return edge.existing().topologyRef().present()
                ? edge.existing().topologyRef()
                : edge.existing().resolvedTopologyRef(center);
    }

    private enum Orientation {
        HORIZONTAL,
        VERTICAL;

        private static @Nullable Orientation from(DungeonEdge edge) {
            if (edge == null || edge.from() == null || edge.to() == null) {
                return null;
            }
            if (edge.from().q() == edge.to().q()) {
                return VERTICAL;
            }
            if (edge.from().r() == edge.to().r()) {
                return HORIZONTAL;
            }
            return null;
        }

        private static @Nullable Orientation from(DungeonBoundaryKey key) {
            if (key == null) {
                return null;
            }
            return key.lower().q() == key.upper().q() ? VERTICAL : HORIZONTAL;
        }

        private boolean perpendicularTo(@Nullable Orientation other) {
            return other != null && this != other;
        }
    }

    private enum BoundarySide {
        NORTH,
        SOUTH,
        EAST,
        WEST;

        private static BoundarySide resolve(Orientation orientation, BoundaryTouch touch, int fixedCoordinate) {
            if (orientation == Orientation.VERTICAL) {
                return touch.insideCells().stream().anyMatch(cell -> cell.q() == fixedCoordinate - 1)
                        ? WEST
                        : EAST;
            }
            return touch.insideCells().stream().anyMatch(cell -> cell.r() == fixedCoordinate - 1)
                    ? NORTH
                    : SOUTH;
        }
    }

    private enum ConnectorMode {
        ADD,
        REMOVE
    }

    private record ConnectorAction(ConnectorMode mode, List<DungeonEdge> path) {
    }

    private record BoundaryTouch(List<DungeonCell> insideCells) {
        private BoundaryTouch {
            insideCells = insideCells == null ? List.of() : List.copyOf(insideCells);
        }

        private boolean valid() {
            return insideCount() == 1 || insideCount() == 2;
        }

        private int insideCount() {
            return insideCells.size();
        }
    }

    private record StretchEdge(
            DungeonEdge edge,
            DungeonBoundaryKey key,
            @Nullable DungeonClusterBoundary existing
    ) {
        private DungeonClusterBoundaryKind kind() {
            return existing == null ? DungeonClusterBoundaryKind.WALL : existing.kind();
        }
    }

    private record StretchSeed(
            int level,
            Orientation orientation,
            int fixedCoordinate,
            boolean outer,
            BoundarySide side,
            Set<DungeonCell> clusterCells
    ) {
        private StretchSeed {
            clusterCells = clusterCells == null ? Set.of() : Set.copyOf(clusterCells);
        }
    }

    private record BoundaryVertex(int q, int r, int level) {
    }

    private record StretchSelection(
            long clusterId,
            int level,
            Orientation orientation,
            boolean outer,
            int fixedCoordinate,
            int startVariable,
            int endVariable,
            int movement,
            BoundarySide side,
            List<StretchEdge> edges,
            Set<DungeonBoundaryKey> sourceKeys
    ) {
        private StretchSelection {
            edges = edges == null ? List.of() : List.copyOf(edges);
            sourceKeys = sourceKeys == null ? Set.of() : Set.copyOf(sourceKeys);
        }

        private boolean movesOutward() {
            return switch (side) {
                case WEST -> movement > 0;
                case EAST -> movement < 0;
                case NORTH -> movement > 0;
                case SOUTH -> movement < 0;
            };
        }

        private List<BoundaryVertex> vertices() {
            List<BoundaryVertex> result = new ArrayList<>();
            if (orientation == Orientation.VERTICAL) {
                for (int r = startVariable; r <= endVariable; r++) {
                    result.add(new BoundaryVertex(fixedCoordinate, r, level));
                }
            } else {
                for (int q = startVariable; q <= endVariable; q++) {
                    result.add(new BoundaryVertex(q, fixedCoordinate, level));
                }
            }
            return List.copyOf(result);
        }

        private List<DungeonEdge> connectorPath(BoundaryVertex vertex) {
            BoundaryVertex moved = orientation == Orientation.VERTICAL
                    ? new BoundaryVertex(vertex.q() + movement, vertex.r(), vertex.level())
                    : new BoundaryVertex(vertex.q(), vertex.r() + movement, vertex.level());
            if (vertex.equals(moved)) {
                return List.of();
            }
            List<DungeonEdge> result = new ArrayList<>();
            if (vertex.q() == moved.q()) {
                int step = Integer.compare(moved.r(), vertex.r());
                for (int r = vertex.r(); r != moved.r(); r += step) {
                    result.add(new DungeonEdge(
                            new DungeonCell(vertex.q(), r, vertex.level()),
                            new DungeonCell(vertex.q(), r + step, vertex.level())));
                }
            } else {
                int step = Integer.compare(moved.q(), vertex.q());
                for (int q = vertex.q(); q != moved.q(); q += step) {
                    result.add(new DungeonEdge(
                            new DungeonCell(q, vertex.r(), vertex.level()),
                            new DungeonCell(q + step, vertex.r(), vertex.level())));
                }
            }
            return List.copyOf(result);
        }
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
