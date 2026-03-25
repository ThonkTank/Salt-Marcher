package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.geometry.VertexPath;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.Floor;
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

    static ClusterRewrite applyPaint(RoomCluster cluster, TileShape paintShape, List<RoomCluster> overlappingClusters, int paintLevel) {
        if (cluster == null || paintShape == null || paintShape.size() == 0) {
            return unchangedRewrite(cluster);
        }
        List<RoomCluster> resolvedClusters = normalizedClusters(overlappingClusters);
        List<Room> touchedRooms = resolvedClusters.stream()
                .flatMap(candidate -> candidate.rooms().stream())
                .filter(room -> room != null && room.roomId() != null && overlapsAtAnyLevel(room, paintShape))
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
        Map<Integer, TileShape> mergedRoomShapesByLevel = new LinkedHashMap<>();
        for (Room room : touchedRooms) {
            mergeRoomShapes(mergedRoomShapesByLevel, room);
        }
        mergedRoomShapesByLevel.merge(paintLevel, paintShape, TileShape::union);

        Set<Point2i> mergedClusterCells = new LinkedHashSet<>(paintShape.absoluteCells());
        Map<VertexEdge, InternalBoundaryType> previousBoundaryKinds = new LinkedHashMap<>();
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
                        room.shapesByLevel(),
                        room.anchorsByLevel()));
            }
        }
        candidates.add(RoomRewriteCandidate.keep(
                retainedRoom.roomId(),
                retainedRoom.name(),
                mergedRoomShapesByLevel,
                retainedRoom.anchorsByLevel()));

        TileShape rewrittenClusterShape = TileShape.fromAbsoluteCells(mergedClusterCells);
        List<ReconciledRoom> reconciledRooms = reconciledRooms(cluster, rewrittenClusterShape, candidates, previousBoundaryKinds);
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
                        rewrittenClusterShape,
                        rewrittenClusterShape.centerCell(),
                        rewrittenRooms,
                        localConnections(rewrittenClusterShape, cluster.mapId(), cluster.clusterId(), rewrittenRooms, previousBoundaryKinds),
                        persistedBoundaries(rewrittenClusterShape, rewrittenRooms, previousBoundaryKinds))
                .deletedRoomIds(deletedRoomIds)
                .replacedRoomIds(replacedRoomIds)
                .mergedRoomIds(mergedRoomIds.size() > 1 ? mergedRoomIds : Set.of())
                .deletedClusterIds(deletedClusterIds)
                .topologyChanged(true)
                .build();
    }

    static ClusterRewrite applyDelete(RoomCluster cluster, TileShape deletedShape, Supplier<String> roomNameSupplier, int deleteLevel) {
        if (cluster == null || deletedShape == null || deletedShape.size() == 0) {
            return unchangedRewrite(cluster);
        }
        Map<Integer, Set<Point2i>> remainingCellsByLevel = clusterCellsByLevel(cluster);
        Set<Point2i> remainingDeleteLevelCells = new LinkedHashSet<>(remainingCellsByLevel.getOrDefault(deleteLevel, Set.of()));
        if (!remainingDeleteLevelCells.removeAll(deletedShape.absoluteCells())) {
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
                            TileShape.singleCell(cluster.center()),
                            cluster.center(),
                            List.of(),
                            List.of(),
                            List.of())
                    .deletedRoomIds(cluster.roomIds())
                    .deletedClusterIds(Set.of(cluster.clusterId()))
                    .topologyChanged(true)
                    .build();
        }

        Map<VertexEdge, InternalBoundaryType> previousBoundaryKinds = cluster.internalBoundaryKinds();
        List<RoomRewriteCandidate> candidates = new ArrayList<>();
        Set<Long> deletedRoomIds = new LinkedHashSet<>();
        Map<Long, List<RoomRewriteCandidate>> fragmentsBySourceRoomId = new LinkedHashMap<>();
        for (Room room : cluster.rooms()) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            Map<Integer, TileShape> remainingShapesByLevel = room.shapesByLevel();
            TileShape existingDeleteLevelShape = remainingShapesByLevel.getOrDefault(deleteLevel, TileShape.empty());
            TileShape remainingDeleteLevelShape = existingDeleteLevelShape.subtract(deletedShape);
            if (remainingDeleteLevelShape.size() == 0) {
                remainingShapesByLevel.remove(deleteLevel);
            } else {
                remainingShapesByLevel.put(deleteLevel, remainingDeleteLevelShape);
            }
            List<TileShape> components = remainingDeleteLevelShape.connectedComponents().stream()
                    .sorted(Comparator
                            .comparing((TileShape component) -> !component.contains(existingDeleteLevelShape.anchor()))
                            .thenComparing(TileShape::centerCell, Point2i.POINT_ORDER))
                    .toList();
            if (remainingShapesByLevel.isEmpty()) {
                deletedRoomIds.add(room.roomId());
                continue;
            }
            if (components.isEmpty()) {
                RoomRewriteCandidate retainedCandidate = RoomRewriteCandidate.keep(
                        room.roomId(),
                        room.name(),
                        remainingShapesByLevel,
                        room.anchorsByLevel());
                candidates.add(retainedCandidate);
                fragmentsBySourceRoomId.put(room.roomId(), List.of(retainedCandidate));
                continue;
            }
            List<RoomRewriteCandidate> sourceFragments = new ArrayList<>();
            for (int index = 0; index < components.size(); index++) {
                TileShape component = components.get(index);
                Map<Integer, TileShape> fragmentShapesByLevel = new LinkedHashMap<>();
                if (index == 0) {
                    fragmentShapesByLevel.putAll(remainingShapesByLevel);
                } else {
                    for (Map.Entry<Integer, TileShape> entry : remainingShapesByLevel.entrySet()) {
                        if (entry.getKey() != deleteLevel) {
                            fragmentShapesByLevel.put(entry.getKey(), entry.getValue());
                        }
                    }
                }
                fragmentShapesByLevel.put(deleteLevel, component);
                String roomName = index == 0
                        ? room.name()
                        : nextGeneratedRoomName(roomNameSupplier, room.name());
                RoomRewriteCandidate candidate = index == 0
                        ? RoomRewriteCandidate.keep(room.roomId(), roomName, fragmentShapesByLevel, room.anchorsByLevel())
                        : RoomRewriteCandidate.create(room.roomId(), roomName, fragmentShapesByLevel, room.anchorsByLevel());
                candidates.add(candidate);
                sourceFragments.add(candidate);
            }
            fragmentsBySourceRoomId.put(room.roomId(), List.copyOf(sourceFragments));
        }

        TileShape rewrittenClusterShape = TileShape.fromAbsoluteCells(flattenCells(remainingCellsByLevel));
        List<ReconciledRoom> reconciledRooms = reconciledRooms(cluster, rewrittenClusterShape, candidates, previousBoundaryKinds);
        List<Room> rewrittenRooms = rooms(reconciledRooms);
        Map<Long, List<Room>> splitFragmentsBySourceRoomId = resolvedFragmentsBySourceRoomId(
                fragmentsBySourceRoomId,
                reconciledRooms);
        List<ClusterRewriteSplit> componentClusters = deleteRewriteClusters(
                cluster,
                rewrittenClusterShape,
                rewrittenRooms,
                previousBoundaryKinds);
        ClusterRewriteSplit retainedCluster = componentClusters.getFirst().withClusterId(cluster.clusterId());
        List<ClusterRewriteSplit> splitClusters = componentClusters.stream()
                .skip(1)
                .toList();
        return ClusterRewrite.builder(
                        cluster.clusterId(),
                        retainedCluster.clusterShape(),
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

    static ClusterRewrite editBoundary(RoomCluster cluster, Collection<VertexEdge> edges, InternalBoundaryType type, boolean deleteBoundary) {
        if (cluster == null || edges == null || edges.isEmpty()) {
            return null;
        }
        Map<VertexEdge, InternalBoundaryType> updatedBoundaryKinds = new LinkedHashMap<>(cluster.internalBoundaryKinds());
        InternalBoundaryType resolvedType = type == null ? InternalBoundaryType.WALL : type;
        boolean changed = false;
        for (VertexEdge edge : edges) {
            if (edge == null || !isInternalEdge(cluster.cells(), edge)) {
                continue;
            }
            List<Point2i> touchingCells = edge.touchingCells().stream()
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
            InternalBoundaryType currentType = updatedBoundaryKinds.get(edge);
            if (deleteBoundary) {
                if (currentType == null || sameRoomId(leftRoom, rightRoom)) {
                    continue;
                }
                updatedBoundaryKinds.remove(edge);
                changed = true;
                continue;
            }
            if (resolvedType == InternalBoundaryType.WALL && currentType == InternalBoundaryType.DOOR) {
                continue;
            }
            if (resolvedType == currentType) {
                continue;
            }
            updatedBoundaryKinds.put(edge, resolvedType);
            changed = true;
        }

        if (!changed) {
            return null;
        }

        List<Room> rewrittenRooms = rewriteRoomsForBoundaryKinds(cluster, updatedBoundaryKinds);
        BoundaryMergeResult merge = computeMergeMetadata(cluster, rewrittenRooms);
        return ClusterRewrite.builder(
                        cluster.clusterId(),
                        cluster.shape(),
                        cluster.center(),
                        rewrittenRooms,
                        localConnections(cluster.shape(), cluster.mapId(), cluster.clusterId(), rewrittenRooms, updatedBoundaryKinds),
                        persistedBoundaries(cluster.shape(), rewrittenRooms, updatedBoundaryKinds))
                .deletedRoomIds(merge.deletedRoomIds())
                .replacedRoomIds(merge.replacedRoomIds())
                .mergedRoomIds(merge.mergedRoomIds())
                .topologyChanged(true)
                .build();
    }

    static List<ReconciledRoom> reconciledRooms(
            RoomCluster cluster,
            TileShape clusterShape,
            List<RoomRewriteCandidate> candidates,
            Map<VertexEdge, InternalBoundaryType> previousKinds
    ) {
        if (cluster == null || clusterShape == null || clusterShape.size() == 0) {
            return List.of();
        }
        Set<Point2i> clusterCells = clusterShape.absoluteCells();
        Map<VertexEdge, InternalBoundaryType> boundaryKinds = previousKinds == null ? Map.of() : Map.copyOf(previousKinds);
        List<ReconciledRoom> result = new ArrayList<>();
        for (RoomRewriteCandidate candidate : candidates == null ? List.<RoomRewriteCandidate>of() : candidates) {
            if (candidate == null || candidate.shapesByLevel() == null || candidate.shapesByLevel().isEmpty()) {
                continue;
            }
            Room room = cluster.findRoom(candidate.roomId());
            RoomNarration narration = room == null ? RoomNarration.empty() : room.narration();
            result.add(new ReconciledRoom(
                    candidate,
                    resolvedRoom(
                            cluster,
                            candidate.shapesByLevel(),
                            clusterCells,
                            boundaryKinds,
                            candidate.roomId(),
                            candidate.name(),
                            narration)));
        }
        return List.copyOf(result);
    }

    static List<Room> rewriteRoomsForBoundaryKinds(RoomCluster cluster, Map<VertexEdge, InternalBoundaryType> boundaryKinds) {
        if (cluster == null || cluster.shape().size() == 0 || cluster.rooms().isEmpty()) {
            return List.of();
        }
        Map<Integer, Set<Point2i>> remainingCellsByLevel = mutableClusterCellsByLevel(cluster);
        List<VertexPath> barriers = barriersForBoundaryKinds(boundaryKinds);
        List<Room> rewrittenRooms = new ArrayList<>();
        Set<Long> retainedRoomIds = new LinkedHashSet<>();
        for (Room room : cluster.rooms()) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            Map<Integer, TileShape> roomShapesByLevel = rewrittenRoomShapesByLevel(room, remainingCellsByLevel, barriers);
            if (roomShapesByLevel.isEmpty()) {
                continue;
            }
            List<Room> sourceRooms = roomsForCells(cluster, flattenShapes(roomShapesByLevel));
            Room retainedRoom = retainedRoom(sourceRooms, retainedRoomIds);
            rewrittenRooms.add(resolveRoomForShapes(cluster, retainedRoom, roomShapesByLevel, boundaryKinds, sourceRooms));
        }
        while (hasRemainingCells(remainingCellsByLevel)) {
            LevelSeed seed = firstRemainingSeed(remainingCellsByLevel);
            Point2i anchor = seed == null ? null : seed.cell();
            if (anchor == null) {
                break;
            }
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
            rewrittenRooms.add(resolveRoomForShapes(
                    cluster,
                    retainedRoom,
                    Map.of(seed.level(), TileShape.fromAbsoluteCells(roomCells)),
                    boundaryKinds,
                    sourceRooms));
        }
        return List.copyOf(rewrittenRooms);
    }

    static Room resolvedRoom(
            RoomCluster cluster,
            Map<Integer, TileShape> roomShapesByLevel,
            Set<Point2i> clusterCells,
            Map<VertexEdge, InternalBoundaryType> boundaryKinds,
            Long roomId,
            String roomName,
            RoomNarration narration
    ) {
        Map<Integer, Floor> floors = floorsFromShapes(roomShapesByLevel);
        Set<VertexEdge> walls = new LinkedHashSet<>();
        for (Floor floor : floors.values()) {
            BoundarySets boundarySets = boundarySetsForRoom(floor.shape(), clusterCells, boundaryKinds);
            walls.addAll(boundarySets.walls());
        }
        return Room.resolved(
                roomId,
                cluster.mapId(),
                cluster.clusterId() == null ? 0L : cluster.clusterId(),
                roomName,
                floors,
                walls.isEmpty() ? List.of() : List.of(new Wall(walls)),
                narration);
    }

    static BoundarySets boundarySetsForRoom(
            TileShape roomShape,
            Set<Point2i> clusterCells,
            Map<VertexEdge, InternalBoundaryType> boundaryKinds
    ) {
        Set<VertexEdge> wallEdges = new LinkedHashSet<>();
        Set<VertexEdge> connectionEdges = new LinkedHashSet<>();
        if (roomShape == null || roomShape.size() == 0 || clusterCells == null || clusterCells.isEmpty()) {
            return new BoundarySets(Set.of(), Set.of());
        }
        for (Point2i cell : roomShape.absoluteCells()) {
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Point2i neighbor = cell.add(step);
                if (roomShape.contains(neighbor)) {
                    continue;
                }
                if (!clusterCells.contains(neighbor)) {
                    wallEdges.add(VertexEdge.betweenCellAndStep(cell, step));
                    continue;
                }
                VertexEdge edge = VertexEdge.betweenCellAndStep(cell, step);
                InternalBoundaryType type = boundaryKinds == null
                        ? InternalBoundaryType.WALL
                        : boundaryKinds.getOrDefault(edge, InternalBoundaryType.WALL);
                if (type == InternalBoundaryType.DOOR) {
                    connectionEdges.add(edge);
                } else {
                    wallEdges.add(edge);
                }
            }
        }
        return new BoundarySets(Set.copyOf(wallEdges), Set.copyOf(connectionEdges));
    }

    static List<VertexPath> barriersForBoundaryKinds(Map<VertexEdge, InternalBoundaryType> boundaryKinds) {
        List<VertexPath> barriers = new ArrayList<>();
        for (Map.Entry<VertexEdge, InternalBoundaryType> entry : boundaryKinds.entrySet()) {
            if (entry.getKey() == null || entry.getValue() == null) {
                continue;
            }
            if (entry.getValue() == InternalBoundaryType.DOOR) {
                barriers.add(new Door(Set.of(entry.getKey())));
            } else {
                barriers.add(new Wall(Set.of(entry.getKey())));
            }
        }
        return List.copyOf(barriers);
    }

    static Set<Point2i> reachableCells(Point2i startAnchor, Set<Point2i> traversableCells, List<VertexPath> barriers) {
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

    static List<Room> roomsForCells(RoomCluster cluster, Set<Point2i> roomCells) {
        if (cluster == null) {
            return List.of();
        }
        return cluster.rooms().stream()
                .filter(room -> room != null && room.roomId() != null && !disjoint(room.cells(), roomCells))
                .sorted(Comparator.comparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                .toList();
    }

    static Room retainedRoom(List<Room> sourceRooms, Set<Long> retainedRoomIds) {
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

    static Room resolveRoomForShapes(
            RoomCluster cluster,
            Room retainedRoom,
            Map<Integer, TileShape> roomShapesByLevel,
            Map<VertexEdge, InternalBoundaryType> boundaryKinds,
            List<Room> sourceRooms
    ) {
        Long roomId = retainedRoom == null ? null : retainedRoom.roomId();
        String roomName = retainedRoom == null ? derivedSplitRoomName(sourceRooms) : retainedRoom.name();
        RoomNarration narration = retainedRoom == null
                ? (sourceRooms == null || sourceRooms.isEmpty() ? RoomNarration.empty() : sourceRooms.getFirst().narration())
                : retainedRoom.narration();
        return resolvedRoom(
                cluster,
                roomShapesByLevel,
                cluster.cells(),
                boundaryKinds,
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
            List<Room> sourceRooms = roomsForCells(cluster, rewrittenRoom.cells());
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
            TileShape rewrittenClusterShape,
            List<Room> rewrittenRooms,
            Map<VertexEdge, InternalBoundaryType> boundaryKinds
    ) {
        if (cluster == null || rewrittenClusterShape == null || rewrittenClusterShape.size() == 0) {
            return List.of();
        }
        return rewrittenClusterShape.connectedComponents().stream()
                .sorted(Comparator
                        .comparing((TileShape component) -> !component.contains(cluster.center()))
                        .thenComparingInt(component -> component.centerCell().distanceTo(cluster.center()))
                        .thenComparing(TileShape::centerCell, Point2i.POINT_ORDER))
                .map(componentShape -> {
                    List<Room> componentRooms = roomsForDeleteComponent(componentShape, rewrittenRooms);
                    return new ClusterRewriteSplit(
                            null,
                            componentShape,
                            componentShape.centerCell(),
                            componentRooms,
                            localConnections(componentShape, cluster.mapId(), null, componentRooms, boundaryKinds),
                            persistedBoundaries(componentShape, componentRooms, boundaryKinds));
                })
                .toList();
    }

    static List<Room> roomsForDeleteComponent(TileShape componentShape, List<Room> rewrittenRooms) {
        if (componentShape == null || componentShape.size() == 0) {
            return List.of();
        }
        Set<Point2i> componentCells = componentShape.absoluteCells();
        return rewrittenRooms.stream()
                .filter(room -> room != null && !disjoint(room.cells(), componentCells))
                .sorted(Comparator.comparing(Room::roomId, Comparator.nullsLast(Long::compareTo))
                        .thenComparing(room -> room.floor().shape().centerCell(), Point2i.POINT_ORDER))
                .toList();
    }

    static List<InternalBoundaryEdge> persistedBoundaries(
            TileShape clusterShape,
            List<Room> rooms,
            Map<VertexEdge, InternalBoundaryType> boundaryKinds
    ) {
        return computeInternalBoundaries(clusterShape, rooms, boundaryKinds).entrySet().stream()
                .map(entry -> toInternalBoundaryEdge(entry.getKey(), entry.getValue()))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    static List<LocalConnection> localConnections(
            TileShape clusterShape,
            long mapId,
            Long clusterId,
            List<Room> rooms,
            Map<VertexEdge, InternalBoundaryType> boundaryKinds
    ) {
        if (clusterShape == null || clusterShape.size() == 0) {
            return List.of();
        }
        long resolvedClusterId = clusterId == null ? 0L : clusterId;
        Map<Point2i, Room> roomsByCell = roomsByCell(rooms);
        return computeInternalBoundaries(clusterShape, rooms, boundaryKinds).entrySet().stream()
                .filter(entry -> entry.getValue() == InternalBoundaryType.DOOR)
                .map(entry -> localConnectionForEdge(entry.getKey(), mapId, resolvedClusterId, roomsByCell))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    static Map<VertexEdge, InternalBoundaryType> internalBoundaryKinds(
            TileShape clusterShape,
            List<Room> rooms,
            List<LocalConnection> localConnections
    ) {
        return computeInternalBoundaries(clusterShape, rooms, boundaryKinds(localConnections));
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

    static List<RoomCluster> normalizedClusters(List<RoomCluster> clusters) {
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

    static ClusterRewrite unchangedRewrite(RoomCluster cluster) {
        if (cluster == null) {
            return null;
        }
        return ClusterRewrite.unchanged(
                cluster.clusterId(),
                cluster.shape(),
                cluster.center(),
                cluster.rooms(),
                cluster.localConnections(),
                persistedBoundaries(cluster.shape(), cluster.rooms(), cluster.internalBoundaryKinds()));
    }

    static InternalBoundaryEdge toInternalBoundaryEdge(VertexEdge edge, InternalBoundaryType type) {
        if (edge == null) {
            return null;
        }
        List<Point2i> touchingCells = edge.touchingCells().stream()
                .sorted(Point2i.POINT_ORDER)
                .toList();
        if (touchingCells.size() != 2) {
            return null;
        }
        Point2i baseCell = touchingCells.getFirst();
        Point2i direction = baseCell.directionToCardinal(touchingCells.get(1));
        return direction == null ? null : new InternalBoundaryEdge(baseCell, direction, type);
    }

    static boolean isInternalEdge(Set<Point2i> clusterCells, VertexEdge edge) {
        Set<Point2i> touchingCells = edge.touchingCells();
        return touchingCells.size() == 2 && clusterCells.containsAll(touchingCells);
    }

    static String nextGeneratedRoomName(Supplier<String> roomNameSupplier, String fallbackName) {
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

    private static Map<VertexEdge, InternalBoundaryType> computeInternalBoundaries(
            TileShape clusterShape,
            List<Room> rooms,
            Map<VertexEdge, InternalBoundaryType> boundaryKinds
    ) {
        if (clusterShape == null || clusterShape.size() == 0) {
            return Map.of();
        }
        Map<VertexEdge, InternalBoundaryType> result = new LinkedHashMap<>();
        Set<Point2i> clusterCells = clusterShape.absoluteCells();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room == null) {
                continue;
            }
            for (Wall wall : room.walls()) {
                for (VertexEdge edge : wall.edges()) {
                    if (isInternalEdge(clusterCells, edge)) {
                        result.putIfAbsent(edge, InternalBoundaryType.WALL);
                    }
                }
            }
        }
        for (Map.Entry<VertexEdge, InternalBoundaryType> entry : (boundaryKinds == null ? Map.<VertexEdge, InternalBoundaryType>of() : boundaryKinds).entrySet()) {
            if (isInternalEdge(clusterCells, entry.getKey()) && entry.getValue() == InternalBoundaryType.DOOR) {
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

    private static boolean isBlocked(List<VertexPath> barriers, Point2i cell, Point2i step) {
        for (VertexPath barrier : barriers) {
            if (barrier != null && barrier.crosses(cell, step)) {
                return true;
            }
        }
        return false;
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

    private static Map<Point2i, Room> roomsByCell(List<Room> rooms) {
        Map<Point2i, Room> result = new LinkedHashMap<>();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room == null) {
                continue;
            }
            for (Point2i cell : room.cells()) {
                result.put(cell, room);
            }
        }
        return Map.copyOf(result);
    }

    private static LocalConnection localConnectionForEdge(
            VertexEdge edge,
            long mapId,
            long clusterId,
            Map<Point2i, Room> roomsByCell
    ) {
        if (edge == null) {
            return null;
        }
        List<Point2i> touchingCells = edge.touchingCells().stream()
                .sorted(Point2i.POINT_ORDER)
                .toList();
        if (touchingCells.size() != 2) {
            return null;
        }
        Room leftRoom = roomsByCell.get(touchingCells.getFirst());
        Room rightRoom = roomsByCell.get(touchingCells.getLast());
        if (leftRoom == null || rightRoom == null || sameRoomId(leftRoom, rightRoom)) {
            return null;
        }
        return new LocalConnection(
                null,
                mapId,
                clusterId,
                new Door(Set.of(edge)),
                List.of(ConnectionEndpoint.room(leftRoom.roomId()), ConnectionEndpoint.room(rightRoom.roomId())));
    }

    private static Map<VertexEdge, InternalBoundaryType> boundaryKinds(List<LocalConnection> localConnections) {
        Map<VertexEdge, InternalBoundaryType> result = new LinkedHashMap<>();
        for (LocalConnection connection : localConnections == null ? List.<LocalConnection>of() : localConnections) {
            if (connection == null || connection.door() == null) {
                continue;
            }
            for (VertexEdge edge : connection.door().edges()) {
                result.put(edge, InternalBoundaryType.DOOR);
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

    record BoundarySets(Set<VertexEdge> walls, Set<VertexEdge> connectionEdges) {
    }

    record RoomRewriteCandidate(
            Long sourceRoomId,
            Long roomId,
            String name,
            Map<Integer, TileShape> shapesByLevel,
            Map<Integer, Point2i> preferredAnchorsByLevel
    ) {
        static RoomRewriteCandidate keep(Long roomId, String name, Map<Integer, TileShape> shapesByLevel, Map<Integer, Point2i> preferredAnchorsByLevel) {
            return new RoomRewriteCandidate(roomId, roomId, name, Map.copyOf(shapesByLevel), Map.copyOf(preferredAnchorsByLevel));
        }

        static RoomRewriteCandidate create(Long sourceRoomId, String name, Map<Integer, TileShape> shapesByLevel, Map<Integer, Point2i> preferredAnchorsByLevel) {
            return new RoomRewriteCandidate(sourceRoomId, null, name, Map.copyOf(shapesByLevel), Map.copyOf(preferredAnchorsByLevel));
        }
    }

    record ReconciledRoom(
            RoomRewriteCandidate candidate,
            Room room
    ) {
    }

    private static boolean overlapsAtAnyLevel(Room room, TileShape paintShape) {
        if (room == null || paintShape == null) {
            return false;
        }
        for (Floor floor : room.floors().values()) {
            if (floor != null && floor.shape().overlaps(paintShape)) {
                return true;
            }
        }
        return false;
    }

    private static void mergeRoomShapes(Map<Integer, TileShape> result, Room room) {
        if (result == null || room == null) {
            return;
        }
        for (Map.Entry<Integer, Floor> entry : room.floors().entrySet()) {
            if (entry == null || entry.getKey() == null || entry.getValue() == null) {
                continue;
            }
            result.merge(entry.getKey(), entry.getValue().shape(), TileShape::union);
        }
    }

    private static Map<Integer, Floor> floorsFromShapes(Map<Integer, TileShape> shapesByLevel) {
        if (shapesByLevel == null || shapesByLevel.isEmpty()) {
            return Map.of(0, new Floor(null));
        }
        Map<Integer, Floor> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, TileShape> entry : shapesByLevel.entrySet()) {
            if (entry == null || entry.getKey() == null || entry.getValue() == null || entry.getValue().size() == 0) {
                continue;
            }
            result.put(entry.getKey(), new Floor(entry.getValue()));
        }
        return result.isEmpty() ? Map.of(0, new Floor(null)) : Map.copyOf(result);
    }

    private static Map<Integer, Set<Point2i>> clusterCellsByLevel(RoomCluster cluster) {
        Map<Integer, Set<Point2i>> result = new LinkedHashMap<>();
        if (cluster == null) {
            return Map.of();
        }
        for (Room room : cluster.rooms()) {
            if (room == null) {
                continue;
            }
            for (Map.Entry<Integer, Floor> entry : room.floors().entrySet()) {
                if (entry == null || entry.getKey() == null || entry.getValue() == null) {
                    continue;
                }
                result.computeIfAbsent(entry.getKey(), ignored -> new LinkedHashSet<>())
                        .addAll(entry.getValue().shape().absoluteCells());
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Integer, Set<Point2i>> mutableClusterCellsByLevel(RoomCluster cluster) {
        Map<Integer, Set<Point2i>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<Point2i>> entry : clusterCellsByLevel(cluster).entrySet()) {
            result.put(entry.getKey(), new LinkedHashSet<>(entry.getValue()));
        }
        return result;
    }

    private static Map<Integer, TileShape> rewrittenRoomShapesByLevel(
            Room room,
            Map<Integer, Set<Point2i>> remainingCellsByLevel,
            List<VertexPath> barriers
    ) {
        Map<Integer, TileShape> result = new LinkedHashMap<>();
        if (room == null || remainingCellsByLevel == null || remainingCellsByLevel.isEmpty()) {
            return Map.of();
        }
        for (Map.Entry<Integer, Point2i> entry : room.anchorsByLevel().entrySet().stream()
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
            result.put(level, TileShape.fromAbsoluteCells(roomCells));
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static boolean hasRemainingCells(Map<Integer, Set<Point2i>> remainingCellsByLevel) {
        return firstRemainingSeed(remainingCellsByLevel) != null;
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

    private static Set<Point2i> flattenShapes(Map<Integer, TileShape> shapesByLevel) {
        Set<Point2i> result = new LinkedHashSet<>();
        for (TileShape shape : shapesByLevel.values()) {
            if (shape != null) {
                result.addAll(shape.absoluteCells());
            }
        }
        return Set.copyOf(result);
    }

    private static Set<Point2i> flattenCells(Map<Integer, Set<Point2i>> cellsByLevel) {
        Set<Point2i> result = new LinkedHashSet<>();
        for (Set<Point2i> cells : cellsByLevel.values()) {
            result.addAll(cells);
        }
        return Set.copyOf(result);
    }

    private record LevelSeed(int level, Point2i cell) {
    }
}
