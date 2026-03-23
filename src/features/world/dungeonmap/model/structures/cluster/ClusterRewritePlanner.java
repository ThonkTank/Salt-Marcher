package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.geometry.VertexPath;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.objects.Wall;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomNarration;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.Supplier;

final class ClusterRewritePlanner {

    private ClusterRewritePlanner() {
    }

    static ClusterRewrite applyPaint(RoomCluster cluster, TileShape paintShape, List<RoomCluster> overlappingClusters) {
        if (cluster == null || paintShape == null || paintShape.size() == 0) {
            return unchangedRewrite(cluster);
        }
        List<RoomCluster> resolvedClusters = normalizedClusters(overlappingClusters);
        List<Room> touchedRooms = resolvedClusters.stream()
                .flatMap(candidate -> candidate.rooms().stream())
                .filter(room -> room != null && room.roomId() != null && room.floor().shape().overlaps(paintShape))
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
        TileShape mergedRoomShape = paintShape;
        for (Room room : touchedRooms) {
            mergedRoomShape = mergedRoomShape.union(room.floor().shape());
        }

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
                        room.floor().shape(),
                        room.floor().shape().anchor()));
            }
        }
        candidates.add(RoomRewriteCandidate.keep(
                retainedRoom.roomId(),
                retainedRoom.name(),
                mergedRoomShape,
                retainedRoom.floor().shape().anchor()));

        TileShape rewrittenClusterShape = TileShape.fromAbsoluteCells(mergedClusterCells);
        List<Room> rewrittenRooms = reconciledRooms(cluster, rewrittenClusterShape, candidates, previousBoundaryKinds);
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
                        persistedBoundaries(rewrittenClusterShape, rewrittenRooms))
                .deletedRoomIds(deletedRoomIds)
                .replacedRoomIds(replacedRoomIds)
                .mergedRoomIds(mergedRoomIds.size() > 1 ? mergedRoomIds : Set.of())
                .deletedClusterIds(deletedClusterIds)
                .topologyChanged(true)
                .build();
    }

    static ClusterRewrite applyDelete(RoomCluster cluster, TileShape deletedShape, Supplier<String> roomNameSupplier) {
        if (cluster == null || deletedShape == null || deletedShape.size() == 0) {
            return unchangedRewrite(cluster);
        }
        Set<Point2i> remainingCells = new LinkedHashSet<>(cluster.cells());
        if (!remainingCells.removeAll(deletedShape.absoluteCells())) {
            return unchangedRewrite(cluster);
        }
        if (remainingCells.isEmpty()) {
            return ClusterRewrite.builder(
                            cluster.clusterId(),
                            TileShape.singleCell(cluster.center()),
                            cluster.center(),
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
            TileShape remainingShape = room.floor().shape().subtract(deletedShape);
            List<TileShape> components = remainingShape.connectedComponents().stream()
                    .sorted(Comparator
                            .comparing((TileShape component) -> !component.contains(room.floor().shape().anchor()))
                            .thenComparing(TileShape::centerCell, Point2i.POINT_ORDER))
                    .toList();
            if (components.isEmpty()) {
                deletedRoomIds.add(room.roomId());
                continue;
            }
            List<RoomRewriteCandidate> sourceFragments = new ArrayList<>();
            for (int index = 0; index < components.size(); index++) {
                TileShape component = components.get(index);
                String roomName = index == 0
                        ? room.name()
                        : nextGeneratedRoomName(roomNameSupplier, room.name());
                RoomRewriteCandidate candidate = index == 0
                        ? RoomRewriteCandidate.keep(room.roomId(), roomName, component, room.floor().shape().anchor())
                        : RoomRewriteCandidate.create(room.roomId(), roomName, component, room.floor().shape().anchor());
                candidates.add(candidate);
                sourceFragments.add(candidate);
            }
            fragmentsBySourceRoomId.put(room.roomId(), List.copyOf(sourceFragments));
        }

        TileShape rewrittenClusterShape = TileShape.fromAbsoluteCells(remainingCells);
        List<Room> rewrittenRooms = reconciledRooms(cluster, rewrittenClusterShape, candidates, previousBoundaryKinds);
        Map<Long, List<Room>> splitFragmentsBySourceRoomId = resolvedFragmentsBySourceRoomId(
                fragmentsBySourceRoomId,
                rewrittenRooms);
        List<ClusterRewriteSplit> componentClusters = deleteRewriteClusters(cluster, rewrittenClusterShape, rewrittenRooms);
        ClusterRewriteSplit retainedCluster = componentClusters.getFirst().withClusterId(cluster.clusterId());
        List<ClusterRewriteSplit> splitClusters = componentClusters.stream()
                .skip(1)
                .toList();
        return ClusterRewrite.builder(
                        cluster.clusterId(),
                        retainedCluster.clusterShape(),
                        retainedCluster.clusterCenter(),
                        retainedCluster.rooms(),
                        retainedCluster.persistedBoundaries())
                .deletedRoomIds(deletedRoomIds)
                .splitFragmentsBySourceRoomId(splitFragmentsBySourceRoomId)
                .splitClusters(splitClusters)
                .topologyChanged(true)
                .build();
    }

    static ClusterRewrite editBoundary(RoomCluster cluster, VertexEdge edge, InternalBoundaryType type, boolean deleteBoundary) {
        if (cluster == null || edge == null || !isInternalEdge(cluster.cells(), edge)) {
            return null;
        }
        List<Point2i> touchingCells = edge.touchingCells().stream()
                .sorted(Point2i.POINT_ORDER)
                .toList();
        if (touchingCells.size() != 2) {
            return null;
        }
        Room leftRoom = cluster.roomAt(touchingCells.getFirst());
        Room rightRoom = cluster.roomAt(touchingCells.getLast());
        if (leftRoom == null || rightRoom == null || sameRoomId(leftRoom, rightRoom)) {
            return null;
        }

        Map<VertexEdge, InternalBoundaryType> updatedBoundaryKinds = new LinkedHashMap<>(cluster.internalBoundaryKinds());
        InternalBoundaryType resolvedType = type == null ? InternalBoundaryType.WALL : type;
        InternalBoundaryType currentType = updatedBoundaryKinds.get(edge);
        if (deleteBoundary) {
            if (currentType == null) {
                return null;
            }
            updatedBoundaryKinds.remove(edge);
        } else {
            if (resolvedType == currentType) {
                return null;
            }
            updatedBoundaryKinds.put(edge, resolvedType);
        }

        List<Room> rewrittenRooms = rewriteRoomsForBoundaryKinds(cluster, updatedBoundaryKinds);
        BoundaryMergeResult merge = computeMergeMetadata(cluster, rewrittenRooms);
        return ClusterRewrite.builder(
                        cluster.clusterId(),
                        cluster.shape(),
                        cluster.center(),
                        rewrittenRooms,
                        persistedBoundaries(cluster.shape(), rewrittenRooms))
                .deletedRoomIds(merge.deletedRoomIds())
                .replacedRoomIds(merge.replacedRoomIds())
                .mergedRoomIds(merge.mergedRoomIds())
                .topologyChanged(true)
                .build();
    }

    static List<Room> reconciledRooms(
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
        List<Room> result = new ArrayList<>();
        for (RoomRewriteCandidate candidate : candidates == null ? List.<RoomRewriteCandidate>of() : candidates) {
            if (candidate == null || candidate.shape() == null || candidate.shape().size() == 0) {
                continue;
            }
            Room room = cluster.findRoom(candidate.roomId());
            RoomNarration narration = room == null ? RoomNarration.empty() : room.narration();
            result.add(resolvedRoom(
                    cluster,
                    candidate.shape(),
                    clusterCells,
                    boundaryKinds,
                    candidate.roomId(),
                    candidate.name(),
                    narration));
        }
        return List.copyOf(result);
    }

    static List<Room> rewriteRoomsForBoundaryKinds(RoomCluster cluster, Map<VertexEdge, InternalBoundaryType> boundaryKinds) {
        if (cluster == null || cluster.shape().size() == 0 || cluster.rooms().isEmpty()) {
            return List.of();
        }
        Set<Point2i> remainingCells = new LinkedHashSet<>(cluster.cells());
        List<VertexPath> barriers = barriersForBoundaryKinds(boundaryKinds);
        List<Room> rewrittenRooms = new ArrayList<>();
        for (Room room : cluster.rooms()) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            Point2i anchor = room.floor().shape().anchor();
            if (!remainingCells.contains(anchor)) {
                continue;
            }
            Set<Point2i> roomCells = reachableCells(anchor, remainingCells, barriers);
            if (roomCells.isEmpty()) {
                continue;
            }
            remainingCells.removeAll(roomCells);
            List<Room> sourceRooms = roomsForCells(cluster, roomCells);
            Room retainedRoom = retainedRoom(sourceRooms);
            rewrittenRooms.add(resolveRoomForCells(cluster, retainedRoom, roomCells, boundaryKinds));
        }
        return List.copyOf(rewrittenRooms);
    }

    static Room resolvedRoom(
            RoomCluster cluster,
            TileShape roomShape,
            Set<Point2i> clusterCells,
            Map<VertexEdge, InternalBoundaryType> boundaryKinds,
            Long roomId,
            String roomName,
            RoomNarration narration
    ) {
        BoundarySets boundarySets = boundarySetsForRoom(roomShape, clusterCells, boundaryKinds);
        return Room.resolved(
                roomId,
                cluster.mapId(),
                cluster.clusterId() == null ? 0L : cluster.clusterId(),
                roomName,
                new Floor(roomShape),
                boundarySets.walls().isEmpty() ? List.of() : List.of(new Wall(boundarySets.walls())),
                boundarySets.doors(),
                narration);
    }

    static BoundarySets boundarySetsForRoom(
            TileShape roomShape,
            Set<Point2i> clusterCells,
            Map<VertexEdge, InternalBoundaryType> boundaryKinds
    ) {
        Set<VertexEdge> wallEdges = new LinkedHashSet<>();
        Set<VertexEdge> doorEdges = new LinkedHashSet<>();
        if (roomShape == null || roomShape.size() == 0 || clusterCells == null || clusterCells.isEmpty()) {
            return new BoundarySets(Set.of(), Set.of());
        }
        for (Point2i cell : roomShape.absoluteCells()) {
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Point2i neighbor = cell.add(step);
                if (!clusterCells.contains(neighbor) || roomShape.contains(neighbor)) {
                    continue;
                }
                VertexEdge edge = VertexEdge.betweenCellAndStep(cell, step);
                InternalBoundaryType type = boundaryKinds == null
                        ? InternalBoundaryType.WALL
                        : boundaryKinds.getOrDefault(edge, InternalBoundaryType.WALL);
                if (type == InternalBoundaryType.DOOR) {
                    doorEdges.add(edge);
                } else {
                    wallEdges.add(edge);
                }
            }
        }
        return new BoundarySets(Set.copyOf(wallEdges), Set.copyOf(doorEdges));
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

    static Room retainedRoom(List<Room> sourceRooms) {
        return sourceRooms == null || sourceRooms.isEmpty() ? null : sourceRooms.getFirst();
    }

    static Room resolveRoomForCells(
            RoomCluster cluster,
            Room retainedRoom,
            Set<Point2i> roomCells,
            Map<VertexEdge, InternalBoundaryType> boundaryKinds
    ) {
        TileShape roomShape = TileShape.fromAbsoluteCells(roomCells);
        Long roomId = retainedRoom == null ? null : retainedRoom.roomId();
        String roomName = retainedRoom == null ? normalizedRoomName(null, null) : retainedRoom.name();
        RoomNarration narration = retainedRoom == null ? RoomNarration.empty() : retainedRoom.narration();
        return resolvedRoom(
                cluster,
                roomShape,
                cluster.cells(),
                boundaryKinds,
                roomId,
                roomName,
                narration);
    }

    static BoundaryMergeResult computeMergeMetadata(RoomCluster cluster, List<Room> rewrittenRooms) {
        Set<Long> deletedRoomIds = new LinkedHashSet<>();
        Map<Long, Long> replacedRoomIds = new LinkedHashMap<>();
        Set<Long> mergedRoomIds = new LinkedHashSet<>();
        for (Room rewrittenRoom : rewrittenRooms) {
            if (rewrittenRoom == null) {
                continue;
            }
            List<Room> sourceRooms = roomsForCells(cluster, rewrittenRoom.floor().shape().absoluteCells());
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
            List<Room> rewrittenRooms
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
                            persistedBoundaries(componentShape, componentRooms));
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

    static List<InternalBoundaryEdge> persistedBoundaries(TileShape clusterShape, List<Room> rooms) {
        if (clusterShape == null || clusterShape.size() == 0) {
            return List.of();
        }
        Map<VertexEdge, InternalBoundaryType> boundaryKinds = boundaryKindsFor(clusterShape, rooms);
        return boundaryKinds.entrySet().stream()
                .map(entry -> toInternalBoundaryEdge(entry.getKey(), entry.getValue()))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    static Map<VertexEdge, InternalBoundaryType> persistedInternalBoundaries(TileShape clusterShape, List<Room> rooms) {
        return boundaryKindsFor(clusterShape, rooms);
    }

    static void forEachInternalBoundary(
            TileShape clusterShape,
            List<Room> rooms,
            BiConsumer<VertexEdge, InternalBoundaryType> consumer
    ) {
        if (clusterShape == null || clusterShape.size() == 0 || consumer == null) {
            return;
        }
        Set<Point2i> clusterCells = clusterShape.absoluteCells();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room == null) {
                continue;
            }
            for (Wall wall : room.walls()) {
                for (VertexEdge edge : wall.edges()) {
                    if (isInternalEdge(clusterCells, edge)) {
                        consumer.accept(edge, InternalBoundaryType.WALL);
                    }
                }
            }
            for (VertexEdge edge : room.doorEdges()) {
                if (isInternalEdge(clusterCells, edge)) {
                    consumer.accept(edge, InternalBoundaryType.DOOR);
                }
            }
        }
    }

    static Map<Long, List<Room>> resolvedFragmentsBySourceRoomId(
            Map<Long, List<RoomRewriteCandidate>> candidatesBySourceRoomId,
            List<Room> rooms
    ) {
        if (candidatesBySourceRoomId == null || candidatesBySourceRoomId.isEmpty()) {
            return Map.of();
        }
        Map<String, Room> roomBySignature = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room != null) {
                roomBySignature.put(signature(room.roomId(), room.name(), room.floor().shape()), room);
            }
        }
        Map<Long, List<Room>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<RoomRewriteCandidate>> entry : candidatesBySourceRoomId.entrySet()) {
            List<Room> resolved = entry.getValue().stream()
                    .map(candidate -> roomBySignature.get(signature(candidate.roomId(), candidate.name(), candidate.shape())))
                    .filter(java.util.Objects::nonNull)
                    .toList();
            result.put(entry.getKey(), resolved);
        }
        return Map.copyOf(result);
    }

    static String signature(Long roomId, String name, TileShape shape) {
        return roomId + "|" + name + "|" + shape;
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
                persistedBoundaries(cluster.shape(), cluster.rooms()));
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

    private static Map<VertexEdge, InternalBoundaryType> boundaryKindsFor(TileShape clusterShape, List<Room> rooms) {
        if (clusterShape == null || clusterShape.size() == 0) {
            return Map.of();
        }
        Map<VertexEdge, InternalBoundaryType> result = new LinkedHashMap<>();
        forEachInternalBoundary(clusterShape, rooms, (edge, type) -> {
            if (type == InternalBoundaryType.DOOR) {
                result.put(edge, type);
            } else {
                result.putIfAbsent(edge, type);
            }
        });
        return Map.copyOf(result);
    }

    private static boolean sameRoomId(Room left, Room right) {
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

    private static boolean disjoint(Set<Point2i> left, Set<Point2i> right) {
        for (Point2i point : left) {
            if (right.contains(point)) {
                return false;
            }
        }
        return true;
    }

    private static String normalizedRoomName(Long roomId, String name) {
        return name == null || name.isBlank()
                ? "Raum " + (roomId == null ? "neu" : roomId)
                : name.trim();
    }

    record BoundaryMergeResult(
            Set<Long> deletedRoomIds,
            Map<Long, Long> replacedRoomIds,
            Set<Long> mergedRoomIds
    ) {
    }

    record BoundarySets(Set<VertexEdge> walls, Set<VertexEdge> doors) {
    }

    record RoomRewriteCandidate(
            Long sourceRoomId,
            Long roomId,
            String name,
            TileShape shape,
            Point2i preferredAnchor
    ) {
        static RoomRewriteCandidate keep(Long roomId, String name, TileShape shape, Point2i preferredAnchor) {
            return new RoomRewriteCandidate(roomId, roomId, name, shape, preferredAnchor);
        }

        static RoomRewriteCandidate create(Long sourceRoomId, String name, TileShape shape, Point2i preferredAnchor) {
            return new RoomRewriteCandidate(sourceRoomId, null, name, shape, preferredAnchor);
        }
    }
}
