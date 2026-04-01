package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.StructureDescriptor;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.objects.Wall;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.LocalConnection;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomNarration;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

final class ClusterRewritePlanner {

    private ClusterRewritePlanner() {
    }

    static ClusterRewrite applyPaint(RoomCluster cluster, Set<Point2i> paintCells, List<RoomCluster> overlappingClusters, int paintLevel) {
        if (cluster == null || paintCells == null || paintCells.isEmpty()) {
            return unchangedRewrite(cluster);
        }
        List<RoomCluster> resolvedClusters = normalizedClusters(overlappingClusters);
        List<Room> touchedRooms = resolvedClusters.stream()
                .flatMap(candidate -> candidate.rooms().stream())
                .filter(room -> room != null && room.roomId() != null && overlapsAtLevel(room, paintCells, paintLevel))
                .sorted(Comparator.comparing(room -> room.roomId() == null ? Long.MAX_VALUE : room.roomId()))
                .toList();
        if (touchedRooms.isEmpty()) {
            return unchangedRewrite(cluster);
        }

        Room retainedRoom = touchedRooms.getFirst();
        Set<Long> mergedRoomIds = touchedRooms.stream()
                .map(Room::roomId)
                .filter(java.util.Objects::nonNull)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        Map<Integer, Set<Point2i>> mergedRoomCellsByLevel = new LinkedHashMap<>();
        for (Room room : touchedRooms) {
            mergeRoomCells(mergedRoomCellsByLevel, room);
        }
        mergedRoomCellsByLevel.computeIfAbsent(paintLevel, ignored -> new LinkedHashSet<>()).addAll(paintCells);

        Set<Point2i> mergedClusterCells = new LinkedHashSet<>(paintCells);
        Map<GridSegment2x, InternalBoundaryType> previousBoundaryKinds = new LinkedHashMap<>();
        List<RoomRewriteCandidate> candidates = new ArrayList<>();
        Set<Long> deletedClusterIds = new LinkedHashSet<>();
        for (RoomCluster overlappingCluster : resolvedClusters) {
            mergedClusterCells.addAll(overlappingCluster.cells());
            previousBoundaryKinds.putAll(overlappingCluster.internalBoundaryKinds());
            if (overlappingCluster.clusterId() != null && !overlappingCluster.clusterId().equals(cluster.clusterId())) {
                deletedClusterIds.add(overlappingCluster.clusterId());
            }
            for (Room room : overlappingCluster.rooms()) {
                if (room == null || room.roomId() == null || mergedRoomIds.contains(room.roomId())) {
                    continue;
                }
                candidates.add(RoomRewriteCandidate.keep(
                        room.roomId(),
                        room.name(),
                        roomCellsByLevel(room),
                        roomAnchorsByLevel(room)));
            }
        }
        candidates.add(RoomRewriteCandidate.keep(
                retainedRoom.roomId(),
                retainedRoom.name(),
                mergedRoomCellsByLevel,
                roomAnchorsByLevel(retainedRoom)));

        List<ReconciledRoom> reconciledRooms = reconciledRooms(cluster, mergedClusterCells, candidates, previousBoundaryKinds);
        List<Room> rewrittenRooms = rooms(reconciledRooms);
        Map<Long, Long> replacedRoomIds = new LinkedHashMap<>();
        for (Long mergedRoomId : mergedRoomIds) {
            if (!mergedRoomId.equals(retainedRoom.roomId())) {
                replacedRoomIds.put(mergedRoomId, retainedRoom.roomId());
            }
        }
        Set<Long> deletedRoomIds = new LinkedHashSet<>(mergedRoomIds);
        deletedRoomIds.remove(retainedRoom.roomId());
        return ClusterRewrite.builder(
                        cluster.clusterId(),
                        bestCenterCell(mergedClusterCells),
                        rewrittenRooms,
                        localConnections(cluster.mapId(), cluster.clusterId(), rewrittenRooms),
                        persistedBoundaries(mergedClusterCells, rewrittenRooms, previousBoundaryKinds))
                .deletedRoomIds(deletedRoomIds)
                .replacedRoomIds(replacedRoomIds)
                .mergedRoomIds(mergedRoomIds.size() > 1 ? mergedRoomIds : Set.of())
                .deletedClusterIds(deletedClusterIds)
                .topologyChanged(true)
                .build();
    }

    static ClusterRewrite applyDelete(RoomCluster cluster, Set<Point2i> deletedCells, Supplier<String> roomNameSupplier, int deleteLevel) {
        if (cluster == null || deletedCells == null || deletedCells.isEmpty()) {
            return unchangedRewrite(cluster);
        }
        Map<Integer, Set<Point2i>> remainingCellsByLevel = mutableClusterCellsByLevel(cluster);
        Set<Point2i> remainingDeleteLevelCells = new LinkedHashSet<>(remainingCellsByLevel.getOrDefault(deleteLevel, Set.of()));
        if (!remainingDeleteLevelCells.removeAll(deletedCells)) {
            return unchangedRewrite(cluster);
        }
        if (remainingDeleteLevelCells.isEmpty()) {
            remainingCellsByLevel.remove(deleteLevel);
        } else {
            remainingCellsByLevel.put(deleteLevel, Set.copyOf(remainingDeleteLevelCells));
        }
        if (remainingCellsByLevel.isEmpty()) {
            return ClusterRewrite.builder(
                            cluster.clusterId(),
                            cluster.center(),
                            List.of(),
                            List.of(),
                            List.of())
                    .deletedRoomIds(cluster.roomIds())
                    .deletedClusterIds(Set.of(cluster.clusterId()))
                    .topologyChanged(true)
                    .build();
        }

        Map<GridSegment2x, InternalBoundaryType> previousBoundaryKinds = cluster.internalBoundaryKinds();
        List<RoomRewriteCandidate> candidates = new ArrayList<>();
        Set<Long> deletedRoomIds = new LinkedHashSet<>();
        Map<Long, List<RoomRewriteCandidate>> fragmentsBySourceRoomId = new LinkedHashMap<>();
        for (Room room : cluster.rooms()) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            Map<Integer, Set<Point2i>> remainingRoomCellsByLevel = mutableCellsByLevel(roomCellsByLevel(room));
            Set<Point2i> existingDeleteLevelCells = new LinkedHashSet<>(remainingRoomCellsByLevel.getOrDefault(deleteLevel, Set.of()));
            Set<Point2i> remainingRoomDeleteLevelCells = new LinkedHashSet<>(existingDeleteLevelCells);
            remainingRoomDeleteLevelCells.removeAll(deletedCells);
            if (remainingRoomDeleteLevelCells.isEmpty()) {
                remainingRoomCellsByLevel.remove(deleteLevel);
            } else {
                remainingRoomCellsByLevel.put(deleteLevel, Set.copyOf(remainingRoomDeleteLevelCells));
            }
            List<Set<Point2i>> components = connectedComponents(remainingRoomDeleteLevelCells).stream()
                    .sorted(Comparator
                            .comparing((Set<Point2i> component) -> !contains(component, preferredAnchor(existingDeleteLevelCells, roomAnchorsByLevel(room).get(deleteLevel))))
                            .thenComparing(ClusterRewritePlanner::bestCenterCell, Point2i.POINT_ORDER))
                    .toList();
            if (remainingRoomCellsByLevel.isEmpty()) {
                deletedRoomIds.add(room.roomId());
                continue;
            }
            if (components.isEmpty()) {
                RoomRewriteCandidate retainedCandidate = RoomRewriteCandidate.keep(
                        room.roomId(),
                        room.name(),
                        remainingRoomCellsByLevel,
                        roomAnchorsByLevel(room));
                candidates.add(retainedCandidate);
                fragmentsBySourceRoomId.put(room.roomId(), List.of(retainedCandidate));
                continue;
            }
            List<RoomRewriteCandidate> sourceFragments = new ArrayList<>();
            for (int index = 0; index < components.size(); index++) {
                Set<Point2i> component = components.get(index);
                Map<Integer, Set<Point2i>> fragmentCellsByLevel = index == 0
                        ? mutableCellsByLevel(remainingRoomCellsByLevel)
                        : mutableCellsByLevelWithoutLevel(remainingRoomCellsByLevel, deleteLevel);
                fragmentCellsByLevel.put(deleteLevel, Set.copyOf(component));
                String roomName = index == 0
                        ? room.name()
                        : nextGeneratedRoomName(roomNameSupplier, room.name());
                RoomRewriteCandidate candidate = index == 0
                        ? RoomRewriteCandidate.keep(room.roomId(), roomName, fragmentCellsByLevel, roomAnchorsByLevel(room))
                        : RoomRewriteCandidate.create(room.roomId(), roomName, fragmentCellsByLevel, roomAnchorsByLevel(room));
                candidates.add(candidate);
                sourceFragments.add(candidate);
            }
            fragmentsBySourceRoomId.put(room.roomId(), List.copyOf(sourceFragments));
        }

        Set<Point2i> rewrittenClusterCells = flattenCells(remainingCellsByLevel);
        List<ReconciledRoom> reconciledRooms = reconciledRooms(cluster, rewrittenClusterCells, candidates, previousBoundaryKinds);
        List<Room> rewrittenRooms = rooms(reconciledRooms);
        Map<Long, List<Room>> splitFragmentsBySourceRoomId = resolvedFragmentsBySourceRoomId(
                fragmentsBySourceRoomId,
                reconciledRooms);
        List<ClusterRewriteSplit> componentClusters = deleteRewriteClusters(
                cluster,
                rewrittenClusterCells,
                rewrittenRooms,
                previousBoundaryKinds);
        ClusterRewriteSplit retainedCluster = componentClusters.getFirst().withClusterId(cluster.clusterId());
        List<ClusterRewriteSplit> splitClusters = componentClusters.stream()
                .skip(1)
                .toList();
        return ClusterRewrite.builder(
                        cluster.clusterId(),
                        retainedCluster.clusterCenter(),
                        retainedCluster.rooms(),
                        retainedCluster.localConnections(),
                        retainedCluster.persistedBoundaries())
                .deletedRoomIds(deletedRoomIds)
                .splitFragmentsBySourceRoomId(splitFragmentsBySourceRoomId)
                .splitClusters(splitClusters)
                .topologyChanged(true)
                .build();
    }

    static ClusterRewrite editBoundary(RoomCluster cluster, Collection<GridSegment2x> segments2x, InternalBoundaryType type, boolean deleteBoundary) {
        if (cluster == null || segments2x == null || segments2x.isEmpty()) {
            return null;
        }
        Map<GridSegment2x, InternalBoundaryType> updatedBoundaryKinds = new LinkedHashMap<>(cluster.internalBoundaryKinds());
        InternalBoundaryType resolvedType = type == null ? InternalBoundaryType.WALL : type;
        boolean changed = false;
        for (GridSegment2x segment2x : segments2x) {
            if (segment2x == null || !isInternalSegment(cluster.cells(), segment2x)) {
                continue;
            }
            List<Point2i> touchingCells = segment2x.touchingCells().stream()
                    .sorted(Point2i.POINT_ORDER)
                    .toList();
            if (touchingCells.size() != 2) {
                continue;
            }
            Room leftRoom = cluster.roomAt(touchingCells.getFirst());
            Room rightRoom = cluster.roomAt(touchingCells.getLast());
            if (leftRoom == null || rightRoom == null) {
                continue;
            }
            InternalBoundaryType currentType = updatedBoundaryKinds.get(segment2x);
            if (deleteBoundary) {
                if (currentType == null || sameRoomId(leftRoom, rightRoom)) {
                    continue;
                }
                updatedBoundaryKinds.remove(segment2x);
                changed = true;
                continue;
            }
            if (resolvedType == InternalBoundaryType.WALL && currentType == InternalBoundaryType.DOOR) {
                continue;
            }
            if (resolvedType == currentType) {
                continue;
            }
            updatedBoundaryKinds.put(segment2x, resolvedType);
            changed = true;
        }

        if (!changed) {
            return null;
        }

        List<Room> rewrittenRooms = rewriteRoomsForBoundaryKinds(cluster, updatedBoundaryKinds);
        BoundaryMergeResult merge = computeMergeMetadata(cluster, rewrittenRooms);
        return ClusterRewrite.builder(
                        cluster.clusterId(),
                        cluster.center(),
                        rewrittenRooms,
                        localConnections(cluster.mapId(), cluster.clusterId(), rewrittenRooms),
                        persistedBoundaries(cluster.cells(), rewrittenRooms, updatedBoundaryKinds))
                .deletedRoomIds(merge.deletedRoomIds())
                .replacedRoomIds(merge.replacedRoomIds())
                .mergedRoomIds(merge.mergedRoomIds())
                .topologyChanged(true)
                .build();
    }

    static List<ReconciledRoom> reconciledRooms(
            RoomCluster cluster,
            Set<Point2i> clusterCells,
            List<RoomRewriteCandidate> candidates,
            Map<GridSegment2x, InternalBoundaryType> previousKinds
    ) {
        if (cluster == null || clusterCells == null || clusterCells.isEmpty()) {
            return List.of();
        }
        Map<GridSegment2x, InternalBoundaryType> boundaryKinds = previousKinds == null ? Map.of() : Map.copyOf(previousKinds);
        List<ReconciledRoom> result = new ArrayList<>();
        for (RoomRewriteCandidate candidate : candidates == null ? List.<RoomRewriteCandidate>of() : candidates) {
            if (candidate == null || candidate.cellsByLevel() == null || candidate.cellsByLevel().isEmpty()) {
                continue;
            }
            Room room = cluster.findRoom(candidate.roomId());
            RoomNarration narration = room == null ? RoomNarration.empty() : room.narration();
            result.add(new ReconciledRoom(
                    candidate,
                    resolvedRoom(
                            cluster,
                            candidate.cellsByLevel(),
                            clusterCells,
                            boundaryKinds,
                            candidate.preferredAnchorsByLevel(),
                            candidate.roomId(),
                            candidate.name(),
                            narration)));
        }
        return List.copyOf(result);
    }

    static List<Room> rewriteRoomsForBoundaryKinds(RoomCluster cluster, Map<GridSegment2x, InternalBoundaryType> boundaryKinds) {
        if (cluster == null || cluster.cells().isEmpty() || cluster.rooms().isEmpty()) {
            return List.of();
        }
        Map<Integer, Set<Point2i>> remainingCellsByLevel = mutableClusterCellsByLevel(cluster);
        Set<GridSegment2x> barriers = barriersForBoundaryKinds(boundaryKinds);
        List<Room> rewrittenRooms = new ArrayList<>();
        Set<Long> retainedRoomIds = new LinkedHashSet<>();
        for (Room room : cluster.rooms()) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            Map<Integer, Set<Point2i>> roomCellsByLevel = rewrittenRoomCellsByLevel(room, remainingCellsByLevel, barriers);
            if (roomCellsByLevel.isEmpty()) {
                continue;
            }
            List<Room> sourceRooms = roomsForCells(cluster, flattenCells(roomCellsByLevel));
            Room retainedRoom = retainedRoom(sourceRooms, retainedRoomIds);
            rewrittenRooms.add(resolveRoomForCells(cluster, retainedRoom, roomCellsByLevel, boundaryKinds, sourceRooms));
        }
        for (LevelSeed seed = firstRemainingSeed(remainingCellsByLevel);
                seed != null;
                seed = firstRemainingSeed(remainingCellsByLevel)) {
            Point2i anchor = seed.cell();
            Set<Point2i> levelCells = remainingCellsByLevel.getOrDefault(seed.level(), Set.of());
            Set<Point2i> roomCells = reachableCells(anchor, levelCells, barriers);
            if (roomCells.isEmpty()) {
                remainingCellsByLevel.computeIfPresent(seed.level(), (ignored, cells) -> {
                    cells.remove(anchor);
                    return cells;
                });
                continue;
            }
            levelCells.removeAll(roomCells);
            if (levelCells.isEmpty()) {
                remainingCellsByLevel.remove(seed.level());
            }
            List<Room> sourceRooms = roomsForCells(cluster, roomCells);
            Room retainedRoom = retainedRoom(sourceRooms, retainedRoomIds);
            rewrittenRooms.add(resolveRoomForCells(
                    cluster,
                    retainedRoom,
                    Map.of(seed.level(), Set.copyOf(roomCells)),
                    boundaryKinds,
                    sourceRooms));
        }
        return List.copyOf(rewrittenRooms);
    }

    static Room resolvedRoom(
            RoomCluster cluster,
            Map<Integer, Set<Point2i>> roomCellsByLevel,
            Set<Point2i> clusterCells,
            Map<GridSegment2x, InternalBoundaryType> boundaryKinds,
            Map<Integer, Point2i> preferredAnchorsByLevel,
            Long roomId,
            String roomName,
            RoomNarration narration
    ) {
        StructureDescriptor descriptor = descriptorForRoom(roomCellsByLevel, clusterCells, boundaryKinds, preferredAnchorsByLevel);
        return Room.resolved(
                roomId,
                cluster.mapId(),
                cluster.clusterId() == null ? 0L : cluster.clusterId(),
                roomName,
                StructureObject.fromDescriptor(descriptor),
                narration);
    }

    private static BoundarySets boundarySetsForRoom(
            Set<Point2i> roomCells,
            Set<Point2i> clusterCells,
            Map<GridSegment2x, InternalBoundaryType> boundaryKinds
    ) {
        Set<GridSegment2x> wallSegments = new LinkedHashSet<>();
        Set<GridSegment2x> connectionSegments = new LinkedHashSet<>();
        if (roomCells == null || roomCells.isEmpty() || clusterCells == null || clusterCells.isEmpty()) {
            return new BoundarySets(Set.of(), Set.of());
        }
        for (Point2i cell : roomCells) {
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Point2i neighbor = cell.add(step);
                if (roomCells.contains(neighbor)) {
                    continue;
                }
                GridSegment2x segment2x = GridSegment2x.betweenCellAndStep(cell, step);
                if (!clusterCells.contains(neighbor)) {
                    wallSegments.add(segment2x);
                    continue;
                }
                InternalBoundaryType resolvedType = boundaryKinds == null
                        ? InternalBoundaryType.WALL
                        : boundaryKinds.getOrDefault(segment2x, InternalBoundaryType.WALL);
                if (resolvedType == InternalBoundaryType.DOOR) {
                    connectionSegments.add(segment2x);
                } else {
                    wallSegments.add(segment2x);
                }
            }
        }
        return new BoundarySets(Set.copyOf(wallSegments), Set.copyOf(connectionSegments));
    }

    private static Set<GridSegment2x> barriersForBoundaryKinds(Map<GridSegment2x, InternalBoundaryType> boundaryKinds) {
        if (boundaryKinds == null || boundaryKinds.isEmpty()) {
            return Set.of();
        }
        return boundaryKinds.keySet().stream()
                .filter(java.util.Objects::nonNull)
                .sorted(GridSegment2x.SEGMENT_ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private static Set<Point2i> reachableCells(Point2i startAnchor, Set<Point2i> traversableCells, Set<GridSegment2x> barriers) {
        if (startAnchor == null || traversableCells == null || traversableCells.isEmpty() || !traversableCells.contains(startAnchor)) {
            return Set.of();
        }
        Set<Point2i> visited = new LinkedHashSet<>();
        Set<Point2i> frontier = new LinkedHashSet<>(traversableCells);
        ArrayDeque<Point2i> queue = new ArrayDeque<>();
        queue.add(startAnchor);
        frontier.remove(startAnchor);
        while (!queue.isEmpty()) {
            Point2i current = queue.removeFirst();
            visited.add(current);
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Point2i neighbor = current.add(step);
                if (!frontier.contains(neighbor) || isBlocked(barriers, current, step)) {
                    continue;
                }
                frontier.remove(neighbor);
                queue.addLast(neighbor);
            }
        }
        return Set.copyOf(visited);
    }

    private static List<Room> roomsForCells(RoomCluster cluster, Set<Point2i> roomCells) {
        if (cluster == null) {
            return List.of();
        }
        return cluster.rooms().stream()
                .filter(room -> room != null && room.roomId() != null && !disjoint(room.structure().cells(), roomCells))
                .sorted(Comparator.comparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                .toList();
    }

    private static Room retainedRoom(List<Room> sourceRooms, Set<Long> retainedRoomIds) {
        if (sourceRooms == null || sourceRooms.isEmpty()) {
            return null;
        }
        for (Room sourceRoom : sourceRooms) {
            if (sourceRoom == null || sourceRoom.roomId() == null) {
                continue;
            }
            if (retainedRoomIds == null || retainedRoomIds.add(sourceRoom.roomId())) {
                return sourceRoom;
            }
        }
        return null;
    }

    private static Room resolveRoomForCells(
            RoomCluster cluster,
            Room retainedRoom,
            Map<Integer, Set<Point2i>> roomCellsByLevel,
            Map<GridSegment2x, InternalBoundaryType> boundaryKinds,
            List<Room> sourceRooms
    ) {
        Long roomId = retainedRoom == null ? null : retainedRoom.roomId();
        String roomName = retainedRoom == null ? derivedSplitRoomName(sourceRooms) : retainedRoom.name();
        RoomNarration narration = retainedRoom == null
                ? (sourceRooms == null || sourceRooms.isEmpty() ? RoomNarration.empty() : sourceRooms.getFirst().narration())
                : retainedRoom.narration();
        Map<Integer, Point2i> preferredAnchorsByLevel = retainedRoom == null
                ? preferredAnchors(sourceRooms)
                : roomAnchorsByLevel(retainedRoom);
        return resolvedRoom(
                cluster,
                roomCellsByLevel,
                cluster.cells(),
                boundaryKinds,
                preferredAnchorsByLevel,
                roomId,
                roomName,
                narration);
    }

    private static String derivedSplitRoomName(List<Room> sourceRooms) {
        if (sourceRooms != null && !sourceRooms.isEmpty()) {
            Room sourceRoom = sourceRooms.getFirst();
            if (sourceRoom != null && sourceRoom.name() != null && !sourceRoom.name().isBlank()) {
                return sourceRoom.name().trim() + " Teil";
            }
        }
        return normalizedRoomName(null, null);
    }

    static BoundaryMergeResult computeMergeMetadata(RoomCluster cluster, List<Room> rewrittenRooms) {
        Set<Long> deletedRoomIds = new LinkedHashSet<>();
        Map<Long, Long> replacedRoomIds = new LinkedHashMap<>();
        Set<Long> mergedRoomIds = new LinkedHashSet<>();
        for (Room rewrittenRoom : rewrittenRooms) {
            if (rewrittenRoom == null) {
                continue;
            }
            List<Room> sourceRooms = roomsForCells(cluster, rewrittenRoom.structure().cells());
            if (sourceRooms.size() <= 1) {
                continue;
            }
            Long replacementRoomId = rewrittenRoom.roomId();
            for (Room sourceRoom : sourceRooms) {
                if (sourceRoom == null || sourceRoom.roomId() == null) {
                    continue;
                }
                mergedRoomIds.add(sourceRoom.roomId());
                replacedRoomIds.put(sourceRoom.roomId(), replacementRoomId);
                if (!sourceRoom.roomId().equals(replacementRoomId)) {
                    deletedRoomIds.add(sourceRoom.roomId());
                }
            }
        }
        return new BoundaryMergeResult(deletedRoomIds, replacedRoomIds, mergedRoomIds);
    }

    static List<ClusterRewriteSplit> deleteRewriteClusters(
            RoomCluster cluster,
            Set<Point2i> rewrittenClusterCells,
            List<Room> rewrittenRooms,
            Map<GridSegment2x, InternalBoundaryType> boundaryKinds
    ) {
        if (cluster == null || rewrittenClusterCells == null || rewrittenClusterCells.isEmpty()) {
            return List.of();
        }
        return connectedComponents(rewrittenClusterCells).stream()
                .sorted(Comparator
                        .comparing((Set<Point2i> component) -> !component.contains(cluster.center()))
                        .thenComparingInt(component -> bestCenterCell(component).distanceTo(cluster.center()))
                        .thenComparing(ClusterRewritePlanner::bestCenterCell, Point2i.POINT_ORDER))
                .map(componentCells -> {
                    List<Room> componentRooms = roomsForDeleteComponent(componentCells, rewrittenRooms);
                    return new ClusterRewriteSplit(
                            null,
                            bestCenterCell(componentCells),
                            componentRooms,
                            localConnections(cluster.mapId(), null, componentRooms),
                            persistedBoundaries(componentCells, componentRooms, boundaryKinds));
                })
                .toList();
    }

    static List<Room> roomsForDeleteComponent(Set<Point2i> componentCells, List<Room> rewrittenRooms) {
        if (componentCells == null || componentCells.isEmpty()) {
            return List.of();
        }
        return rewrittenRooms.stream()
                .filter(room -> room != null && !disjoint(room.structure().cells(), componentCells))
                .sorted(Comparator.comparing(Room::roomId, Comparator.nullsLast(Long::compareTo))
                        .thenComparing(room -> room.structure().centerCellAtLevel(room.structure().primaryLevel()), Point2i.POINT_ORDER))
                .toList();
    }

    static List<InternalBoundaryEdge> persistedBoundaries(
            Set<Point2i> clusterCells,
            List<Room> rooms,
            Map<GridSegment2x, InternalBoundaryType> boundaryKinds
    ) {
        return computeInternalBoundaries(clusterCells, rooms, boundaryKinds).entrySet().stream()
                .map(entry -> toInternalBoundaryEdge(entry.getKey(), entry.getValue()))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    static List<LocalConnection> localConnections(
            long mapId,
            Long clusterId,
            List<Room> rooms
    ) {
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        long resolvedClusterId = clusterId == null ? 0L : clusterId;
        Map<CubePoint, Room> roomsByPoint = roomsByPoint(rooms);
        Map<String, DoorComponent> doorsByKey = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (Integer levelZ : room.structure().levels()) {
                for (Door door : room.structure().doorsAtLevel(levelZ)) {
                    if (door == null) {
                        continue;
                    }
                    doorsByKey.putIfAbsent(doorKey(levelZ, door), new DoorComponent(levelZ, door));
                }
            }
        }
        List<LocalConnection> result = new ArrayList<>();
        for (DoorComponent doorComponent : doorsByKey.values()) {
            LocalConnection connection = localConnectionForDoor(doorComponent, mapId, resolvedClusterId, roomsByPoint);
            if (connection != null) {
                result.add(connection);
            }
        }
        return List.copyOf(result);
    }

    static Map<GridSegment2x, InternalBoundaryType> internalBoundaryKinds(
            Set<Point2i> clusterCells,
            List<Room> rooms,
            List<LocalConnection> localConnections
    ) {
        return computeInternalBoundaries(clusterCells, rooms, boundaryKinds(localConnections));
    }

    static Map<Long, List<Room>> resolvedFragmentsBySourceRoomId(
            Map<Long, List<RoomRewriteCandidate>> candidatesBySourceRoomId,
            List<ReconciledRoom> reconciledRooms
    ) {
        if (candidatesBySourceRoomId == null || candidatesBySourceRoomId.isEmpty()) {
            return Map.of();
        }
        Map<RoomRewriteCandidate, Room> roomByCandidate = new LinkedHashMap<>();
        for (ReconciledRoom reconciledRoom : reconciledRooms == null ? List.<ReconciledRoom>of() : reconciledRooms) {
            if (reconciledRoom != null && reconciledRoom.candidate() != null && reconciledRoom.room() != null) {
                roomByCandidate.put(reconciledRoom.candidate(), reconciledRoom.room());
            }
        }
        Map<Long, List<Room>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<RoomRewriteCandidate>> entry : candidatesBySourceRoomId.entrySet()) {
            List<Room> resolved = entry.getValue().stream()
                    .map(roomByCandidate::get)
                    .filter(java.util.Objects::nonNull)
                    .toList();
            result.put(entry.getKey(), resolved);
        }
        return Map.copyOf(result);
    }

    private static List<RoomCluster> normalizedClusters(List<RoomCluster> clusters) {
        if (clusters == null || clusters.isEmpty()) {
            return List.of();
        }
        Map<Long, RoomCluster> result = new LinkedHashMap<>();
        for (RoomCluster cluster : clusters) {
            if (cluster != null && cluster.clusterId() != null) {
                result.put(cluster.clusterId(), cluster);
            }
        }
        return List.copyOf(result.values());
    }

    private static ClusterRewrite unchangedRewrite(RoomCluster cluster) {
        if (cluster == null) {
            return null;
        }
        return ClusterRewrite.unchanged(
                cluster.clusterId(),
                cluster.center(),
                cluster.rooms(),
                cluster.localConnections(),
                persistedBoundaries(cluster.cells(), cluster.rooms(), cluster.internalBoundaryKinds()));
    }

    private static InternalBoundaryEdge toInternalBoundaryEdge(GridSegment2x segment2x, InternalBoundaryType type) {
        if (segment2x == null) {
            return null;
        }
        List<Point2i> touchingCells = segment2x.touchingCells().stream()
                .sorted(Point2i.POINT_ORDER)
                .toList();
        if (touchingCells.size() != 2) {
            return null;
        }
        Point2i baseCell = touchingCells.getFirst();
        Point2i direction = baseCell.directionToCardinal(touchingCells.get(1));
        return direction == null ? null : new InternalBoundaryEdge(baseCell, direction, type);
    }

    private static boolean isInternalSegment(Set<Point2i> clusterCells, GridSegment2x segment2x) {
        Set<Point2i> touchingCells = segment2x == null ? Set.of() : segment2x.touchingCells();
        return touchingCells.size() == 2 && clusterCells.containsAll(touchingCells);
    }

    private static String nextGeneratedRoomName(Supplier<String> roomNameSupplier, String fallbackName) {
        if (roomNameSupplier == null) {
            return fallbackName;
        }
        String generated = roomNameSupplier.get();
        return generated == null || generated.isBlank() ? fallbackName : generated.trim();
    }

    private static List<Room> rooms(List<ReconciledRoom> reconciledRooms) {
        if (reconciledRooms == null || reconciledRooms.isEmpty()) {
            return List.of();
        }
        return reconciledRooms.stream()
                .map(ReconciledRoom::room)
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    private static Map<GridSegment2x, InternalBoundaryType> computeInternalBoundaries(
            Set<Point2i> clusterCells,
            List<Room> rooms,
            Map<GridSegment2x, InternalBoundaryType> boundaryKinds
    ) {
        if (clusterCells == null || clusterCells.isEmpty()) {
            return Map.of();
        }
        Map<GridSegment2x, InternalBoundaryType> result = new LinkedHashMap<>();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room == null) {
                continue;
            }
            for (GridSegment2x segment2x : roomWallSegments(room)) {
                if (isInternalSegment(clusterCells, segment2x)) {
                    result.putIfAbsent(segment2x, InternalBoundaryType.WALL);
                }
            }
        }
        for (Map.Entry<GridSegment2x, InternalBoundaryType> entry : (boundaryKinds == null ? Map.<GridSegment2x, InternalBoundaryType>of() : boundaryKinds).entrySet()) {
            if (isInternalSegment(clusterCells, entry.getKey()) && entry.getValue() == InternalBoundaryType.DOOR) {
                result.put(entry.getKey(), InternalBoundaryType.DOOR);
            }
        }
        return Map.copyOf(result);
    }

    static boolean sameRoomId(Room left, Room right) {
        return left != null
                && right != null
                && left.roomId() != null
                && left.roomId().equals(right.roomId());
    }

    private static boolean isBlocked(Set<GridSegment2x> barriers, Point2i cell, Point2i step) {
        return barriers != null && barriers.contains(GridSegment2x.betweenCellAndStep(cell, step));
    }

    static boolean disjoint(Set<Point2i> left, Set<Point2i> right) {
        for (Point2i point : left) {
            if (right.contains(point)) {
                return false;
            }
        }
        return true;
    }

    static String normalizedRoomName(Long roomId, String name) {
        return name == null || name.isBlank()
                ? "Raum " + (roomId == null ? "neu" : roomId)
                : name.trim();
    }

    private static Map<CubePoint, Room> roomsByPoint(List<Room> rooms) {
        Map<CubePoint, Room> result = new LinkedHashMap<>();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room == null) {
                continue;
            }
            for (CubePoint point : room.structure().cubePoints()) {
                result.putIfAbsent(point, room);
            }
        }
        return Map.copyOf(result);
    }

    private static LocalConnection localConnectionForDoor(
            DoorComponent doorComponent,
            long mapId,
            long clusterId,
            Map<CubePoint, Room> roomsByPoint
    ) {
        if (doorComponent == null || doorComponent.door() == null) {
            return null;
        }
        List<Room> touchingRooms = new ArrayList<>();
        for (GridSegment2x segment2x : doorComponent.door().segments2x()) {
            for (Point2i cell : segment2x.touchingCells().stream().sorted(Point2i.POINT_ORDER).toList()) {
                Room room = roomsByPoint.get(CubePoint.at(cell, doorComponent.levelZ()));
                if (room != null && !touchingRooms.contains(room)) {
                    touchingRooms.add(room);
                }
            }
        }
        List<ConnectionEndpoint> endpoints = endpointsForDoor(clusterId, touchingRooms);
        if (endpoints.size() != 2) {
            return null;
        }
        return new LocalConnection(
                null,
                mapId,
                clusterId,
                doorComponent.levelZ(),
                Door.fromSegments(doorComponent.door().segments2x(), doorComponent.door().doorState()),
                endpoints);
    }

    private static List<ConnectionEndpoint> endpointsForDoor(long clusterId, List<Room> touchingRooms) {
        if (touchingRooms == null || touchingRooms.isEmpty()) {
            return List.of();
        }
        if (touchingRooms.size() >= 2) {
            Room leftRoom = touchingRooms.getFirst();
            Room rightRoom = touchingRooms.get(1);
            if (leftRoom.roomId() == null || rightRoom.roomId() == null || sameRoomId(leftRoom, rightRoom)) {
                return List.of();
            }
            return List.of(ConnectionEndpoint.room(leftRoom.roomId()), ConnectionEndpoint.room(rightRoom.roomId()));
        }
        Room room = touchingRooms.getFirst();
        if (room.roomId() == null) {
            return List.of();
        }
        return List.of(ConnectionEndpoint.room(room.roomId()), ConnectionEndpoint.cluster(clusterId));
    }

    private static String doorKey(int levelZ, Door door) {
        StringBuilder builder = new StringBuilder();
        builder.append(levelZ).append(':');
        boolean first = true;
        for (GridSegment2x segment2x : (door == null ? List.<GridSegment2x>of() : door.segments2x()).stream()
                .sorted(GridSegment2x.SEGMENT_ORDER)
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

    private static Map<GridSegment2x, InternalBoundaryType> boundaryKinds(List<LocalConnection> localConnections) {
        Map<GridSegment2x, InternalBoundaryType> result = new LinkedHashMap<>();
        for (LocalConnection connection : localConnections == null ? List.<LocalConnection>of() : localConnections) {
            if (connection == null || connection.door() == null) {
                continue;
            }
            for (GridSegment2x segment2x : connection.door().segments2x()) {
                result.put(segment2x, InternalBoundaryType.DOOR);
            }
        }
        return Map.copyOf(result);
    }

    record BoundaryMergeResult(
            Set<Long> deletedRoomIds,
            Map<Long, Long> replacedRoomIds,
            Set<Long> mergedRoomIds
    ) {
    }

    record BoundarySets(Set<GridSegment2x> walls, Set<GridSegment2x> openings) {
    }

    private record DoorComponent(int levelZ, Door door) {
    }

    record RoomRewriteCandidate(
            Long sourceRoomId,
            Long roomId,
            String name,
            Map<Integer, Set<Point2i>> cellsByLevel,
            Map<Integer, Point2i> preferredAnchorsByLevel
    ) {
        static RoomRewriteCandidate keep(Long roomId, String name, Map<Integer, Set<Point2i>> cellsByLevel, Map<Integer, Point2i> preferredAnchorsByLevel) {
            return new RoomRewriteCandidate(roomId, roomId, name, immutableCellsByLevel(cellsByLevel), immutableAnchors(preferredAnchorsByLevel));
        }

        static RoomRewriteCandidate create(Long sourceRoomId, String name, Map<Integer, Set<Point2i>> cellsByLevel, Map<Integer, Point2i> preferredAnchorsByLevel) {
            return new RoomRewriteCandidate(sourceRoomId, null, name, immutableCellsByLevel(cellsByLevel), immutableAnchors(preferredAnchorsByLevel));
        }
    }

    record ReconciledRoom(
            RoomRewriteCandidate candidate,
            Room room
    ) {
    }

    private static boolean overlapsAtLevel(Room room, Set<Point2i> paintCells, int levelZ) {
        if (room == null || paintCells == null || paintCells.isEmpty()) {
            return false;
        }
        return !disjoint(room.structure().cellsAtLevel(levelZ), paintCells);
    }

    private static void mergeRoomCells(Map<Integer, Set<Point2i>> result, Room room) {
        if (result == null || room == null) {
            return;
        }
        for (Map.Entry<Integer, Set<Point2i>> entry : roomCellsByLevel(room).entrySet()) {
            if (entry == null || entry.getKey() == null || entry.getValue() == null || entry.getValue().isEmpty()) {
                continue;
            }
            result.computeIfAbsent(entry.getKey(), ignored -> new LinkedHashSet<>()).addAll(entry.getValue());
        }
    }

    private static Map<Integer, Set<Point2i>> mutableClusterCellsByLevel(RoomCluster cluster) {
        return mutableCellsByLevel(cluster == null ? Map.of() : cluster.cellsByLevel());
    }

    private static Map<Integer, Set<Point2i>> rewrittenRoomCellsByLevel(
            Room room,
            Map<Integer, Set<Point2i>> remainingCellsByLevel,
            Set<GridSegment2x> barriers
    ) {
        Map<Integer, Set<Point2i>> result = new LinkedHashMap<>();
        if (room == null || remainingCellsByLevel == null || remainingCellsByLevel.isEmpty()) {
            return Map.of();
        }
        for (Map.Entry<Integer, Point2i> entry : roomAnchorsByLevel(room).entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .toList()) {
            Integer level = entry.getKey();
            Point2i anchor = entry.getValue();
            if (level == null || anchor == null) {
                continue;
            }
            Set<Point2i> remainingCells = remainingCellsByLevel.get(level);
            if (remainingCells == null || !remainingCells.contains(anchor)) {
                continue;
            }
            Set<Point2i> roomCells = reachableCells(anchor, remainingCells, barriers);
            if (roomCells.isEmpty()) {
                continue;
            }
            remainingCells.removeAll(roomCells);
            if (remainingCells.isEmpty()) {
                remainingCellsByLevel.remove(level);
            }
            result.put(level, Set.copyOf(roomCells));
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static LevelSeed firstRemainingSeed(Map<Integer, Set<Point2i>> remainingCellsByLevel) {
        if (remainingCellsByLevel == null || remainingCellsByLevel.isEmpty()) {
            return null;
        }
        return remainingCellsByLevel.entrySet().stream()
                .filter(entry -> entry.getValue() != null && !entry.getValue().isEmpty())
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new LevelSeed(
                        entry.getKey(),
                        entry.getValue().stream().min(Point2i.POINT_ORDER).orElse(null)))
                .filter(seed -> seed.cell() != null)
                .findFirst()
                .orElse(null);
    }

    private static Set<Point2i> flattenCells(Map<Integer, Set<Point2i>> cellsByLevel) {
        LinkedHashSet<Point2i> result = new LinkedHashSet<>();
        for (Set<Point2i> cells : cellsByLevel.values()) {
            result.addAll(cells);
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static StructureDescriptor descriptorForRoom(
            Map<Integer, Set<Point2i>> roomCellsByLevel,
            Set<Point2i> clusterCells,
            Map<GridSegment2x, InternalBoundaryType> boundaryKinds,
            Map<Integer, Point2i> preferredAnchorsByLevel
    ) {
        Map<Integer, StructureDescriptor.LevelDescriptor> levels = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<Point2i>> entry : (roomCellsByLevel == null ? Map.<Integer, Set<Point2i>>of() : roomCellsByLevel).entrySet()) {
            Integer levelZ = entry.getKey();
            Set<Point2i> roomCells = normalizeCells(entry.getValue());
            if (levelZ == null || roomCells.isEmpty()) {
                continue;
            }
            StructureDescriptor.LevelDescriptor base = StructureDescriptor.fromCellsByLevel(Map.of(levelZ, roomCells)).level(levelZ);
            if (base == null) {
                continue;
            }
            Point2i preferredAnchor = preferredAnchorsByLevel == null ? null : preferredAnchorsByLevel.get(levelZ);
            GridPoint2x anchor2x = preferredAnchor != null && roomCells.contains(preferredAnchor)
                    ? GridPoint2x.fromTileCenter(preferredAnchor)
                    : base.anchor2x();
            Set<GridSegment2x> openings = boundarySetsForRoom(roomCells, clusterCells, boundaryKinds).openings();
            levels.put(levelZ, new StructureDescriptor.LevelDescriptor(
                    anchor2x,
                    base.fillSeeds2x(),
                    base.boundarySegments2x(),
                    openings));
        }
        return new StructureDescriptor(levels);
    }

    private static Map<Integer, Point2i> preferredAnchors(List<Room> sourceRooms) {
        if (sourceRooms == null || sourceRooms.isEmpty()) {
            return Map.of();
        }
        for (Room room : sourceRooms) {
            if (room != null && !roomAnchorsByLevel(room).isEmpty()) {
                return roomAnchorsByLevel(room);
            }
        }
        return Map.of();
    }

    private static Map<Integer, Set<Point2i>> roomCellsByLevel(Room room) {
        if (room == null) {
            return Map.of();
        }
        Map<Integer, Set<Point2i>> result = new LinkedHashMap<>();
        for (Integer levelZ : room.structure().levels().stream().sorted().toList()) {
            Set<Point2i> cellsAtLevel = room.structure().cellsAtLevel(levelZ);
            if (!cellsAtLevel.isEmpty()) {
                result.put(levelZ, Set.copyOf(cellsAtLevel));
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Integer, Point2i> roomAnchorsByLevel(Room room) {
        if (room == null) {
            return Map.of();
        }
        Map<Integer, Point2i> result = new LinkedHashMap<>();
        for (Integer levelZ : room.structure().levels().stream().sorted().toList()) {
            var floor = room.structure().floorAtLevel(levelZ);
            if (floor != null) {
                result.put(levelZ, floor.anchorCell());
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Set<GridSegment2x> roomWallSegments(Room room) {
        if (room == null) {
            return Set.of();
        }
        Set<GridSegment2x> result = new LinkedHashSet<>();
        for (Integer levelZ : room.structure().levels()) {
            for (Wall wall : room.structure().wallsAtLevel(levelZ)) {
                result.addAll(wall.segments2x());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static List<Set<Point2i>> connectedComponents(Collection<Point2i> cells) {
        Set<Point2i> remaining = normalizeCells(cells);
        if (remaining.isEmpty()) {
            return List.of();
        }
        List<Set<Point2i>> components = new ArrayList<>();
        LinkedHashSet<Point2i> unvisited = new LinkedHashSet<>(remaining);
        while (!unvisited.isEmpty()) {
            Point2i seed = unvisited.iterator().next();
            ArrayDeque<Point2i> queue = new ArrayDeque<>();
            LinkedHashSet<Point2i> component = new LinkedHashSet<>();
            queue.add(seed);
            unvisited.remove(seed);
            while (!queue.isEmpty()) {
                Point2i current = queue.removeFirst();
                if (!component.add(current)) {
                    continue;
                }
                for (Point2i step : Point2i.CARDINAL_STEPS) {
                    Point2i neighbor = current.add(step);
                    if (unvisited.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            components.add(Set.copyOf(component));
        }
        return List.copyOf(components);
    }

    private static Map<Integer, Set<Point2i>> mutableCellsByLevel(Map<Integer, Set<Point2i>> source) {
        Map<Integer, Set<Point2i>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<Point2i>> entry : source.entrySet()) {
            result.put(entry.getKey(), new LinkedHashSet<>(entry.getValue()));
        }
        return result;
    }

    private static Map<Integer, Set<Point2i>> mutableCellsByLevelWithoutLevel(Map<Integer, Set<Point2i>> source, int excludedLevel) {
        Map<Integer, Set<Point2i>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<Point2i>> entry : source.entrySet()) {
            if (entry.getKey() != excludedLevel) {
                result.put(entry.getKey(), new LinkedHashSet<>(entry.getValue()));
            }
        }
        return result;
    }

    private static Map<Integer, Set<Point2i>> immutableCellsByLevel(Map<Integer, Set<Point2i>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Set<Point2i>> result = new LinkedHashMap<>();
        source.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    Set<Point2i> cells = normalizeCells(entry.getValue());
                    if (!cells.isEmpty()) {
                        result.put(entry.getKey(), cells);
                    }
                });
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Integer, Point2i> immutableAnchors(Map<Integer, Point2i> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Point2i> result = new LinkedHashMap<>();
        source.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), entry.getValue()));
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Set<Point2i> normalizeCells(Collection<Point2i> input) {
        LinkedHashSet<Point2i> result = new LinkedHashSet<>();
        if (input != null) {
            for (Point2i cell : input) {
                if (cell != null) {
                    result.add(cell);
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Point2i bestCenterCell(Set<Point2i> cells) {
        if (cells == null || cells.isEmpty()) {
            return new Point2i(0, 0);
        }
        double averageX = cells.stream().mapToInt(Point2i::x).average().orElse(0.0);
        double averageY = cells.stream().mapToInt(Point2i::y).average().orElse(0.0);
        return cells.stream()
                .min(Comparator
                        .comparingDouble((Point2i cell) -> squaredDistance(cell, averageX, averageY))
                        .thenComparingInt(Point2i::y)
                        .thenComparingInt(Point2i::x))
                .orElse(new Point2i(0, 0));
    }

    private static double squaredDistance(Point2i cell, double x, double y) {
        double deltaX = cell.x() - x;
        double deltaY = cell.y() - y;
        return deltaX * deltaX + deltaY * deltaY;
    }

    private static boolean contains(Set<Point2i> cells, Point2i cell) {
        return cell != null && cells != null && cells.contains(cell);
    }

    private static Point2i preferredAnchor(Set<Point2i> roomCells, Point2i preferredAnchor) {
        if (preferredAnchor != null && contains(roomCells, preferredAnchor)) {
            return preferredAnchor;
        }
        return roomCells == null || roomCells.isEmpty() ? null : bestCenterCell(roomCells);
    }

    private record LevelSeed(int level, Point2i cell) {
    }
}
